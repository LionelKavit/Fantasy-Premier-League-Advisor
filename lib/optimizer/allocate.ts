import type { ScoredPlayer, WeakSpot } from "../pipeline/types";
import type { ValidTransfer, RestructureCandidate } from "./types";
import { TRANSFER_THRESHOLDS } from "../config";

// Opportunity cost of spending one free transfer now instead of banking it.
const FREE_BAR = TRANSFER_THRESHOLDS.freeTransferEp; // 1.5
const HIT_BAR = TRANSFER_THRESHOLDS.hitCostEp; // 4

// The ep a move must clear to be worth making, given how many of the transfers it
// spends are free vs paid hits — the same gate straight transfers use, summed over a
// move's transfers. A free transfer costs its banking opportunity (1.5); a hit costs 4.
export function transferBar(transfers: number, freeAvailable: number): number {
  const free = Math.max(0, Math.min(transfers, freeAvailable));
  const hits = transfers - free;
  return free * FREE_BAR + hits * HIT_BAR;
}

// Points actually paid for a move of `transfers` legs given the free transfers
// available to it: one −4 hit per leg beyond the free allowance.
export function transferCost(transfers: number, freeAvailable: number): number {
  return Math.max(0, transfers - freeAvailable) * HIT_BAR;
}

function epDelta(into: ScoredPlayer, out: ScoredPlayer): number | null {
  const a = into.player.epNext;
  const b = out.player.epNext;
  if (a === null || b === null) return null;
  return a - b;
}

function isAvailable(sp: ScoredPlayer): boolean {
  const s = sp.player.availability.status;
  return s !== "injured" && s !== "suspended" && s !== "unavailable";
}

// A candidate move: a straight swap (one transfer) or a restructure (two linked
// transfers). Budget/club effects are precomputed so a chosen set can be validated
// as a whole (sells-first, so only the final cash and club counts must hold).
interface Move {
  transfers: ValidTransfer[];
  cost: number; // 1 (swap) or 2 (restructure)
  epGain: number;
  surplus: number; // epGain − FREE_BAR × cost; all candidate moves have surplus > 0
  soldIds: number[];
  boughtIds: number[];
  cashDelta: number; // Σ sold price − Σ bought price
  teamDelta: Map<number, number>;
  sortKey: number; // lowest sold id — deterministic tie-break / display order
}

function makeMove(transfers: ValidTransfer[], epGain: number): Move {
  const soldIds: number[] = [];
  const boughtIds: number[] = [];
  let cashDelta = 0;
  const teamDelta = new Map<number, number>();
  for (const t of transfers) {
    soldIds.push(t.weakPlayer.player.id);
    boughtIds.push(t.candidate.player.id);
    cashDelta += t.weakPlayer.player.price - t.candidate.player.price;
    teamDelta.set(t.weakPlayer.player.teamId, (teamDelta.get(t.weakPlayer.player.teamId) ?? 0) - 1);
    teamDelta.set(t.candidate.player.teamId, (teamDelta.get(t.candidate.player.teamId) ?? 0) + 1);
  }
  const cost = transfers.length;
  return {
    transfers,
    cost,
    epGain,
    surplus: epGain - FREE_BAR * cost,
    soldIds,
    boughtIds,
    cashDelta,
    teamDelta,
    sortKey: Math.min(...soldIds),
  };
}

