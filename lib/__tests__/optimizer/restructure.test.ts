import { describe, it, expect } from "vitest";
import { findRestructureCandidates } from "../../optimizer/restructure";
import { transferBar, transferCost } from "../../optimizer/allocate";
import type { ScoredPlayer, WeakSpot } from "../../pipeline/types";
import { makeScoredPlayer, makePlayer, makeSquadAnalysisResult } from "../factories";

/**
 * Scenario: a £9.5m dream MID is unaffordable. The manager owns a £9.0m DEF
 * (rank 4–12) that can be downgraded to a cheap £4.5m DEF, freeing funds.
 *   budget = weak(5) + bank(0.5) + freed(9-4.5=4.5) = 10 ≥ 9.5  ✓
 * Decision is ep-denominated:
 *   netEp = (dream.ep − weak.ep) + (replacement.ep − downgraded.ep)
 *         = (dreamEp − 3) + (3.0 − 3.5) = dreamEp − 3.5
 * dreamEp 6 → netEp +2.5.
 */
function scenario(dreamEp: number | null = 6) {
  const dream = makeScoredPlayer({ total: 0.75, player: { id: 100, position: "MID", price: 9.5, webName: "Dream", epNext: dreamEp } });
  const weak = makeScoredPlayer({ total: 0.35, player: { id: 13, position: "MID", price: 5, webName: "Weak", epNext: 3 } });
  const downgraded = makeScoredPlayer({ total: 0.55, player: { id: 5, position: "DEF", price: 9, teamId: 7, webName: "Down", epNext: 3.5 } });

  // 15-player ranked squad: top3, downgraded at rank4 (index 3), fillers, weakSpots.
  const top3 = [0, 1, 2].map((i) => makeScoredPlayer({ total: 0.9 - i * 0.01, player: { id: 200 + i, position: "MID", price: 7 } }));
  const fillers = Array.from({ length: 8 }, (_, i) => makeScoredPlayer({ total: 0.6 - i * 0.01, player: { id: 300 + i, position: "MID", price: 6 } }));
  const w2 = makeScoredPlayer({ total: 0.34, player: { id: 14, position: "FWD", price: 6 } });
  const w3 = makeScoredPlayer({ total: 0.33, player: { id: 15, position: "DEF", price: 4 } });
  const rankedSquad: ScoredPlayer[] = [...top3, downgraded, ...fillers, weak, w2, w3];

  const weakSpots: WeakSpot[] = [
    { player: weak, whyWeak: ["weak"], targets: [{ candidate: dream, gw1Gain: 0.4, gw5Gain: 0.4, fitsBudget: false, restructureNeeded: true }] },
    { player: w2, whyWeak: ["weak"], targets: [] },
    { player: w3, whyWeak: ["weak"], targets: [] },
  ];

  const analysis = makeSquadAnalysisResult({ rankedSquad, weakSpots, bank: 0.5, currentGw: 20 });
  // Cheap available DEF replacement (low minutes → composite fallback 0.30, clears the floor).
  const replacement = makePlayer({ id: 500, position: "DEF", price: 4.5, minutes: 100, teamId: 11, webName: "Cheap", epNext: 3.0 });
  return { analysis, allPlayers: [replacement] };
}

describe("findRestructureCandidates", () => {
  it("finds a viable sell-to-fund chain with a positive ep net and both legs", () => {
    const { analysis, allPlayers } = scenario();
    const cands = findRestructureCandidates(analysis, allPlayers, [], []);
    expect(cands.length).toBeGreaterThanOrEqual(1);
    const c = cands[0];
    expect(c.dreamTarget.candidate.player.id).toBe(100);
    expect(c.dreamTarget.weakPlayer.player.id).toBe(13);
    expect(c.downgradedPlayer.player.id).toBe(5);
    expect(c.downgradeReplacement.player.id).toBe(500);
    expect(c.downgradeTransfer.weakPlayer.player.id).toBe(5);
    expect(c.downgradeTransfer.candidate.player.id).toBe(500);
    expect(c.netEp).toBeCloseTo(2.5);
  });

  it("excludes a chain whose ep net is not positive", () => {
    // dreamEp 3.3 → netEp = 3.3 − 3.5 = −0.2.
    const { analysis, allPlayers } = scenario(3.3);
    expect(findRestructureCandidates(analysis, allPlayers, [], [])).toHaveLength(0);
  });

  it("skips a chain when a projection is missing", () => {
    const { analysis, allPlayers } = scenario(null);
    expect(findRestructureCandidates(analysis, allPlayers, [], [])).toHaveLength(0);
  });

  it("returns nothing when there are no restructure-needed dream targets", () => {
    const analysis = makeSquadAnalysisResult();
    expect(findRestructureCandidates(analysis, [], [], [])).toHaveLength(0);
  });
});

describe("transferBar / transferCost — two-move restructure gate and cost", () => {
  it("prices a 2-move chain by free transfers available", () => {
    expect(transferCost(2, 2)).toBe(0); // both free
    expect(transferCost(2, 1)).toBe(4); // one free + one hit
    expect(transferCost(2, 0)).toBe(8); // two hits
    expect(transferCost(2, 5)).toBe(0); // plenty free
  });

  it("gates a 2-move chain by the sum of per-move bars", () => {
    expect(transferBar(2, 2)).toBeCloseTo(3.0); // 1.5 + 1.5
    expect(transferBar(2, 1)).toBeCloseTo(5.5); // 1.5 + 4
    expect(transferBar(2, 0)).toBeCloseTo(8.0); // 4 + 4
  });
});
