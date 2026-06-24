import { describe, it, expect, afterEach } from "vitest";
import { computeCompositeScore } from "../../pipeline/composite-scorer";
import { computeCaptainScore, batchComputeCaptainScores } from "../../captain/scoring";
import { selectCaptaincy, rankCaptains } from "../../captain/ranker";
import { evaluateSingleTransfer } from "../../optimizer/single-transfer";
import { evaluateHitTransfers } from "../../optimizer/hit-transfer";
import { computeHorizon } from "../../optimizer/horizon";
import { buildValidTransfers } from "../../optimizer/setup";
import { batchComputeLlmContext } from "../../pipeline/llm-context";
import type { Position } from "../../types";
import type { ValidTransfer, SingleTransferResult, HitTransferResult } from "../../optimizer/types";
import {
  makeStatisticalSignals, makeFixtureSignals, makeMarketSignals, makeLlmSignals,
  makeScoredPlayer, makePlayer, makePick, makeTeam, makeManagerProfile,
  makeSquadAnalysisResult,
} from "../factories";
import { stubApiKey, clearApiKey, mockClaudeMalformed, mockClaudeJson, restoreClaude } from "../mock-claude";

const positions: Position[] = ["GK", "DEF", "MID", "FWD"];
const noSingle: SingleTransferResult = { freeMoves: [], bestSingle: null, bestSecond: null, alternatives: [], savingsOption: null, rollReason: null, holdReason: null };
const noHit: HitTransferResult = { singleHit: null, doubleHit: null };
const counts = () => new Map<number, number>();

afterEach(restoreClaude);

describe("degenerate inputs never crash", () => {
  it("optimizer nodes handle empty inputs", () => {
    expect(evaluateSingleTransfer([], makeManagerProfile(), 1).bestSingle).toBeNull();
    expect(evaluateHitTransfers([], 0, counts(), 1, noSingle)).toEqual({ singleHit: null, doubleHit: null });
    expect(computeHorizon([], [], [], 20)).toEqual([]);
  });

  it("captain scoring handles an all-unavailable XI", () => {
    const squad = Array.from({ length: 11 }, (_, i) =>
      makeScoredPlayer({ player: { id: i + 1, teamId: 1, availability: { status: "injured", chanceOfPlayingThis: null, chanceOfPlayingNext: 0, news: "", newsAdded: null, scoutRisks: null, scoutNewsLink: null } } })
    );
    const picks = squad.map((sp, i) => makePick({ element: sp.player.id, position: i + 1 }));
    const candidates = batchComputeCaptainScores(squad, picks, [], [makeTeam({ id: 1 })], 21);
    expect(candidates.every((c) => c.captainScore.total === 0)).toBe(true);
    const sel = selectCaptaincy(rankCaptains(candidates), [], 21);
    expect(sel.captain).toBeDefined();
    expect(sel.viceCaptain).toBeNull();
  });
});

describe("boundary values and extreme magnitudes", () => {
  it("keeps composite within [0,1] across swept stat magnitudes and positions", () => {
    const sweep = [-1e6, -1, 0, 0.5, 1, 10, 1e6];
    for (const pos of positions) {
      for (const v of sweep) {
        const s = computeCompositeScore(
          makeStatisticalSignals({ goalThreat: v, assistPotential: v, formSignal: v, valueScore: v, cleanSheetRate: v, savesRate: v, defensiveScore: v, bonusEfficiency: v }),
          null, makeFixtureSignals({ fdrScore: Math.max(0, Math.min(1, v)) }), makeMarketSignals(), makeLlmSignals(),
          pos, 2000
        );
        expect(s.total).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(1);
        expect(Number.isFinite(s.total)).toBe(true);
      }
    }
  });

  it("captain score is always non-negative", () => {
    const p = makeScoredPlayer({ player: { id: 1, teamId: 1, threat: 1e6, expectedGoalsPer90: 1e6 } });
    const s = computeCaptainScore(p, [], [makeTeam({ id: 1 })], 21);
    expect(s.total).toBeGreaterThanOrEqual(0);
  });
});

describe("invariants", () => {
  it("computeCompositeScore is referentially transparent", () => {
    const args = [makeStatisticalSignals(), null, makeFixtureSignals(), makeMarketSignals(), makeLlmSignals(), "MID", 2000] as const;
    expect(computeCompositeScore(...args)).toEqual(computeCompositeScore(...args));
  });

  it("buildValidTransfers never violates budget", () => {
    const weak = makeScoredPlayer({ total: 0.3, player: { id: 13, position: "MID", price: 5 } });
    const analysis = makeSquadAnalysisResult({
      bank: 2.0,
      weakSpots: [
        {
          player: weak, whyWeak: ["x"],
          targets: [
            { candidate: makeScoredPlayer({ total: 0.6, player: { id: 50, position: "MID", price: 6.5, teamId: 2 } }), gw1Gain: 0.3, gw5Gain: 0.3, fitsBudget: true, restructureNeeded: false },
            { candidate: makeScoredPlayer({ total: 0.9, player: { id: 51, position: "MID", price: 11, teamId: 3 } }), gw1Gain: 0.6, gw5Gain: 0.6, fitsBudget: false, restructureNeeded: true },
          ],
        },
      ],
    });
    const vts: ValidTransfer[] = buildValidTransfers(analysis, analysis.bank, counts());
    for (const vt of vts) {
      expect(vt.candidate.player.price).toBeLessThanOrEqual(vt.weakPlayer.player.price + analysis.bank);
    }
    expect(vts.find((v) => v.candidate.player.id === 51)).toBeUndefined(); // over-budget excluded
  });
});

describe("scale / performance guard", () => {
  it("double-hit pair search handles a large valid-transfer set quickly", () => {
    const many: ValidTransfer[] = Array.from({ length: 50 }, (_, i) => ({
      weakPlayer: makeScoredPlayer({ player: { id: i + 1, teamId: (i % 6) + 1 } }),
      candidate: makeScoredPlayer({ player: { id: 1000 + i, teamId: (i % 6) + 1 } }),
      priceDelta: 0, gw1Gain: 5, gw5Gain: 5, scoreDiffPct: 10,
    }));
    const t0 = performance.now();
    const r = evaluateHitTransfers(many, 5, counts(), 1, noSingle);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.doubleHit).not.toBeNull();
  });
});

describe("malformed LLM payloads (batchComputeLlmContext)", () => {
  const players = [makePlayer({ id: 1 }), makePlayer({ id: 2 })];

  it("returns neutral defaults when the key is missing", async () => {
    clearApiKey();
    const m = await batchComputeLlmContext(players, [], players);
    expect(m.get(1)).toBeDefined();
    expect(m.get(1)!.rotationRisk).toBe(0);
  });

  it("falls back to defaults on a malformed response", async () => {
    stubApiKey();
    mockClaudeMalformed("not an array");
    const m = await batchComputeLlmContext(players, [], players);
    for (const p of players) expect(m.get(p.id)).toBeDefined();
  });

  it("parses and clamps a valid array response", async () => {
    stubApiKey();
    mockClaudeJson([{ id: 1, rotationRisk: 5, oopBonus: 0, injurySeverity: 0, tacticalBoost: 0, opponentKeyAbsence: 0, setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null } }]);
    const m = await batchComputeLlmContext(players, [], players);
    expect(m.get(1)!.rotationRisk).toBeLessThanOrEqual(1); // clamped from 5
  });
});
