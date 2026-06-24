import type { ManagerProfile } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer, SingleTransferResult } from "./types";
import { validateTransfer } from "./setup";
import { TRANSFER_THRESHOLDS, FREE_TRANSFER_RANGE } from "../config";

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

  // Transfer-vs-hold gate (transfer-hold-threshold): only recommend the top transfer if its
  // projected points gain clears the bar — a hit must beat its 4-pt cost; a free move must
  // beat the free-transfer opportunity cost. Composite gw1Gain is a squashed 0–1 score with
  // no "worth it" line, so the decision is denominated in `ep_next` (expected points). When
  // ep_next is unavailable we HOLD — transfers chosen on the composite alone are negative-EV
  // (squad-eval calibration), so we don't spend a transfer without FPL's projection.
  const best = sorted[0];
  const inEp = best.candidate.player.epNext;
  const outEp = best.weakPlayer.player.epNext;
  const deltaEp = inEp !== null && outEp !== null ? inEp - outEp : null;
  const needsHit = freeTransfers < 1;
  const epBar = needsHit ? TRANSFER_THRESHOLDS.hitCostEp : TRANSFER_THRESHOLDS.freeTransferEp;
  const clearsThreshold = deltaEp !== null && deltaEp > epBar;

  if (!clearsThreshold) {
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

  const bestSingle = best;
  const alternatives = sorted.slice(1, 4);

  // Stack up to `freeTransfers` free moves. Only when at least one transfer is free
  // — at 0 FT the seed move is a hit (handled via bestSingle + the hit evaluator),
  // so there are no free moves to commit.
  const freeMoves =
    freeTransfers >= 1
      ? buildFreeMoves(best, sorted, freeTransfers, analysis, bank, squadTeamCounts)
      : [];
  const bestSecond = freeMoves[1] ?? null;

  const savingsOption = findSavingsOption(validTransfers);

  return { freeMoves, bestSingle, bestSecond, alternatives, savingsOption, rollReason: null, holdReason: null };
}

// Whether a transfer's projected-points edge clears the free-transfer bar. Applied
// to EVERY stacked free move, so a marginal extra move is banked, not forced.
function clearsFreeTransferBar(vt: ValidTransfer): boolean {
  const inEp = vt.candidate.player.epNext;
  const outEp = vt.weakPlayer.player.epNext;
  if (inEp === null || outEp === null) return false;
  return inEp - outEp > TRANSFER_THRESHOLDS.freeTransferEp;
}

// Greedily stack free transfers on top of the seed move: each iteration picks the
// best remaining legal + worthwhile move from any weak spot, re-deriving the running
// bank and club counts after each pick, until `freeTransfers` is reached or nothing
// else clears the bar. Generalizes the old single "best second" (incl. its budget
// unlock) to N moves. Without squad context it falls back to the supplied list.
function buildFreeMoves(
  seed: ValidTransfer,
  sortedValid: ValidTransfer[],
  freeTransfers: number,
  analysis?: SquadAnalysisResult,
  bank?: number,
  squadTeamCounts?: Map<number, number>
): ValidTransfer[] {
  const moves: ValidTransfer[] = [seed];
  if (freeTransfers <= 1) return moves;

  const usedWeakIds = new Set<number>([seed.weakPlayer.player.id]);
  const usedCandidateIds = new Set<number>([seed.candidate.player.id]);

  // No squad context → can't re-validate budget/club limits after each move, so
  // stack the next-best moves from the supplied list that sell a different player
  // and still clear the free-transfer bar.
  if (!analysis || bank === undefined || !squadTeamCounts) {
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

  let runningBank = bank;
  const runningCounts = new Map(squadTeamCounts);
  const applyMove = (m: ValidTransfer) => {
    runningBank += m.weakPlayer.player.price - m.candidate.player.price;
    const sellTeam = m.weakPlayer.player.teamId;
    runningCounts.set(sellTeam, (runningCounts.get(sellTeam) ?? 1) - 1);
    const buyTeam = m.candidate.player.teamId;
    runningCounts.set(buyTeam, (runningCounts.get(buyTeam) ?? 0) + 1);
    usedWeakIds.add(m.weakPlayer.player.id);
    usedCandidateIds.add(m.candidate.player.id);
  };
  applyMove(seed);

  while (moves.length < freeTransfers) {
    let bestNext: ValidTransfer | null = null;
    for (const ws of analysis.weakSpots) {
      if (usedWeakIds.has(ws.player.player.id)) continue;
      for (const target of ws.targets) {
        if (usedCandidateIds.has(target.candidate.player.id)) continue;
        const vt = validateTransfer(
          ws.player,
          target.candidate,
          runningBank,
          runningCounts,
          { gw1Gain: target.gw1Gain, gw5Gain: target.gw5Gain }
        );
        if (!vt || vt.gw1Gain <= 0 || !clearsFreeTransferBar(vt)) continue;
        if (!bestNext || vt.gw1Gain > bestNext.gw1Gain) bestNext = vt;
      }
    }
    if (!bestNext) break;
    moves.push(bestNext);
    applyMove(bestNext);
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
