import type { ManagerProfile } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer, SingleTransferResult } from "./types";
import { validateTransfer } from "./setup";

export function evaluateSingleTransfer(
  validTransfers: ValidTransfer[],
  _managerProfile: ManagerProfile,
  freeTransfers: number,
  analysis?: SquadAnalysisResult,
  bank?: number,
  squadTeamCounts?: Map<number, number>
): SingleTransferResult {
  if (validTransfers.length === 0) {
    return {
      bestSingle: null,
      bestSecond: null,
      alternatives: [],
      savingsOption: null,
      rollReason:
        "No valid transfer targets available within budget and squad constraints.",
    };
  }

  const sorted = [...validTransfers].sort((a, b) => {
    if (b.gw1Gain !== a.gw1Gain) return b.gw1Gain - a.gw1Gain;
    return b.gw5Gain - a.gw5Gain;
  });

  const allNegative = sorted[0].gw1Gain <= 0;
  if (allNegative) {
    return {
      bestSingle: null,
      bestSecond: null,
      alternatives: [],
      savingsOption: findSavingsOption(validTransfers),
      rollReason: `No transfer improves the current GW projection. Rolling transfer to bank ${freeTransfers + 1 > 2 ? 2 : freeTransfers + 1} free transfers next week.`,
    };
  }

  const bestSingle = sorted[0];
  const alternatives = sorted.slice(1, 4);

  let bestSecond: ValidTransfer | null = null;
  if (freeTransfers >= 2 && bestSingle) {
    bestSecond = findBestSecond(
      bestSingle,
      sorted,
      analysis,
      bank,
      squadTeamCounts
    );
  }

  const savingsOption = findSavingsOption(validTransfers);

  return { bestSingle, bestSecond, alternatives, savingsOption, rollReason: null };
}

function findBestSecond(
  bestSingle: ValidTransfer,
  sortedValid: ValidTransfer[],
  analysis?: SquadAnalysisResult,
  bank?: number,
  squadTeamCounts?: Map<number, number>
): ValidTransfer | null {
  const bestWeakId = bestSingle.weakPlayer.player.id;

  const fromExisting = sortedValid.find(
    (vt) => vt.weakPlayer.player.id !== bestWeakId && vt.gw1Gain > 0
  );

  if (!analysis || bank === undefined || !squadTeamCounts) {
    return fromExisting ?? null;
  }

  const adjustedBank =
    bank + bestSingle.weakPlayer.player.price - bestSingle.candidate.player.price;

  const adjustedCounts = new Map(squadTeamCounts);
  const sellTeam = bestSingle.weakPlayer.player.teamId;
  adjustedCounts.set(sellTeam, (adjustedCounts.get(sellTeam) ?? 1) - 1);
  const buyTeam = bestSingle.candidate.player.teamId;
  adjustedCounts.set(buyTeam, (adjustedCounts.get(buyTeam) ?? 0) + 1);

  let bestUnlocked: ValidTransfer | null = null;

  for (const ws of analysis.weakest3) {
    if (ws.player.player.id === bestWeakId) continue;

    for (const target of ws.targets) {
      if (target.fitsBudget) continue;

      const vt = validateTransfer(
        ws.player,
        target.candidate,
        adjustedBank,
        adjustedCounts,
        { gw1Gain: target.gw1Gain, gw5Gain: target.gw5Gain }
      );
      if (!vt) continue;

      if (vt.gw1Gain <= 0) continue;

      if (!bestUnlocked || vt.gw1Gain > bestUnlocked.gw1Gain) {
        bestUnlocked = vt;
      }
    }
  }

  if (!fromExisting && !bestUnlocked) return null;
  if (!fromExisting) return bestUnlocked;
  if (!bestUnlocked) return fromExisting;

  return bestUnlocked.gw1Gain > fromExisting.gw1Gain
    ? bestUnlocked
    : fromExisting;
}

function findSavingsOption(
  validTransfers: ValidTransfer[]
): ValidTransfer | null {
  const qualifying = validTransfers.filter(
    (vt) => vt.priceDelta <= -0.5 && vt.gw1Gain > -0.05
  );
  if (qualifying.length === 0) return null;
  qualifying.sort((a, b) => a.priceDelta - b.priceDelta);
  return qualifying[0];
}
