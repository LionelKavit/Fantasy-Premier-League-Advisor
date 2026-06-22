"use client";

import type { GameweekPlan } from "@/lib/plan/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThisWeekDetail } from "./ThisWeekDetail";
import { LongTermDetail } from "./LongTermDetail";
import { ChipsDetail } from "./ChipsDetail";
import { AnalyzingIndicator } from "@/components/states/AnalyzingIndicator";
import { ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

type Lens = "this-week" | "long-term" | "chips";

const tabTrigger =
  "flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground data-[selected]:bg-fpl-green data-[selected]:text-fpl-purple";

/**
 * The collapsible "This week & long-term plan" — the This Week / Long Term
 * structured detail, demoted beneath the conversation. Always starts collapsed
 * (the page owns `open` and resets it to false on every load). Both tabs show
 * structured detail only — the weekly verdict lives in the conversation/brief,
 * and the long-form long-term outlook prose has been removed (declutter).
 */
export function FullBreakdown({
  open,
  onToggle,
  lens,
  onLensChange,
  plan,
  loading,
}: {
  open: boolean;
  onToggle: () => void;
  lens: Lens;
  onLensChange: (lens: Lens) => void;
  plan: GameweekPlan;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <ListTree className="size-3.5" />
          This week &amp; long-term plan
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <Tabs value={lens} onValueChange={(v) => onLensChange(v as Lens)}>
            <TabsList
              aria-label="Breakdown views"
              className="mb-3 flex gap-1 rounded-lg border border-border bg-background p-1"
            >
              <TabsTrigger value="this-week" className={tabTrigger}>
                This Week
              </TabsTrigger>
              <TabsTrigger value="long-term" className={tabTrigger}>
                Long Term
              </TabsTrigger>
              <TabsTrigger value="chips" className={tabTrigger}>
                Chips
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <AnalyzingIndicator />
          ) : lens === "this-week" ? (
            <ThisWeekDetail plan={plan} />
          ) : lens === "long-term" ? (
            <LongTermDetail plan={plan} />
          ) : (
            <ChipsDetail plan={plan} />
          )}
        </div>
      )}
    </div>
  );
}
