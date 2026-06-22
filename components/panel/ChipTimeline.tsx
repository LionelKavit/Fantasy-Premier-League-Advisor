import type { ChipRecommendation } from "@/lib/optimizer/types";
import type { ChipsRemaining } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chipName } from "./parts";

const CHIP_KEYS: (keyof ChipsRemaining)[] = ["wildcard", "freeHit", "benchBoost", "tripleCaptain"];

export function ChipTimeline({
  chipPlan,
  chipsRemaining,
}: {
  chipPlan: ChipRecommendation[];
  chipsRemaining: ChipsRemaining;
}) {
  const heldKeys = CHIP_KEYS.filter((k) => chipsRemaining[k] > 0);
  const allUsed = heldKeys.length === 0;
  const windows = [...chipPlan].sort((a, b) => a.triggerGw - b.triggerGw);

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
          {/* Recommended chip windows, with the play-now distinguished. */}
          <ul className="flex flex-col gap-1.5">
            {windows.map((w, i) => {
              const playNow = w.status === "play-now";
              return (
                <li key={i} className="text-sm">
                  <span className={cn("font-semibold", playNow ? "text-fpl-green" : "text-fpl-cyan")}>
                    {chipName(w.chip)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}· {playNow ? "Play now" : `GW${w.triggerGw}`} — {w.reason}
                  </span>
                </li>
              );
            })}
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
