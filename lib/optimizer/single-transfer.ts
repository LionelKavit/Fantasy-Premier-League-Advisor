import type { ManagerProfile } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer, SingleTransferResult, RestructureCandidate } from "./types";
import { TRANSFER_THRESHOLDS, FREE_TRANSFER_RANGE } from "../config";
import { allocateFreeTransfers } from "./allocate";

export function evaluateSingleTransfer(
  validTransfers: ValidTransfer[],
  _managerProfile: ManagerProfile,
  freeTransfers: number,
  analysis?: SquadAnalysisResult,
  bank?: number,
  squadTeamCounts?: Map<number, number>,
  restructureCandidates: RestructureCandidate[] = []
): SingleTransferResult {
  if (validTransfers.length === 0 && restructureCandidates.length === 0) {
    return {
      freeMoves: [],
      bestSingle: null,
      bestSecond: null,
      alternatives: [],
      savingsOption: null,
      rollReason:
        "No valid transfer targets available within budget and squad constraints.",
      holdReason: "no_valid_targets",
    };
  }

  const sorted = [...validTransfers].sort((a, b) => {
    if (b.gw1Gain !== a.gw1Gain) return b.gw1Gain - a.gw1Gain;
    return b.gw5Gain - a.gw5Gain;
  });

  // Transfer-vs-hold gate (transfer-hold-threshold): the decision is denominated in
  // `ep_next` (expected points) — a hit must beat its 4-pt cost, a free move the
  // free-transfer opportunity cost. Composite gw1Gain has no "worth it" line; when
  // ep_next is unavailable we HOLD (composite-alone transfers are negative-EV).
  const best = sorted[0] ?? null;
  const inEp = best?.candidate.player.epNext ?? null;
  const outEp = best?.weakPlayer.player.epNext ?? null;
  const deltaEp = inEp !== null && outEp !== null ? inEp - outEp : null;
  const needsHit = freeTransfers < 1;
  const epBar = needsHit ? TRANSFER_THRESHOLDS.hitCostEp : TRANSFER_THRESHOLDS.freeTransferEp;
  const seedClears = deltaEp !== null && deltaEp > epBar;
  const hasContext = !!analysis && bank !== undefined && !!squadTeamCounts;

  const alternatives = sorted.slice(1, 4);

  // At 0 FT every move is a hit: there are no free moves to commit, and the top swap
  // is recommended only if it out-projects the 4-pt hit (the hit evaluator handles the
  // rest). Restructures at 0 FT surface in the section, not here.
  if (needsHit) {
    if (best && seedClears) {
      return {
        freeMoves: [],
        bestSingle: best,
        bestSecond: null,
        alternatives,
        savingsOption: findSavingsOption(validTransfers),
        rollReason: null,
        holdReason: null,
      };
    }
    return rollResult(deltaEp, epBar, needsHit, freeTransfers, validTransfers);
  }

  // FT ≥ 1: choose the optimal free-move set (swaps + restructures) when we have squad
  // context, else fall back to a swaps-only greedy stack over the supplied list.
  const freeMoves = hasContext
    ? allocateFreeTransfers(
        validTransfers,
        restructureCandidates,
        analysis!.weakSpots,
        freeTransfers,
        bank!,
        squadTeamCounts!
      )
    : best && seedClears
      ? buildSwapFallback(best, sorted, freeTransfers)
      : [];

  if (freeMoves.length > 0) {
    return {
      freeMoves,
      bestSingle: freeMoves[0],
      bestSecond: freeMoves[1] ?? null,
      alternatives,
      savingsOption: findSavingsOption(validTransfers),
      rollReason: null,
      holdReason: null,
    };
  }

  return rollResult(deltaEp, epBar, needsHit, freeTransfers, validTransfers);
}

// Build the roll/hold result with the deterministic reason text and typed holdReason.
function rollResult(
  deltaEp: number | null,
  epBar: number,
  needsHit: boolean,
  freeTransfers: number,
  validTransfers: ValidTransfer[]
): SingleTransferResult {
  const banked = Math.min(FREE_TRANSFER_RANGE.max, freeTransfers + 1);
  const reason =
    deltaEp !== null
      ? `Best available upgrade projects +${deltaEp.toFixed(1)} pts — below the ${epBar}-pt ${needsHit ? "hit" : "free-transfer"} bar to spend a transfer.`
      : `No ep_next projection available to justify a transfer (composite alone doesn't reliably rank transfers).`;
  return {
    freeMoves: [],
    bestSingle: null,
    bestSecond: null,
    alternatives: [],
    savingsOption: findSavingsOption(validTransfers),
    rollReason: `${reason} Rolling to bank ${banked} free transfers next week.`,
    holdReason: deltaEp === null ? "ep_unavailable" : "below_threshold",
  };
}

// Whether a transfer's projected-points edge clears the free-transfer bar.
function clearsFreeTransferBar(vt: ValidTransfer): boolean {
  const inEp = vt.candidate.player.epNext;
  const outEp = vt.weakPlayer.player.epNext;
  if (inEp === null || outEp === null) return false;
  return inEp - outEp > TRANSFER_THRESHOLDS.freeTransferEp;
}

// Swaps-only greedy stack, used when no squad context is supplied (the optimal
// allocator needs the bank/club state). Stacks the next-best bar-clearing move that
// sells a different player, up to `freeTransfers`.
function buildSwapFallback(
  seed: ValidTransfer,
  sortedValid: ValidTransfer[],
  freeTransfers: number
): ValidTransfer[] {
  const moves: ValidTransfer[] = [seed];
  if (freeTransfers <= 1) return moves;

  const usedWeakIds = new Set<number>([seed.weakPlayer.player.id]);
  const usedCandidateIds = new Set<number>([seed.candidate.player.id]);
  for (const vt of sortedValid) {
    if (moves.length >= freeTransfers) break;
    if (usedWeakIds.has(vt.weakPlayer.player.id)) continue;
    if (usedCandidateIds.has(vt.candidate.player.id)) continue;
    if (vt.gw1Gain <= 0 || !clearsFreeTransferBar(vt)) continue;
    moves.push(vt);
    usedWeakIds.add(vt.weakPlayer.player.id);
    usedCandidateIds.add(vt.candidate.player.id);
  }
  return moves;
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
