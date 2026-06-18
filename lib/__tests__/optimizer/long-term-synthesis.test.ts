import { describe, it, expect, afterEach, vi } from "vitest";
import { synthesizeLongTerm, type LongTermInput } from "../../optimizer/long-term-synthesis";
import type { HorizonEntry } from "../../optimizer/types";
import { llm } from "../../llm/client";
import { makeScoredPlayer, makeChips, makeManagerProfile } from "../factories";
import { mockClaudeSuccess, mockClaudeError, stubApiKey, clearApiKey, restoreClaude } from "../mock-claude";

afterEach(restoreClaude);

function horizonEntry(): HorizonEntry {
  return {
    candidate: makeScoredPlayer({ player: { webName: "Saka" } }),
    weakPlayer: makeScoredPlayer({ player: { webName: "Groß" } }),
    gwScores: [],
    cumulativeGain: [0.1, 0.2, 0.3, 0.4, 0.5],
    fixtureSwing: false,
    timing: "BUY_NOW",
  };
}

function input(overrides: Partial<LongTermInput> = {}): LongTermInput {
  return {
    horizon: [horizonEntry()],
    chipRecommendations: [],
    restructureOptions: [],
    chipsRemaining: makeChips({ wildcard: 1 }),
    currentGw: 20,
    riskProfile: makeManagerProfile().riskProfile,
    ...overrides,
  };
}

describe("synthesizeLongTerm", () => {
  it("returns the model's prose on success", async () => {
    stubApiKey();
    mockClaudeSuccess("Bring in Saka now, then save your Wildcard for the GW28 double.");
    const out = await synthesizeLongTerm(input());
    expect(out).toBe("Bring in Saka now, then save your Wildcard for the GW28 double.");
  });

  it("returns null when the API key is missing", async () => {
    clearApiKey();
    expect(await synthesizeLongTerm(input())).toBeNull();
  });

  it("returns null on an API error", async () => {
    stubApiKey();
    mockClaudeError(500);
    expect(await synthesizeLongTerm(input())).toBeNull();
  });

  it("returns null on empty content", async () => {
    stubApiKey();
    mockClaudeSuccess("   ");
    expect(await synthesizeLongTerm(input())).toBeNull();
  });

  it("skips the call (returns null) when there is nothing to plan", async () => {
    stubApiKey();
    // No horizon and no chip recommendations → should not call the model at all.
    const spy = vi.spyOn(llm, "complete");
    const out = await synthesizeLongTerm(input({ horizon: [], chipRecommendations: [] }));
    expect(out).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
