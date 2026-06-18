"use client";

import { useState } from "react";
import type { CaptainCandidate } from "@/lib/captain/types";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CaptainRanking({ candidates }: { candidates: CaptainCandidate[] }) {
  const [open, setOpen] = useState(false);
  const top5 = candidates.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <span>Top 5 captain options</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="mt-2 flex flex-col gap-1">
          {top5.map((c, i) => (
            <li key={c.player.player.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                {c.player.player.webName}
                {c.isDifferential && (
                  <span className="ml-1.5 rounded bg-fpl-cyan/15 px-1 text-[9px] font-bold uppercase text-fpl-cyan">
                    diff
                  </span>
                )}
              </span>
              <span className="ml-2 font-bold tabular-nums text-fpl-green">
                {c.captainScore.total.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
