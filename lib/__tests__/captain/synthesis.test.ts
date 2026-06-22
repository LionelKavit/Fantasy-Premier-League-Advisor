import { describe, it, expect, afterEach } from "vitest";
import { synthesizeCaptainPick } from "../../captain/synthesis";
import type { CaptainSynthesisInput } from "../../captain/types";
import { makeCaptainCandidate, makeManagerProfile } from "../factories";
import { mockClaudeJson, mockClaudeError, stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

afterEach(restoreClaude);

function makeInput(o: Partial<CaptainSynthesisInput> = {}): CaptainSynthesisInput {
  const cap = makeCaptainCandidate({ total: 8, player: { player: { webName: "Cap" } } });
  const alt = makeCaptainCandidate({ total: 6, player: { player: { webName: "Alt" } } });
  return {
    rankedCandidates: [cap, alt],
    viceCaptain: alt,
    differentialOption: null,
    horizon: [],
    tripleCaptainAdvice: null,
    managerProfile: makeManagerProfile(),
    currentGw: 20,
    ...o,
  };
}

describe("synthesizeCaptainPick — success path (mocked LLM)", () => {
  it("maps the chosen captain by name and keeps deterministic outputs", async () => {
    stubApiKey();
    mockClaudeJson({ captainName: "Cap", confidence: "high", narrativeSummary: "Captain Cap.", alerts: [] });
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.captain.player.player.webName).toBe("Cap");
    expect(r.confidence).toBe("high");
    expect(r.narrativeSummary).toBe("Captain Cap.");
  });

  it("clamps an invalid confidence to medium", async () => {
    stubApiKey();
    mockClaudeJson({ captainName: "Cap", confidence: "ultra", narrativeSummary: "x", alerts: [] });
    expect((await synthesizeCaptainPick(makeInput())).confidence).toBe("medium");
  });
});

describe("synthesizeCaptainPick — fail-safe and alerts", () => {
  it("falls back to the top candidate when the key is missing", async () => {
    clearApiKey();
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.captain.player.player.webName).toBe("Cap");
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => /api key not set/i.test(a))).toBe(true);
  });

  it("falls back on API error", async () => {
    stubApiKey();
    mockClaudeError(500);
    const r = await synthesizeCaptainPick(makeInput());
    expect(r.confidence).toBe("low");
    expect(r.alerts.some((a) => a.includes("500"))).toBe(true);
  });

  it("emits no synthesis alerts on the success path", async () => {
    stubApiKey();
    mockClaudeJson({ captainName: "Cap", confidence: "high", narrativeSummary: "Captain Cap.", alerts: ["LLM note"] });
    const r = await synthesizeCaptainPick(makeInput());
    // Captain availability risk now lives in lib/alerts (plan.alerts); the model's
    // free-form alerts and the TC-window reminder are no longer surfaced here.
    expect(r.alerts).toEqual([]);
  });
});
