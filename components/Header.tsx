"use client";

import { useState } from "react";
import type { GameweekPlan } from "@/lib/plan/types";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FREE_TRANSFER_RANGE, isValidFt } from "@/lib/config";

export function Header({
  plan,
  freeTransfers,
  onFreeTransfersChange,
  onReanalyze,
  onChangeManager,
  busy,
  dirty = false,
  demo = false,
}: {
  plan: GameweekPlan;
  freeTransfers: number;
  onFreeTransfersChange: (n: number) => void;
  onReanalyze: () => void;
  onChangeManager: () => void;
  busy: boolean;
  /** Selection changed but not yet analyzed — highlight Re-analyze as pending. */
  dirty?: boolean;
  /** Demo mode — hide FT/Re-analyze and manager stats; "Enter your ID" exits. */
  demo?: boolean;
}) {
  // Free-entry FT field: a local draft string lets the manager type freely (incl.
  // mid-edit empty / out-of-range) without pushing an invalid value upstream. The
  // selection only propagates when it parses to a valid 0–5 integer; while invalid
  // we block Re-analyze and show an inline prompt.
  const [ftDraft, setFtDraft] = useState(String(freeTransfers));
  const [ftTouched, setFtTouched] = useState(false);
  // Resync the draft when the applied selection changes from outside the field
  // (e.g. a fresh load) — the render-phase pattern React recommends over an effect.
  const [lastFt, setLastFt] = useState(freeTransfers);
  if (freeTransfers !== lastFt) {
    setLastFt(freeTransfers);
    setFtDraft(String(freeTransfers));
    setFtTouched(false);
  }

  const ftParsed = Number(ftDraft);
  const ftValid = ftDraft.trim() !== "" && isValidFt(ftParsed);
  // Show the prompt as soon as an invalid value is present (any non-empty bad entry),
  // not only after the field has been interacted with.
  const showFtError = !ftValid && (ftTouched || ftDraft.trim() !== "");

  const handleFtInput = (raw: string) => {
    setFtTouched(true);
    setFtDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && isValidFt(n)) onFreeTransfersChange(n);
  };

  return (
    <header className="bg-[#37003c] text-white">
      {/* Everything centred: team → stats → controls stack on one axis */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 text-center">
        {/* Team / manager */}
        <div className="leading-tight">
          <div className="flex items-center justify-center gap-2 text-lg font-extrabold">
            {demo ? "Pocket Scout" : plan.manager.teamName}
            {demo && (
              <span className="rounded-full bg-[#00ff87] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#37003c]">
                Demo
              </span>
            )}
          </div>
          <div className="text-xs text-white/60">
            {demo ? "Sample squad · no manager ID" : plan.manager.name}
          </div>
        </div>

        {/* Stats — centred row, value over label */}
        <dl className="flex items-start justify-center gap-8">
          <Stat label="GW" value={String(plan.currentGw)} />
          {!demo && (
            <Stat
              label="Overall rank"
              value={plan.manager.overallRank != null ? plan.manager.overallRank.toLocaleString() : "—"}
            />
          )}
          {!demo && <Stat label="Bank" value={`£${plan.bank.toFixed(1)}`} />}
        </dl>

        {/* Controls — centred row */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!demo && (
            <>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1",
                    showFtError ? "border-fpl-pink" : "border-white/25"
                  )}
                >
                  <label
                    htmlFor="ft-input"
                    className="px-1 text-[10px] font-semibold uppercase tracking-wide text-white/60"
                  >
                    FT
                  </label>
                  <input
                    id="ft-input"
                    type="number"
                    inputMode="numeric"
                    min={FREE_TRANSFER_RANGE.min}
                    max={FREE_TRANSFER_RANGE.max}
                    step={1}
                    value={ftDraft}
                    onChange={(e) => handleFtInput(e.target.value)}
                    aria-label="Free transfers"
                    aria-invalid={showFtError}
                    aria-describedby={showFtError ? "ft-error" : undefined}
                    className={cn(
                      "w-9 bg-transparent text-center text-sm font-bold tabular-nums outline-none",
                      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                      showFtError ? "text-fpl-pink" : "text-white"
                    )}
                  />
                </div>
                {showFtError && (
                  <p id="ft-error" className="text-[10px] font-medium text-fpl-pink">
                    Enter a value between {FREE_TRANSFER_RANGE.min} and {FREE_TRANSFER_RANGE.max}
                  </p>
                )}
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
                disabled={busy || !ftValid}
              >
                <RefreshCw
                  className={cn("size-3.5", dirty ? "text-[#37003c]" : "text-fpl-green", busy && "animate-spin")}
                />
                Re-analyze
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-white/30 text-white hover:bg-white/10"
            onClick={onChangeManager}
          >
            {demo ? "Enter your ID" : "Reset"}
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
