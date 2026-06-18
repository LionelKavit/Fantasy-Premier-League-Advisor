import type { ScoutContext } from "./scout/context";
import { scorePlayerEnriched } from "./scout/context";
import { validateTransfer } from "./optimizer/setup";
import { computeCaptainScore } from "./captain/scoring";

export interface TransferSimResult {
  legal: boolean;
  reason?: string;
  out?: { id: number; name: string; price: number; score: number };
  in?: { id: number; name: string; price: number; score: number };
  priceDelta?: number; // £m, positive = more expensive
  bankAfter?: number; // £m remaining after the move
  scoreDeltaGw1?: number; // composite gain this GW
  scoreDeltaGw5?: number; // composite gain over the 5-GW run
}

export interface CaptainSimResult {
  id: number;
  name: string;
  captainScore: number;
  isDgw: boolean;
  blank: boolean; // no fixture this GW → cannot captain
  currentBest: { id: number; name: string; score: number } | null;
  delta: number; // captainScore − currentBest.score
  isImprovement: boolean;
}

function squadTeamCounts(sc: ScoutContext): Map<number, number> {
  const counts = new Map<number, number>();
  for (const sp of sc.ctx.analysis.rankedSquad) {
    counts.set(sp.player.teamId, (counts.get(sp.player.teamId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Lightweight transfer "what-if": validates the swap against budget, the 3-per-
 * team cap, and availability, then reports the score/price delta. No re-plan,
 * no extra fetches — it reuses the cached analysis and lightweight scoring.
 */
export async function simulateTransfer(
  input: { outId: number; inId: number },
  sc: ScoutContext
): Promise<TransferSimResult> {
  const { outId, inId } = input;
  const bank = sc.ctx.analysis.bank;

  const outSP = sc.ctx.analysis.rankedSquad.find((sp) => sp.player.id === outId);
  if (!outSP) {
    const p = sc.playersById.get(outId);
    return { legal: false, reason: `${p?.webName ?? `Player ${outId}`} is not in your squad — nothing to transfer out.` };
  }

  const inPlayer = sc.playersById.get(inId);
  if (!inPlayer) {
    return { legal: false, reason: `Could not find the incoming player (id ${inId}).` };
  }
  if (sc.ctx.analysis.rankedSquad.some((sp) => sp.player.id === inId)) {
    return { legal: false, reason: `${inPlayer.webName} is already in your squad.` };
  }

  const inSP = await scorePlayerEnriched(inPlayer, sc);
  const counts = squadTeamCounts(sc);
  const vt = validateTransfer(outSP, inSP, bank, counts);

  if (!vt) {
    // Re-derive the specific reason for a useful message.
    const status = inPlayer.availability.status;
    if (status === "injured" || status === "suspended" || status === "unavailable") {
      return { legal: false, reason: `${inPlayer.webName} is currently ${status}.` };
    }
    const maxBudget = outSP.player.price + bank;
    if (inPlayer.price > maxBudget) {
      return {
        legal: false,
        reason: `Not enough budget: ${inPlayer.webName} costs £${inPlayer.price.toFixed(1)}m but selling ${outSP.player.webName} only frees £${maxBudget.toFixed(1)}m.`,
      };
    }
    if ((counts.get(inPlayer.teamId) ?? 0) >= 3 && outSP.player.teamId !== inPlayer.teamId) {
      return { legal: false, reason: `You already have 3 players from ${inPlayer.teamName} — the squad rule blocks a 4th.` };
    }
    return { legal: false, reason: "That transfer is not valid." };
  }

  return {
    legal: true,
    out: { id: outSP.player.id, name: outSP.player.webName, price: outSP.player.price, score: outSP.score.total },
    in: { id: inSP.player.id, name: inSP.player.webName, price: inSP.player.price, score: inSP.score.total },
    priceDelta: vt.priceDelta,
    bankAfter: bank - vt.priceDelta,
    scoreDeltaGw1: vt.gw1Gain,
    scoreDeltaGw5: vt.gw5Gain,
  };
}

/**
 * Lightweight captaincy "what-if": scores the given player as captain this GW
 * and compares against the best option in the current starting XI.
 */
export async function simulateCaptain(
  input: { id: number },
  sc: ScoutContext
): Promise<CaptainSimResult> {
  const { ctx } = sc;
  const { fixtures, teams } = ctx;
  const gw = ctx.analysis.currentGw;

  const player = sc.playersById.get(input.id);
  const target = player ? await scorePlayerEnriched(player, sc) : null;

  // Best captain in the current starting XI (pick slots 1–11).
  const xiIds = new Set(
    ctx.analysis.picks.filter((p) => p.position <= 11).map((p) => p.element)
  );
  let currentBest: CaptainSimResult["currentBest"] = null;
  for (const sp of ctx.analysis.rankedSquad) {
    if (!xiIds.has(sp.player.id)) continue;
    const cs = computeCaptainScore(sp, fixtures, teams, gw);
    if (!currentBest || cs.total > currentBest.score) {
      currentBest = { id: sp.player.id, name: sp.player.webName, score: cs.total };
    }
  }

  if (!target) {
    return {
      id: input.id,
      name: `Player ${input.id}`,
      captainScore: 0,
      isDgw: false,
      blank: true,
      currentBest,
      delta: currentBest ? -currentBest.score : 0,
      isImprovement: false,
    };
  }

  const score = computeCaptainScore(target, fixtures, teams, gw);
  const delta = score.total - (currentBest?.score ?? 0);

  return {
    id: target.player.id,
    name: target.player.webName,
    captainScore: score.total,
    isDgw: score.isDgw,
    blank: score.total === 0,
    currentBest,
    delta,
    isImprovement: delta > 0,
  };
}
