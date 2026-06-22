"use client";

import type { GameweekPlan } from "@/lib/plan/types";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header({
  plan,
  freeTransfers,
  onFreeTransfersChange,
  onReanalyze,
  onChangeManager,
  busy,
  dirty = false,
}: {
  plan: GameweekPlan;
  freeTransfers: number;
  onFreeTransfersChange: (n: number) => void;
  onReanalyze: () => void;
  onChangeManager: () => void;
  busy: boolean;
  /** Selection changed but not yet analyzed — highlight Re-analyze as pending. */
  dirty?: boolean;
}) {
  return (
    <header className="bg-[#37003c] text-white">
      {/* Everything centred: team → stats → controls stack on one axis */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 text-center">
        {/* Team / manager */}
        <div className="leading-tight">
          <div className="text-lg font-extrabold">{plan.manager.teamName}</div>
          <div className="text-xs text-white/60">{plan.manager.name}</div>
        </div>

        {/* Stats — centred row, value over label */}
        <dl className="flex items-start justify-center gap-8">
          <Stat label="GW" value={String(plan.currentGw)} />
          <Stat
            label="Overall rank"
            value={plan.manager.overallRank != null ? plan.manager.overallRank.toLocaleString() : "—"}
          />
          <Stat label="Bank" value={`£${plan.bank.toFixed(1)}`} />
        </dl>

        {/* Controls — centred row */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div
            className="inline-flex items-center overflow-hidden rounded-full border border-white/25"
            role="group"
            aria-label="Free transfers"
          >
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">
              FT
            </span>
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onFreeTransfersChange(n)}
                aria-pressed={freeTransfers === n}
                className={cn(
                  "px-3 py-1 text-sm font-bold tabular-nums transition-colors",
                  freeTransfers === n
                    ? "bg-[#00ff87] text-[#37003c]"
                    : "text-white hover:bg-white/10"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            title={dirty ? "Apply the new free-transfer count" : undefined}
            className={cn(
              "rounded-full border",
              dirty
                ? "border-[#00ff87] bg-[#00ff87] font-semibold text-[#37003c] hover:bg-[#00ff87]/90"
                : "border-white/30 text-white hover:bg-white/10"
            )}
            onClick={onReanalyze}
            disabled={busy}
          >
            <RefreshCw
              className={cn("size-3.5", dirty ? "text-[#37003c]" : "text-fpl-green", busy && "animate-spin")}
            />
            Re-analyze
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-white/30 text-white hover:bg-white/10"
            onClick={onChangeManager}
          >
            Reset
          </Button>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <dd className="text-xl font-extrabold leading-none tabular-nums">{value}</dd>
      <dt className="mt-1 text-[10px] uppercase tracking-wide text-white/60">{label}</dt>
    </div>
  );
}
