import { describe, it, expect } from "vitest";
import scoringWeights from "../../scoring-weights.json";
import { SCORING_WEIGHTS, COMPOSITE_SQUASH } from "../../config";
import { computeCompositeScore } from "../../pipeline/composite-scorer";
import { makeStatisticalSignals, makeFixtureSignals, makeMarketSignals, makeLlmSignals } from "../factories";

// composite-refit-gate: weights are data (lib/scoring-weights.json) and the scorer accepts an
// offline override; omitting it must reproduce the shipped result exactly.

describe("scoring weights as data", () => {
  it("config re-exports the JSON values unchanged", () => {
    expect(SCORING_WEIGHTS).toEqual(scoringWeights.SCORING_WEIGHTS);
    expect(COMPOSITE_SQUASH).toEqual(scoringWeights.COMPOSITE_SQUASH);
    expect(SCORING_WEIGHTS.MID.epNext).toBe(12.6451);
    expect(COMPOSITE_SQUASH).toEqual({ center: 3.0965, scale: 1.8508 });
  });

  it("no override ⇒ identical to an explicit override with the shipped values", () => {
    const args = [makeStatisticalSignals(), null, makeFixtureSignals(), makeMarketSignals({ epNextSignal: 0.7 }), makeLlmSignals(), "MID", 1500] as const;
    const base = computeCompositeScore(...args);
    const same = computeCompositeScore(...args, { weights: SCORING_WEIGHTS, squash: COMPOSITE_SQUASH });
    expect(same.total).toBe(base.total);
    expect(same.breakdown).toEqual(base.breakdown);
  });

  it("an override changes the score and the squash", () => {
    const args = [makeStatisticalSignals(), null, makeFixtureSignals(), makeMarketSignals({ epNextSignal: 0.7 }), makeLlmSignals(), "MID", 1500] as const;
    const base = computeCompositeScore(...args);
    const heavier = computeCompositeScore(...args, {
      weights: { ...SCORING_WEIGHTS, MID: { ...SCORING_WEIGHTS.MID, epNext: SCORING_WEIGHTS.MID.epNext * 2 } },
      squash: COMPOSITE_SQUASH,
    });
    expect(heavier.breakdown.epNext).toBeCloseTo(base.breakdown.epNext * 2, 10);
    const recentred = computeCompositeScore(...args, { weights: SCORING_WEIGHTS, squash: { center: COMPOSITE_SQUASH.center + 5, scale: COMPOSITE_SQUASH.scale } });
    expect(recentred.total).toBeLessThan(base.total);
  });
});
