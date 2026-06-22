import type { GameweekPlan } from "@/lib/plan/types";
import { Layers, WifiOff } from "lucide-react";
import { Section } from "./parts";
import { ChipTimeline } from "./ChipTimeline";

/** The Chips lens — chip timeline, chips remaining, and recommended windows. */
export function ChipsDetail({ plan }: { plan: GameweekPlan }) {
  const chipPlan = plan.transfers?.chipPlan ?? [];
  // Keyless / AI offline → the orchestrator is skipped and the plan is the
  // deterministic candidate windows (no this-week activation).
  const aiOffline = plan.transfers?.confidence === "low";
  return (
    <Section title="Chip strategy" icon={<Layers className="size-3.5" />}>
      {aiOffline && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" />
          AI reasoning offline — showing the deterministic chip windows.
        </div>
      )}
      <ChipTimeline chipPlan={chipPlan} chipsRemaining={plan.chipsRemaining} />
    </Section>
  );
}
