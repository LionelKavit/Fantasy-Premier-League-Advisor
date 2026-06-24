import { describe, it, expect } from "vitest";
import { findRestructureOptions } from "../../optimizer/restructure";
import type { ScoredPlayer, WeakSpot } from "../../pipeline/types";
import { makeScoredPlayer, makePlayer, makeSquadAnalysisResult } from "../factories";

/**
 * Scenario: a £9.5m dream MID is unaffordable. The manager owns a £9.0m DEF
 * (rank 4–12) that can be downgraded to a cheap £4.5m DEF, freeing funds.
 *   budget = weak(5) + bank(0.5) + freed(9-4.5=4.5) = 10 ≥ 9.5  ✓
 *   net = (dream 0.75 − weak 0.35) + (replacement 0.30 − downgraded 0.55) = +0.15
 */
function scenario(dreamTotal = 0.75) {
  const dream = makeScoredPlayer({ total: dreamTotal, player: { id: 100, position: "MID", price: 9.5, webName: "Dream" } });
  const weak = makeScoredPlayer({ total: 0.35, player: { id: 13, position: "MID", price: 5, webName: "Weak" } });
  const downgraded = makeScoredPlayer({ total: 0.55, player: { id: 5, position: "DEF", price: 9, teamId: 7, webName: "Down" } });

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
  const replacement = makePlayer({ id: 500, position: "DEF", price: 4.5, minutes: 100, teamId: 11, webName: "Cheap" });
  return { analysis, allPlayers: [replacement] };
}

describe("findRestructureOptions", () => {
  it("finds a viable sell-to-fund chain with positive net score change", () => {
    const { analysis, allPlayers } = scenario();
    const opts = findRestructureOptions(analysis, allPlayers, [], [], 1);
    expect(opts.length).toBeGreaterThanOrEqual(1);
    const o = opts[0];
    expect(o.dreamTarget.candidate.player.id).toBe(100);
    expect(o.downgradedPlayer.player.id).toBe(5);
    expect(o.downgradeReplacement.player.id).toBe(500);
    expect(o.netScoreChange).toBeCloseTo(0.15);
    expect(o.totalCost).toBe(4); // 1 free transfer → second move costs −4
  });

  it("charges 0 total cost with 2 free transfers", () => {
    const { analysis, allPlayers } = scenario();
    const opts = findRestructureOptions(analysis, allPlayers, [], [], 2);
    expect(opts[0].totalCost).toBe(0);
  });

  it("charges two hits (−8) for a restructure with 0 free transfers", () => {
    // Both moves are hits when no transfer is free: max(0, 2 − 0) × 4 = 8.
    const { analysis, allPlayers } = scenario();
    const opts = findRestructureOptions(analysis, allPlayers, [], [], 0);
    expect(opts[0].totalCost).toBe(8);
  });

  it("stays free above 2 free transfers", () => {
    const { analysis, allPlayers } = scenario();
    expect(findRestructureOptions(analysis, allPlayers, [], [], 5)[0].totalCost).toBe(0);
  });

  it("excludes options whose net score change is not positive", () => {
    // Dream only marginally better than weak → downgrade loss outweighs the gain.
    const { analysis, allPlayers } = scenario(0.45); // net = (0.45-0.35) + (0.30-0.55) = -0.15
    expect(findRestructureOptions(analysis, allPlayers, [], [], 1)).toHaveLength(0);
  });

  it("returns nothing when there are no restructure-needed dream targets", () => {
    const analysis = makeSquadAnalysisResult();
    expect(findRestructureOptions(analysis, [], [], [], 1)).toHaveLength(0);
  });
});
