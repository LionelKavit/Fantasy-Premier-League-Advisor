// Group recommended transfers by out-player for display, so a player with several
// candidate replacements (e.g. on a Wildcard) reads as one line "Out → A / B / C"
// instead of a separate line per pair. Pure — a display transform over the
// optimizer's chosen transfers; it changes nothing about the recommendation.
import type { ValidTransfer } from "../optimizer/types";

const MAX_CANDIDATES = 3;

export interface GroupedMove {
  out: string;
  candidates: string[]; // web names, best-first, capped
}

export function groupTransferMoves(transfers: ValidTransfer[]): GroupedMove[] {
  const byOut = new Map<number, { out: string; cands: { name: string; gain: number }[] }>();

  for (const t of transfers) {
    const id = t.weakPlayer.player.id;
    const group = byOut.get(id) ?? { out: t.weakPlayer.player.webName, cands: [] };
    group.cands.push({ name: t.candidate.player.webName, gain: t.gw1Gain });
    byOut.set(id, group);
  }

  return Array.from(byOut.values())
    .map((g) => {
      const sorted = [...g.cands].sort((a, b) => b.gain - a.gain);
      return {
        out: g.out,
        candidates: sorted.slice(0, MAX_CANDIDATES).map((c) => c.name),
        bestGain: sorted[0]?.gain ?? 0,
      };
    })
    .sort((a, b) => b.bestGain - a.bestGain)
    .map(({ out, candidates }) => ({ out, candidates }));
}
