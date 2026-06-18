import type { ChipRecommendation } from "@/lib/optimizer/types";
import type { ChipsRemaining } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chipName } from "./parts";

const CHIP_KEYS: (keyof ChipsRemaining)[] = ["wildcard", "freeHit", "benchBoost", "tripleCaptain"];

export function ChipTimeline({
  chipPlan,
  chipsRemaining,
  currentGw,
}: {
  chipPlan: ChipRecommendation[];
  chipsRemaining: ChipsRemaining;
  currentGw: number;
}) {
  const heldKeys = CHIP_KEYS.filter((k) => chipsRemaining[k] > 0);
  const allUsed = heldKeys.length === 0;
  const windows = [...chipPlan].sort((a, b) => a.triggerGw - b.triggerGw);

  // GW ticks from now to the furthest recommended window (min 5 ahead, capped).
  const maxGw = Math.min(38, Math.max(currentGw + 5, ...windows.map((w) => w.triggerGw)));
  const ticks: number[] = [];
  for (let gw = currentGw; gw <= maxGw; gw++) ticks.push(gw);
  const byGw = new Map(windows.map((w) => [w.triggerGw, w]));

  return (
    <div className="flex flex-col gap-3">
      {/* Chips remaining status */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Chips left:</span>
        {CHIP_KEYS.map((k) => {
          const available = chipsRemaining[k] > 0;
          return (
            <span
              key={k}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                available ? "bg-fpl-green/15 text-fpl-green" : "bg-muted text-muted-foreground line-through"
              )}
            >
              {chipName(k)}
            </span>
          );
        })}
      </div>

      {windows.length > 0 ? (
        <>
          {/* GW axis with chip markers */}
          <div className="relative">
            <div className="flex items-end justify-between">
              {ticks.map((gw) => {
                const rec = byGw.get(gw);
                return (
                  <div key={gw} className="flex flex-1 flex-col items-center gap-1">
                    {rec && (
                      <span className="rounded bg-fpl-cyan px-1 text-[8px] font-bold uppercase leading-3 text-fpl-purple">
                        {chipName(rec.chip)}
                      </span>
                    )}
                    <span className={cn("h-2 w-0.5", rec ? "bg-fpl-cyan" : "bg-border")} />
                    <span className="text-[9px] tabular-nums text-muted-foreground">{gw}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Reasons */}
          <ul className="flex flex-col gap-1.5">
            {windows.map((w, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold text-fpl-cyan">{chipName(w.chip)}</span>
                <span className="text-muted-foreground"> · GW{w.triggerGw} — {w.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm leading-snug text-muted-foreground">
          {allUsed
            ? "You've used all your chips this season — nothing left to schedule."
            : `You still hold ${heldKeys.map(chipName).join(", ")}, but no upcoming gameweek currently clears the bar to recommend playing one.`}
        </p>
      )}
    </div>
  );
}
