import { describe, it, expect, afterEach, vi } from "vitest";
import type { ChipRecommendation } from "../../optimizer/types";
import { orchestrateChips, type ChipOrchestratorInput } from "../../optimizer/chip-orchestrator";
import { llm } from "../../llm/client";
import { makeChips, makeCaptainCandidate } from "../factories";
import { stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

afterEach(restoreClaude);

function win(
  chip: ChipRecommendation["chip"],
  gw: number,
  draft: ChipRecommendation["draft"] = null
): ChipRecommendation {
  return { chip, triggerGw: gw, status: "window", reason: `${chip} window`, draft };
}

function input(over: Partial<ChipOrchestratorInput> = {}): ChipOrchestratorInput {
  return {
    windows: [],
    chipsRemaining: makeChips({ wildcard: 1, freeHit: 1, benchBoost: 1, tripleCaptain: 1 }),
    currentGw: 20,
    gwFlags: [],
    captainTop: makeCaptainCandidate({ player: { player: { webName: "Haaland" } } }),
    ...over,
  };
}

function mockLlm(plan: unknown) {
  return vi.spyOn(llm, "complete").mockResolvedValue(JSON.stringify(plan));
}

describe("orchestrateChips", () => {
  it("returns the deterministic windows unchanged when keyless (N2)", async () => {
    clearApiKey();
    const windows = [win("benchBoost", 25)];
    const out = await orchestrateChips(input({ windows }));
    expect(out).toBe(windows); // untouched, same reference
  });

  it("promotes a window to play-now when the LLM plays it this gameweek", async () => {
    stubApiKey();
    mockLlm({ plan: [{ chip: "wildcard", decision: "play-now", gw: 20, reason: "Fixture swing now." }] });
    const out = await orchestrateChips(input({ windows: [win("wildcard", 20, [])] }));
    const wc = out.find((c) => c.chip === "wildcard");
    expect(wc!.status).toBe("play-now");
    expect(wc!.triggerGw).toBe(20);
    expect(wc!.reason).toBe("Fixture swing now.");
  });

  it("drops an invented gameweek — sequence to a gw with no window keeps the window", async () => {
    stubApiKey();
    mockLlm({ plan: [{ chip: "freeHit", decision: "sequence", gw: 31, reason: "later" }] });
    const out = await orchestrateChips(input({ windows: [win("freeHit", 26)] })); // only 26 is real
    const fh = out.find((c) => c.chip === "freeHit");
    expect(fh!.status).toBe("window");
    expect(fh!.triggerGw).toBe(26); // not the invented 31
  });

  it("allows a single-fixture Triple Captain with no TC window (the exception)", async () => {
    stubApiKey();
    mockLlm({ plan: [{ chip: "tripleCaptain", decision: "play-now", gw: 20, reason: "Weak opponent, in form, nailed." }] });
    const out = await orchestrateChips(input({ windows: [] })); // no TC window exists
    const tc = out.find((c) => c.chip === "tripleCaptain");
    expect(tc).toBeDefined();
    expect(tc!.status).toBe("play-now");
    expect(tc!.triggerGw).toBe(20);
  });

  it("enforces one chip per gameweek (only the first play-now wins)", async () => {
    stubApiKey();
    mockLlm({
      plan: [
        { chip: "wildcard", decision: "play-now", gw: 20, reason: "a" },
        { chip: "benchBoost", decision: "play-now", gw: 20, reason: "b" },
      ],
    });
    const out = await orchestrateChips(input({ windows: [win("wildcard", 20, []), win("benchBoost", 20)] }));
    expect(out.filter((c) => c.status === "play-now")).toHaveLength(1);
    expect(out.find((c) => c.chip === "wildcard")!.status).toBe("play-now");
    expect(out.find((c) => c.chip === "benchBoost")!.status).toBe("window");
  });

  it("falls back to the deterministic windows on a malformed reply", async () => {
    stubApiKey();
    vi.spyOn(llm, "complete").mockResolvedValue("not json at all");
    const windows = [win("benchBoost", 25)];
    const out = await orchestrateChips(input({ windows }));
    expect(out).toEqual(windows);
  });

  it("grounds the prompt in chips.md + the windows + the captain signals", async () => {
    stubApiKey();
    const spy = mockLlm({ plan: [] });
    await orchestrateChips(input({ windows: [win("benchBoost", 25)] }));
    const args = spy.mock.calls[0][0];
    expect(args.system).toMatch(/Bench Boost/); // chips.md grounding
    expect(args.prompt).toMatch(/benchBoost/); // the candidate windows
    expect(args.prompt).toMatch(/Haaland/); // the captain signals
    expect(args.prompt).toMatch(/second half/i); // GW20 → names the correct half
  });

  it("names the first half before the first-half deadline", async () => {
    stubApiKey();
    const spy = mockLlm({ plan: [] });
    await orchestrateChips(input({ currentGw: 10, windows: [win("benchBoost", 15)] }));
    expect(spy.mock.calls[0][0].prompt).toMatch(/first half/i);
  });
});
