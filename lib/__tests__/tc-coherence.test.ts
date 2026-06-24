/**
 * Triple-captain coherence between the captain pipeline and the optimizer chip
 * node. Migrated from the original tsx harness to Vitest with typed factories.
 */
import { describe, it, expect } from "vitest";
import { deriveTripleCaptainAdvice } from "../captain/horizon";
import { evaluateChipInteractions } from "../optimizer/chip-interaction";
import type { HorizonCaptainEntry, TripleCaptainAdvice } from "../captain/types";
import type { SingleTransferResult, HitTransferResult } from "../optimizer/types";
import {
  makeCaptainCandidate,
  makeSquadAnalysisResult,
  makeManagerProfile,
  makeScoredPlayer,
  makeChips,
  makeGameweekFlags,
  makeDgw,
} from "./factories";

const horizonEntry = (
  gameweek: number,
  bestScore: number,
  isDgw: boolean,
  webName: string
): HorizonCaptainEntry => ({
  gameweek,
  bestScore,
  isDgw,
  bestCaptain: makeCaptainCandidate({ total: bestScore, isDgw, gameweek, player: { player: { webName } } }),
});

const emptySingle: SingleTransferResult = {
  freeMoves: [],
  bestSingle: null,
  bestSecond: null,
  alternatives: [],
  savingsOption: null,
  rollReason: null,
  holdReason: null,
};
const emptyHit: HitTransferResult = { singleHit: null, doubleHit: null };

describe("deriveTripleCaptainAdvice", () => {
  it("recommends on a strong DGW peak beating the baseline margin", () => {
    const horizon = [
      horizonEntry(24, 4, false, "A"),
      horizonEntry(25, 12, true, "Haaland"),
      horizonEntry(26, 5, false, "B"),
    ];
    const advice = deriveTripleCaptainAdvice(horizon, 5, true); // margin 6.25; 12 >= 6.25
    expect(advice.recommended).toBe(true);
    expect(advice.targetGw).toBe(25);
    expect(advice.targetPlayer).toBe("Haaland");
  });

  it("holds when the peak is below the margin", () => {
    const advice = deriveTripleCaptainAdvice([horizonEntry(24, 11, false, "A")], 10, true); // margin 12.5
    expect(advice.recommended).toBe(false);
    expect(advice.targetGw).toBeNull();
  });

  it("holds when the chip is unavailable", () => {
    const advice = deriveTripleCaptainAdvice([horizonEntry(25, 99, true, "Z")], 5, false);
    expect(advice.recommended).toBe(false);
  });
});

describe("evaluateChipInteractions — triple-captain coherence", () => {
  const managerProfile = makeManagerProfile({ chipsRemaining: makeChips({ tripleCaptain: 1 }) });

  it("adopts the captain's positive advice even where the heuristic would produce none", () => {
    const advice: TripleCaptainAdvice = {
      recommended: true,
      targetGw: 25,
      targetPlayer: "Haaland",
      peakScore: 12,
      baselineScore: 5,
      reasoning: "GW25 (DGW): Haaland projects 12.00, exceeding baseline.",
    };
    const recs = evaluateChipInteractions(
      makeSquadAnalysisResult({ currentGw: 20, chipsRemaining: makeChips({ tripleCaptain: 1 }) }),
      managerProfile,
      [],
      [],
      emptySingle,
      emptyHit,
      [],
      advice
    );
    const tc = recs.filter((r) => r.chip === "tripleCaptain");
    expect(tc).toHaveLength(1);
    expect(tc[0]?.triggerGw).toBe(25);
    expect(tc[0]?.reason).toBe(advice.reasoning);
  });

  it("falls back to the DGW heuristic when no advice is given, and advice='hold' suppresses it", () => {
    const star = makeScoredPlayer({ total: 0.9, player: { id: 1, teamId: 5, webName: "Star" } });
    const analysis = makeSquadAnalysisResult({
      currentGw: 20,
      rankedSquad: [star],
      chipsRemaining: makeChips({ tripleCaptain: 1 }),
    });
    const { fixtures } = makeDgw([5], 21, 2);
    const gwFlags = [makeGameweekFlags({ gameweek: 21, isDGW: true, doubleTeams: [5] })];

    const heuristic = evaluateChipInteractions(
      analysis, managerProfile, [], gwFlags, emptySingle, emptyHit, fixtures, undefined
    );
    expect(heuristic.filter((r) => r.chip === "tripleCaptain")).toHaveLength(1);

    const hold: TripleCaptainAdvice = {
      recommended: false,
      targetGw: null,
      targetPlayer: null,
      peakScore: 0,
      baselineScore: 5,
      reasoning: "Hold the chip.",
    };
    const suppressed = evaluateChipInteractions(
      analysis, managerProfile, [], gwFlags, emptySingle, emptyHit, fixtures, hold
    );
    expect(suppressed.filter((r) => r.chip === "tripleCaptain")).toHaveLength(0);
  });
});
