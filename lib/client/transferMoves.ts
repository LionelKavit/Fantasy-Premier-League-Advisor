// Group recommended transfers by out-player for display, so a player with several
// candidate replacements (e.g. on a Wildcard) reads as one line "Out → A / B / C"
// instead of a separate line per pair. Pure — a display transform over the
// optimizer's chosen transfers; it changes nothing about the recommendation.
import type { ValidTransfer } from "../optimizer/types";

const MAX_CANDIDATES = 3;

export interface GroupedMove {
  out: string;
  outId: number; // FPL element id of the out-player (opens the detail dialog)
  candidates: string[]; // web names, best-first, capped
  candidateIds: number[]; // element ids aligned with `candidates`
}

export function groupTransferMoves(transfers: ValidTransfer[]): GroupedMove[] {
  const byOut = new Map<
    number,
    { out: string; outId: number; cands: { name: string; id: number; gain: number }[] }
  >();

  for (const t of transfers) {
    const id = t.weakPlayer.player.id;
    const group = byOut.get(id) ?? { out: t.weakPlayer.player.webName, outId: id, cands: [] };
    group.cands.push({ name: t.candidate.player.webName, id: t.candidate.player.id, gain: t.gw1Gain });
    byOut.set(id, group);
  }

  return Array.from(byOut.values())
    .map((g) => {
      const sorted = [...g.cands].sort((a, b) => b.gain - a.gain).slice(0, MAX_CANDIDATES);
      return {
        out: g.out,
        outId: g.outId,
        candidates: sorted.map((c) => c.name),
        candidateIds: sorted.map((c) => c.id),
        bestGain: sorted[0]?.gain ?? 0,
      };
    })
    .sort((a, b) => b.bestGain - a.bestGain)
    .map(({ out, outId, candidates, candidateIds }) => ({ out, outId, candidates, candidateIds }));
}
