"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [ft, setFt] = useState(initialFreeTransfers);
  const [touched, setTouched] = useState(false);

  const valid = /^\d+$/.test(id.trim());

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
          if (valid) onSubmit(id.trim(), ft);
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
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Free transfers
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Free transfers">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFt(n)}
                aria-pressed={ft === n}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium transition-colors",
                  ft === n ? "bg-fpl-green text-fpl-purple" : "bg-card text-foreground hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
          </div>
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
