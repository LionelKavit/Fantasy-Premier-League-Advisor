import type { ScoredPlayer, SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer } from "./types";

export function validateTransfer(
  weak: ScoredPlayer,
  candidate: ScoredPlayer,
  bank: number,
  squadTeamCounts: Map<number, number>,
  gains?: { gw1Gain: number; gw5Gain: number }
): ValidTransfer | null {
  const { status } = candidate.player.availability;
  if (status === "injured" || status === "suspended" || status === "unavailable") {
    return null;
  }

  const maxBudget = weak.player.price + bank;
  if (candidate.player.price > maxBudget) {
    return null;
  }

  const teamCount = squadTeamCounts.get(candidate.player.teamId) ?? 0;
  if (teamCount >= 3) {
    if (weak.player.teamId !== candidate.player.teamId) {
      return null;
    }
  }

  const priceDelta = candidate.player.price - weak.player.price;
  // Prefer the squad ranker's fixture-aware gains (gw1Gain uses GW1-specific FDR);
  // fall back to the composite-total diff when callers don't supply them.
  const compositeDiff = candidate.score.total - weak.score.total;
  const gw1Gain = gains?.gw1Gain ?? compositeDiff;
  const gw5Gain = gains?.gw5Gain ?? compositeDiff;
  const scoreDiffPct =
    weak.score.total > 0 ? (compositeDiff / weak.score.total) * 100 : 0;

  return {
    weakPlayer: weak,
    candidate,
    priceDelta,
    gw1Gain,
    gw5Gain,
    scoreDiffPct,
  };
}

export function buildValidTransfers(
  analysis: SquadAnalysisResult,
  bank: number,
  squadTeamCounts: Map<number, number>
): ValidTransfer[] {
  const validTransfers: ValidTransfer[] = [];

  for (const ws of analysis.weakSpots) {
    for (const target of ws.targets) {
      if (!target.fitsBudget) continue;

      const vt = validateTransfer(
        ws.player,
        target.candidate,
        bank,
        squadTeamCounts,
        { gw1Gain: target.gw1Gain, gw5Gain: target.gw5Gain }
      );
      if (vt) {
        validTransfers.push(vt);
      }
    }
  }

  return validTransfers;
}
