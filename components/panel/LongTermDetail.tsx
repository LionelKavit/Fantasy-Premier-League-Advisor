import type { GameweekPlan } from "@/lib/plan/types";
import { LineChart, Layers } from "lucide-react";
import { Section } from "./parts";
import { HorizonSparkline } from "./HorizonSparkline";
import { ChipTimeline } from "./ChipTimeline";

export function LongTermDetail({ plan }: { plan: GameweekPlan }) {
  const horizon = plan.transfers?.horizon ?? [];
  const chipPlan = plan.transfers?.chipPlan ?? [];
  const isFinalGw = plan.currentGw >= 38;

  return (
    <div className="flex flex-col gap-3">
      <Section title="Transfer horizon" icon={<LineChart className="size-3.5" />}>
        {horizon.length > 0 ? (
          <div className="flex flex-col gap-2">
            {horizon.map((entry, i) => (
              <HorizonSparkline key={i} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-snug text-muted-foreground">
            {isFinalGw
              ? "It's the final gameweek — there are no upcoming fixtures to plan transfers around."
              : "No transfer target projects a gain over the next 5 gameweeks — your squad looks well set."}
          </p>
        )}
      </Section>

      <Section title="Chip strategy" icon={<Layers className="size-3.5" />}>
        <ChipTimeline chipPlan={chipPlan} chipsRemaining={plan.chipsRemaining} currentGw={plan.currentGw} />
      </Section>
    </div>
  );
}
