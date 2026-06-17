import type { SquadPlayerView } from "@/lib/plan/types";
import { getFormation } from "@/lib/client/formation";
import { PlayerToken } from "./PlayerToken";

export function Pitch({
  squad,
  transferOutIds,
}: {
  squad: SquadPlayerView[];
  transferOutIds: Set<number>;
}) {
  const { rows, bench, formationLabel } = getFormation(squad);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Pitch — FPL gradient green */}
      <div className="relative flex flex-col justify-between gap-3 bg-gradient-to-b from-[#00a651] to-[#008a45] px-2 pb-5 pt-9 sm:gap-5 sm:pb-7 sm:pt-10">
        {/* Formation label — top centre of the pitch */}
        {formationLabel && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-[2] -translate-x-1/2">
            <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {formationLabel}
            </span>
          </div>
        )}
        {/* subtle pitch markings */}
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-white/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

        {rows.map((row) => (
          <div
            key={row.position}
            className="relative z-[1] flex items-start justify-center gap-2 sm:gap-3"
          >
            {row.players.map((p) => (
              <PlayerToken key={p.id} player={p} isTransferOut={transferOutIds.has(p.id)} />
            ))}
          </div>
        ))}
      </div>

      {/* Substitutes — darker green strip */}
      <div className="bg-[#007a3d] px-2 py-3">
        <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white/80">
          Substitutes
        </div>
        <div className="flex items-start justify-center gap-2 sm:gap-3">
          {bench.map((p) => (
            <PlayerToken key={p.id} player={p} isTransferOut={transferOutIds.has(p.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