// Swap candidates from the budget-fitting transfers AND every weak-spot target
// (incl. ones that only become affordable once another move frees cash). Each must
// clear the free-transfer ep bar; duplicates (same out→in) are dropped.
function buildSwapMoves(validTransfers: ValidTransfer[], weakSpots: WeakSpot[]): Move[] {
  const seen = new Set<string>();
  const moves: Move[] = [];
  const add = (out: ScoredPlayer, into: ScoredPlayer) => {
    const key = `${out.player.id}->${into.player.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!isAvailable(into)) return;
    const ep = epDelta(into, out);
    if (ep === null || ep <= FREE_BAR) return;
    const compositeDiff = into.score.total - out.score.total;
    const vt: ValidTransfer = {
      weakPlayer: out,
      candidate: into,
      priceDelta: into.player.price - out.player.price,
      gw1Gain: compositeDiff,
      gw5Gain: compositeDiff,
      scoreDiffPct: out.score.total > 0 ? (compositeDiff / out.score.total) * 100 : 0,
    };
    moves.push(makeMove([vt], ep));
  };
  for (const vt of validTransfers) add(vt.weakPlayer, vt.candidate);
  for (const ws of weakSpots) for (const t of ws.targets) add(ws.player, t.candidate);
  return moves;
}

// Restructure candidates clear the all-free bar (both legs free) — the form they take
// when chosen into the primary plan. Marginal chains are dropped here.
function buildRestructureMoves(restructures: RestructureCandidate[]): Move[] {
  const moves: Move[] = [];
  for (const r of restructures) {
    if (r.netEp <= transferBar(2, 2)) continue; // > 3.0
    moves.push(makeMove([r.dreamTarget, r.downgradeTransfer], r.netEp));
  }
  return moves;
}

/**
 * Choose the free-transfer moves that maximize total surplus (ep net of the 1.5-pt
 * banking opportunity per transfer) within the free-transfer budget — weighing straight
 * swaps (1 transfer) against restructures (2 transfers). Conflict-free and legal as a
 * set: no player sold/bought twice, final bank ≥ 0 (sells-first), ≤ 3 per club. Returns
 * the chosen transfers flattened (a restructure contributes both legs); empty when
 * nothing clears its bar.
 */
export function allocateFreeTransfers(
  validTransfers: ValidTransfer[],
  restructures: RestructureCandidate[],
  weakSpots: WeakSpot[],
  freeTransfers: number,
  bank: number,
  squadTeamCounts: Map<number, number>
): ValidTransfer[] {
  if (freeTransfers < 1) return [];

  const moves = [...buildSwapMoves(validTransfers, weakSpots), ...buildRestructureMoves(restructures)];
  // Surplus-desc for better pruning; sortKey for deterministic ties.
  moves.sort((a, b) => b.surplus - a.surplus || a.sortKey - b.sortKey);

  const chosen: Move[] = [];
  const usedSold = new Set<number>();
  const usedBought = new Set<number>();
  let best: Move[] = [];
  let bestSurplus = 0;
  let bestCost = 0;

  const feasible = (): boolean => {
    let cash = bank;
    const counts = new Map(squadTeamCounts);
    for (const m of chosen) {
      cash += m.cashDelta;
      for (const [team, d] of m.teamDelta) counts.set(team, (counts.get(team) ?? 0) + d);
    }
    if (cash < -1e-9) return false;
    for (const v of counts.values()) if (v > 3) return false;
    return true;
  };

  const conflicts = (m: Move): boolean => {
    for (const id of m.soldIds) if (usedSold.has(id) || usedBought.has(id)) return true;
    for (const id of m.boughtIds) if (usedBought.has(id) || usedSold.has(id)) return true;
    return false;
  };

  const dfs = (start: number, costUsed: number, surplusSoFar: number) => {
    if (feasible()) {
      // Prefer more surplus; on a tie prefer fewer transfers (bank the rest).
      if (surplusSoFar > bestSurplus + 1e-9 || (Math.abs(surplusSoFar - bestSurplus) < 1e-9 && costUsed < bestCost)) {
        best = [...chosen];
        bestSurplus = surplusSoFar;
        bestCost = costUsed;
      }
    }
    for (let i = start; i < moves.length; i++) {
      const m = moves[i];
      if (costUsed + m.cost > freeTransfers) continue;
      if (conflicts(m)) continue;
      chosen.push(m);
      for (const id of m.soldIds) usedSold.add(id);
      for (const id of m.boughtIds) usedBought.add(id);
      dfs(i + 1, costUsed + m.cost, surplusSoFar + m.surplus);
      chosen.pop();
      for (const id of m.soldIds) usedSold.delete(id);
      for (const id of m.boughtIds) usedBought.delete(id);
    }
  };
  dfs(0, 0, 0);

  best.sort((a, b) => b.surplus - a.surplus || a.sortKey - b.sortKey);
  return best.flatMap((m) => m.transfers);
}
