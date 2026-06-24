import { describe, it, expect } from "vitest";
import { computeCompositeScore } from "../../pipeline/composite-scorer";
import { rankSquad, identifyWeakSpots } from "../../pipeline/squad-ranker";
import { PIPELINE_CONFIG } from "../../config";
import type { Position } from "../../types";
import {
  makeStatisticalSignals,
  makeFixtureSignals,
  makeMarketSignals,
  makeLlmSignals,
  makeTrendSignals,
  makeScoredPlayer,
} from "../factories";

const positions: Position[] = ["GK", "DEF", "MID", "FWD"];

describe("computeCompositeScore", () => {
  it("returns the fallback score with empty breakdown below the minutes minimum", () => {
    const s = computeCompositeScore(
      makeStatisticalSignals(), null, makeFixtureSignals(), makeMarketSignals(), makeLlmSignals(),
      "MID", PIPELINE_CONFIG.minMinutes - 1
    );
    expect(s.total).toBe(PIPELINE_CONFIG.insufficientDataFallbackScore);
    expect(Object.keys(s.breakdown)).toHaveLength(0);
  });

  it("keeps the total within [0,1] for every position under extreme inputs", () => {
    for (const pos of positions) {
      const hot = computeCompositeScore(
        makeStatisticalSignals({ goalThreat: 99, assistPotential: 99, formSignal: 99, bonusEfficiency: 999, valueScore: 99, cleanSheetRate: 99, defensiveScore: 99, savesRate: 99 }),
        makeTrendSignals({ additive: 1 }),
        makeFixtureSignals({ fdrScore: 1 }),
        makeMarketSignals(),
        makeLlmSignals({ oopBonus: 1, tacticalBoost: 1 }),
        pos, 2000
      );
      const cold = computeCompositeScore(
        makeStatisticalSignals({ goalThreat: -99, suspensionRisk: 1 }),
        makeTrendSignals({ additive: -1 }),
        makeFixtureSignals({ fdrScore: 0 }),
        makeMarketSignals(),
        makeLlmSignals({ rotationRisk: 1, injurySeverity: 1 }),
        pos, 2000
      );
      expect(hot.total).toBeGreaterThanOrEqual(0);
      expect(hot.total).toBeLessThanOrEqual(1);
      expect(cold.total).toBeGreaterThanOrEqual(0);
      expect(cold.total).toBeLessThanOrEqual(1);
      expect(hot.total).toBeGreaterThan(cold.total);
    }
  });

  it("stores market signals in the breakdown for downstream nodes", () => {
    const s = computeCompositeScore(
      makeStatisticalSignals(), null, makeFixtureSignals(),
      makeMarketSignals({ epNextSignal: 0.42, transferMomentum: 0.8 }), makeLlmSignals(),
      "MID", 2000
    );
    expect(s.breakdown.epNextSignal).toBeCloseTo(0.42);
    expect(s.breakdown.transferMomentum).toBeCloseTo(0.8);
  });
});

describe("rankSquad / identifyWeakSpots", () => {
  it("sorts by composite total descending", () => {
    const squad = [
      makeScoredPlayer({ total: 0.3 }),
      makeScoredPlayer({ total: 0.9 }),
      makeScoredPlayer({ total: 0.6 }),
    ];
    const ranked = rankSquad(squad);
    expect(ranked.map((s) => s.score.total)).toEqual([0.9, 0.6, 0.3]);
  });

  it("returns the weakest spots (top-5 by default), each with reasons", () => {
    const squad = Array.from({ length: 15 }, (_, i) => makeScoredPlayer({ total: 0.9 - i * 0.05 }));
    const ranked = rankSquad(squad);
    const weak = identifyWeakSpots(ranked);
    expect(weak).toHaveLength(5); // defaults to PIPELINE_CONFIG.maxWeakSpots
    for (const w of weak) expect(w.whyWeak.length).toBeGreaterThan(0);
    // Worst-first ordering: the weakest overall leads the list.
    const lowest = Math.min(...ranked.map((s) => s.score.total));
    expect(weak[0].player.score.total).toBe(lowest);
  });

  it("honours an explicit weak-spot count", () => {
    const squad = Array.from({ length: 15 }, (_, i) => makeScoredPlayer({ total: 0.9 - i * 0.05 }));
    const weak = identifyWeakSpots(rankSquad(squad), 3);
    expect(weak).toHaveLength(3);
  });
});
