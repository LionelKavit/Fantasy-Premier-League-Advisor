import type { ManagerProfile, GameweekFlags, Fixture, Pick } from "../types";
import type { SquadAnalysisResult, ScoredPlayer } from "../pipeline/types";
import type { TripleCaptainAdvice } from "../captain/types";
import type {
  ValidTransfer,
  SingleTransferResult,
  HitTransferResult,
  ChipRecommendation,
  TransferAction,
} from "./types";

export function evaluateChipInteractions(
  analysis: SquadAnalysisResult,
  managerProfile: ManagerProfile,
  validTransfers: ValidTransfer[],
  gwFlags: GameweekFlags[],
  singleResult: SingleTransferResult,
  _hitResult: HitTransferResult,
  fixtures: Fixture[] = [],
  tripleCaptainAdvice?: TripleCaptainAdvice
): ChipRecommendation[] {
  const chips = managerProfile.chipsRemaining;
  const currentGw = analysis.currentGw;
  const recommendations: ChipRecommendation[] = [];

  const wildcardRec = evaluateWildcard(chips.wildcard, validTransfers, currentGw);
  const freeHitRec = evaluateFreeHit(
    chips.freeHit,
    gwFlags,
    analysis.rankedSquad,
    currentGw
  );
  const benchBoostRec = evaluateBenchBoost(
    chips.benchBoost,
    gwFlags,
    analysis.rankedSquad,
    currentGw,
    analysis.picks
  );
  const tripleCaptainRec = evaluateTripleCaptain(
    chips.tripleCaptain,
    gwFlags,
    analysis.rankedSquad,
    currentGw,
    fixtures,
    tripleCaptainAdvice
  );

  if (wildcardRec) recommendations.push(wildcardRec);
  if (freeHitRec) recommendations.push(freeHitRec);

  if (wildcardRec && benchBoostRec && benchBoostRec.triggerGw === wildcardRec.triggerGw) {
    const nextDgw = gwFlags.find(
      (f) => f.isDGW && f.gameweek > wildcardRec.triggerGw
    );
    if (nextDgw) {
      benchBoostRec.triggerGw = nextDgw.gameweek;
      benchBoostRec.reason += ` (deferred from GW${wildcardRec.triggerGw} due to wildcard)`;
      recommendations.push(benchBoostRec);
    }
  } else if (benchBoostRec) {
    recommendations.push(benchBoostRec);
  }

  if (tripleCaptainRec) recommendations.push(tripleCaptainRec);

  return recommendations;
}

function evaluateWildcard(
  remaining: number,
  validTransfers: ValidTransfer[],
  currentGw: number
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  const beneficial = validTransfers.filter((vt) => vt.gw1Gain > 0.05);
  if (beneficial.length < 3) return null;

  const alteredTransfers: TransferAction = {
    type: "WILDCARD",
    transfers: beneficial,
    netPointsCost: 0,
    netGain: beneficial.reduce((sum, vt) => sum + vt.gw1Gain, 0),
    breakEvenGw: null,
  };

  return {
    chip: "wildcard",
    triggerGw: currentGw,
    reason: `${beneficial.length} beneficial transfers available (all with gw1Gain > 0.05). Wildcard makes them all free.`,
    alteredTransfers,
  };
}

function evaluateFreeHit(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  const nearbyBgw = gwFlags.find(
    (f) => f.isBGW && f.gameweek >= currentGw && f.gameweek <= currentGw + 3
  );
  if (!nearbyBgw) return null;

  const blankSquadPlayers = squad.filter((sp) =>
    nearbyBgw.blankTeams.includes(sp.player.teamId)
  );
  if (blankSquadPlayers.length < 3) return null;

  const names = blankSquadPlayers
    .slice(0, 5)
    .map((sp) => sp.player.webName)
    .join(", ");

  return {
    chip: "freeHit",
    triggerGw: nearbyBgw.gameweek,
    reason: `BGW${nearbyBgw.gameweek}: ${blankSquadPlayers.length} squad players blank (${names}).`,
    alteredTransfers: null,
  };
}

function evaluateBenchBoost(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number,
  picks: Pick[]
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  const nearbyDgw = gwFlags.find(
    (f) => f.isDGW && f.gameweek >= currentGw && f.gameweek <= currentGw + 3
  );
  if (!nearbyDgw) return null;

  const benchPlayerIds = new Set(
    picks.filter((p) => p.position >= 12).map((p) => p.element)
  );
  const benchPlayers = squad.filter((sp) => benchPlayerIds.has(sp.player.id));

  if (benchPlayers.length === 0) return null;

  const avgBenchScore =
    benchPlayers.reduce((sum, sp) => sum + sp.score.total, 0) /
    benchPlayers.length;

  if (avgBenchScore <= 0.4) return null;

  const names = benchPlayers.map((sp) => sp.player.webName).join(", ");

  return {
    chip: "benchBoost",
    triggerGw: nearbyDgw.gameweek,
    reason: `DGW${nearbyDgw.gameweek}: bench (${names}) avg score ${avgBenchScore.toFixed(2)} (above 0.40 threshold).`,
    alteredTransfers: null,
  };
}

function evaluateTripleCaptain(
  remaining: number,
  gwFlags: GameweekFlags[],
  squad: ScoredPlayer[],
  currentGw: number,
  fixtures: Fixture[],
  advice?: TripleCaptainAdvice
): ChipRecommendation | null {
  if (remaining <= 0) return null;

  // Prefer the captain pipeline's advice (single source of truth) when provided.
  if (advice !== undefined) {
    if (!advice.recommended || advice.targetGw === null) return null;
    return {
      chip: "tripleCaptain",
      triggerGw: advice.targetGw,
      reason: advice.reasoning,
      alteredTransfers: null,
    };
  }

  // Fallback heuristic when captain advice is not available (no regression).
  const nearbyDgw = gwFlags.find(
    (f) => f.isDGW && f.gameweek >= currentGw && f.gameweek <= currentGw + 2
  );
  if (!nearbyDgw) return null;

  const bestPlayer = squad[0];
  if (!bestPlayer) return null;

  if (!nearbyDgw.doubleTeams.includes(bestPlayer.player.teamId)) return null;

  const dgwFixtures = fixtures.filter(
    (f) =>
      f.event === nearbyDgw.gameweek &&
      (f.team_h === bestPlayer.player.teamId ||
        f.team_a === bestPlayer.player.teamId)
  );

  if (dgwFixtures.length < 2) return null;

  const fdrs = dgwFixtures.map((f) =>
    f.team_h === bestPlayer.player.teamId
      ? f.team_h_difficulty
      : f.team_a_difficulty
  );

  if (fdrs.some((fdr) => fdr > 2)) return null;

  return {
    chip: "tripleCaptain",
    triggerGw: nearbyDgw.gameweek,
    reason: `DGW${nearbyDgw.gameweek}: ${bestPlayer.player.webName} has double fixtures with FDR ${fdrs.join(" & ")} (both ≤ 2).`,
    alteredTransfers: null,
  };
}
