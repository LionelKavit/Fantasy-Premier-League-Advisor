"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FREE_TRANSFER_RANGE, isValidFt } from "@/lib/config";

export function ManagerIdForm({
  initialId = "",
  initialFreeTransfers = 1,
  onSubmit,
  onExplore,
}: {
  initialId?: string;
  initialFreeTransfers?: number;
  onSubmit: (managerId: string, freeTransfers: number) => void;
  /** Start demo mode — explore a sample squad without a manager ID. */
  onExplore?: () => void;
}) {
  const [id, setId] = useState(initialId);
  const [ftDraft, setFtDraft] = useState(String(initialFreeTransfers));
  const [touched, setTouched] = useState(false);

  const valid = /^\d+$/.test(id.trim());
  const ftParsed = Number(ftDraft);
  const ftValid = ftDraft.trim() !== "" && isValidFt(ftParsed);
  // Surface the prompt as soon as an invalid value is entered (any non-empty bad
  // entry), not only after a submit attempt.
  const showFtError = !ftValid && (touched || ftDraft.trim() !== "");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-6 py-16 text-center">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-fpl-green">Pocket Scout</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your personal FPL scout — tailored transfers, captain picks, and chip
          strategy for your squad. Enter your Manager ID to get scouted.
        </p>
      </div>

      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (valid && ftValid) onSubmit(id.trim(), ftParsed);
        }}
      >
        <div className="text-left">
          <label htmlFor="manager-id" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Manager ID
          </label>
          <input
            id="manager-id"
            inputMode="numeric"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="e.g. 10815578"
            className={cn(
              "w-full rounded-lg border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              touched && !valid ? "border-fpl-pink" : "border-border"
            )}
            aria-invalid={touched && !valid}
          />
          {touched && !valid && (
            <p className="mt-1 text-xs text-fpl-pink">Enter a numeric manager ID.</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Find it in your team URL: fantasy.premierleague.com/entry/<b>ID</b>/event/…
          </p>
        </div>

        <div className="text-left">
          <label htmlFor="free-transfers" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Free transfers
          </label>
          <input
            id="free-transfers"
            type="number"
            inputMode="numeric"
            min={FREE_TRANSFER_RANGE.min}
            max={FREE_TRANSFER_RANGE.max}
            step={1}
            value={ftDraft}
            onChange={(e) => setFtDraft(e.target.value)}
            className={cn(
              "w-24 rounded-lg border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              showFtError ? "border-fpl-pink" : "border-border"
            )}
            aria-invalid={showFtError}
          />
          {showFtError ? (
            <p className="mt-1 text-xs text-fpl-pink">
              Enter a value between {FREE_TRANSFER_RANGE.min} and {FREE_TRANSFER_RANGE.max}.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              How many transfers you have banked ({FREE_TRANSFER_RANGE.min}–{FREE_TRANSFER_RANGE.max}).
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full">
          Analyze my team
        </Button>
      </form>

      {onExplore && (
        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={onExplore}>
            Explore without a team
          </Button>
          <p className="text-xs text-muted-foreground">
            No ID? See a sample squad and ask the Scout anything — chat only, no personalized plan.
          </p>
        </div>
      )}
    </div>
  );
}
