import { describe, it, expect, beforeEach } from "vitest";
import { loadKnowledge, _clearKnowledgeCache } from "../../knowledge";
import { buildLongTermPrompt, type LongTermInput } from "../../optimizer/long-term-synthesis";

describe("loadKnowledge", () => {
  beforeEach(() => _clearKnowledgeCache());

  it("loads chips.md with the key two-halves rule + canonical timing", () => {
    const md = loadKnowledge("chips");
    expect(md.length).toBeGreaterThan(200);
    expect(md).toMatch(/GW19/);
    expect(md).toMatch(/Bench Boost/);
    expect(md).toMatch(/Free Hit/);
  });

  it("returns '' for a missing file (grounding is optional, never throws)", () => {
    expect(loadKnowledge("does-not-exist")).toBe("");
  });

  it("caches the result", () => {
    expect(loadKnowledge("chips")).toBe(loadKnowledge("chips"));
  });
});

describe("buildLongTermPrompt grounding", () => {
  const input: LongTermInput = {
    horizon: [],
    chipRecommendations: [{ chip: "benchBoost", triggerGw: 25, reason: "DGW", alteredTransfers: null }],
    restructureOptions: [],
    chipsRemaining: { wildcard: 1, freeHit: 1, benchBoost: 1, tripleCaptain: 1 },
    currentGw: 20,
    riskProfile: {
      currentRank: 500000, bestRank: 400000, rankTrend: "stable",
      gwsRemaining: 18, totalHitsTaken: 2, totalHitCost: 8, avgBenchPoints: 4,
    },
  };

  it("injects the expert chip principles into the prompt", () => {
    const prompt = buildLongTermPrompt(input);
    expect(prompt).toContain("Expert chip principles");
    expect(prompt).toMatch(/two sets of chips|Two sets of chips/i);
    // the deterministic facts are still present
    expect(prompt).toContain("benchBoost");
  });
});
