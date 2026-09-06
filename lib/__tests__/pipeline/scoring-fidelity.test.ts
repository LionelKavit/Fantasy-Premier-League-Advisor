import { describe, it, expect } from "vitest";
import { scorePlayerLite, NEUTRAL_LLM_SIGNALS } from "../../pipeline/lite-scoring";
import { computeStatisticalSignals } from "../../pipeline/statistical-scoring";
import { computeFixtureSignals } from "../../pipeline/fixture-analyzer";
import { computeMarketSignals } from "../../pipeline/market-dynamics";
import { computeCompositeScore } from "../../pipeline/composite-scorer";
import { findCandidates } from "../../pipeline/squad-ranker";
import { makePlayer, makeScoredPlayer } from "../factories";

// scoring-path-consolidation: every ScoredPlayer declares the tier that produced it,
// and the lite tier has exactly one implementation.

const inputs = { fixtures: [], teams: [], currentGw: 10, maxEpNext: 8 };

describe("scoring fidelity", () => {
  it("scorePlayerLite is labelled lite with neutral trend + the shared neutral LLM constant", () => {
    const sp = scorePlayerLite(makePlayer({ id: 1, minutes: 900, epNext: 4 }), inputs);
    expect(sp.fidelity).toBe("lite");
    expect(sp.trendSignals).toBeNull();
    expect(sp.llmSignals).toBe(NEUTRAL_LLM_SIGNALS);
  });

  it("findCandidates output is labelled full", () => {
    const weak = makeScoredPlayer({ total: 0.2, player: { id: 100, position: "MID", teamId: 1, price: 5 } });
    const universe = [
      makePlayer({ id: 100, position: "MID", teamId: 1, price: 5, minutes: 900 }),
      makePlayer({ id: 200, position: "MID", teamId: 2, price: 5.5, minutes: 900, epNext: 5 }),
      makePlayer({ id: 300, position: "MID", teamId: 3, price: 4.5, minutes: 900, epNext: 3 }),
    ];
    const targets = findCandidates(
      weak, universe, 2, new Map([[1, 1]]), new Map([[100, weak]]),
      [], [], 10, new Map(), new Map(), 8
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(t.candidate.fidelity).toBe("full");
  });

  it("the lite tier equals a direct neutral-context composite (the block restructure.ts used to inline)", () => {
    const p = makePlayer({ id: 7, position: "DEF", minutes: 1200, epNext: 3.2, form: 4.5, price: 4.8 });
    const viaLite = scorePlayerLite(p, inputs);
    const stats = computeStatisticalSignals(p, inputs.currentGw);
    const fx = computeFixtureSignals(p, inputs.fixtures, inputs.teams, inputs.currentGw);
    const market = computeMarketSignals(p, inputs.maxEpNext);
    const direct = computeCompositeScore(stats, null, fx, market, NEUTRAL_LLM_SIGNALS, p.position, p.minutes);
    expect(viaLite.score.total).toBe(direct.total);
    expect(viaLite.score.breakdown).toEqual(direct.breakdown);
  });
});
