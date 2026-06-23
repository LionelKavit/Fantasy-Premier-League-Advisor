"use client";

import type { GameweekPlan } from "@/lib/plan/types";
import { buildVerdict } from "@/lib/client/moves";
import { FPL_TRANSFERS_URL } from "@/lib/client/fpl-links";
import { buttonVariants } from "@/components/ui/button";
import { ArrowUpRight, Crown, Loader2, Repeat, Zap } from "lucide-react";

/**
 * The glanceable, always-visible verdict — the week's decision in one line,
 * full-width above the pitch/chat grid, with the "Open FPL Transfers" handoff at
 * the end. The verdict waits for the insights phase (so the captain/transfer are
 * final and never swap mid-flight); until then it shows a placeholder. The
 * "Open FPL Transfers" action is available throughout.
 */
export function VerdictBar({ plan, loading }: { plan: GameweekPlan; loading: boolean }) {
  const verdict = loading ? null : buildVerdict(plan);

  return (
    <div className="rounded-lg border border-fpl-green/30 bg-fpl-purple text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wide text-fpl-pink">
            This week
          </span>

          {verdict === null ? (
            <span className="flex items-center gap-1.5 italic text-white/60">
              <Loader2 className="size-3.5 animate-spin" />
              Preparing this week&rsquo;s verdict&hellip;
            </span>
          ) : (
            <>
              {/* Transfer / chip call — green icon, white bold text */}
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <Repeat className="size-3.5 text-fpl-green" />
                {verdict.transfer}
              </span>

              {/* Captain */}
              {verdict.captain && (
                <>
                  <Separator />
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Crown className="size-3.5 text-fpl-green" />
                    Captain {verdict.captain}
                  </span>
                </>
              )}

              {/* Chip */}
              {verdict.chip && (
                <>
                  <Separator />
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    <Zap className="size-3.5 text-fpl-green" />
                    {verdict.chip}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <a
          href={FPL_TRANSFERS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "sm" })}
        >
          Open FPL Transfers
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function Separator() {
  return <span className="text-white/30">·</span>;
}
