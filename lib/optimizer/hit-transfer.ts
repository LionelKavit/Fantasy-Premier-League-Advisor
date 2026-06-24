import type { ValidTransfer, SingleTransferResult, HitTransferResult, HitRecommendation } from "./types";

const HIT_COST = 4;

export function evaluateHitTransfers(
  validTransfers: ValidTransfer[],
  bank: number,
  squadTeamCounts: Map<number, number>,
  freeTransfers: number,
  singleResult: SingleTransferResult
): HitTransferResult {
  // Exclude every committed free move (0..N) so a move already taken for free is
  // never re-offered as a paid hit.
  const usedIds = new Set<string>(singleResult.freeMoves.map(transferKey));

  const remaining = validTransfers.filter((vt) => !usedIds.has(transferKey(vt)));

  if (remaining.length === 0) {
    return { singleHit: null, doubleHit: null };
  }

  const singleHit = evaluateSingleHit(remaining);
  const doubleHit = evaluateDoubleHit(remaining, bank, squadTeamCounts);

  return { singleHit, doubleHit };
}

function evaluateSingleHit(
  validTransfers: ValidTransfer[]
): HitRecommendation | null {
  const sorted = [...validTransfers].sort((a, b) => b.gw1Gain - a.gw1Gain);
  const best = sorted[0];

  if (!best || best.gw1Gain <= HIT_COST) return null;

  const netGain = best.gw1Gain - HIT_COST;
  const breakEvenGw =
    best.gw5Gain > 0 ? Math.ceil(HIT_COST / best.gw5Gain) : null;

  return { transfers: [best], netGain, breakEvenGw };
}

function evaluateDoubleHit(
  validTransfers: ValidTransfer[],
  bank: number,
  squadTeamCounts: Map<number, number>
): HitRecommendation | null {
  const doubleCost = HIT_COST * 2;
  let bestPair: ValidTransfer[] | null = null;
  let bestNetGain = 0;

  for (let i = 0; i < validTransfers.length; i++) {
    for (let j = i + 1; j < validTransfers.length; j++) {
      const a = validTransfers[i];
      const b = validTransfers[j];

      if (a.weakPlayer.player.id === b.weakPlayer.player.id) continue;

      const pairResult = tryPairOrdering(a, b, bank, squadTeamCounts);
      if (pairResult && pairResult.combinedGain > bestNetGain) {
        bestNetGain = pairResult.combinedGain;
        bestPair = pairResult.pair;
      }

      const reverseResult = tryPairOrdering(b, a, bank, squadTeamCounts);
      if (reverseResult && reverseResult.combinedGain > bestNetGain) {
        bestNetGain = reverseResult.combinedGain;
        bestPair = reverseResult.pair;
      }
    }
  }

  if (!bestPair || bestNetGain <= doubleCost) return null;

  const netGain = bestNetGain - doubleCost;
  const avgGw5 =
    bestPair.reduce((sum, vt) => sum + vt.gw5Gain, 0) / bestPair.length;
  const breakEvenGw = avgGw5 > 0 ? Math.ceil(doubleCost / avgGw5) : null;

  return { transfers: bestPair, netGain, breakEvenGw };
}

function tryPairOrdering(
  first: ValidTransfer,
  second: ValidTransfer,
  bank: number,
  squadTeamCounts: Map<number, number>
): { pair: ValidTransfer[]; combinedGain: number } | null {
  const bankAfterFirst =
    bank + first.weakPlayer.player.price - first.candidate.player.price;

  const secondMaxBudget = second.weakPlayer.player.price + bankAfterFirst;
  if (second.candidate.player.price > secondMaxBudget) return null;

  const counts = new Map(squadTeamCounts);

  const sellTeam1 = first.weakPlayer.player.teamId;
  counts.set(sellTeam1, (counts.get(sellTeam1) ?? 1) - 1);
  const buyTeam1 = first.candidate.player.teamId;
  counts.set(buyTeam1, (counts.get(buyTeam1) ?? 0) + 1);

  const sellTeam2 = second.weakPlayer.player.teamId;
  counts.set(sellTeam2, (counts.get(sellTeam2) ?? 1) - 1);
  const buyTeam2 = second.candidate.player.teamId;
  const countAfterBuy2 = (counts.get(buyTeam2) ?? 0) + 1;
  if (countAfterBuy2 > 3) return null;

  return {
    pair: [first, second],
    combinedGain: first.gw1Gain + second.gw1Gain,
  };
}

function transferKey(vt: ValidTransfer): string {
  return `${vt.weakPlayer.player.id}->${vt.candidate.player.id}`;
}
