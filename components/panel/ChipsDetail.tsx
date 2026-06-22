import type { GameweekPlan } from "@/lib/plan/types";
import { Layers } from "lucide-react";
import { Section } from "./parts";
import { ChipTimeline } from "./ChipTimeline";

/** The Chips lens — chip timeline, chips remaining, and recommended windows. */
export function ChipsDetail({ plan }: { plan: GameweekPlan }) {
  const chipPlan = plan.transfers?.chipPlan ?? [];
  return (
    <Section title="Chip strategy" icon={<Layers className="size-3.5" />}>
      <ChipTimeline chipPlan={chipPlan} chipsRemaining={plan.chipsRemaining} currentGw={plan.currentGw} />
    </Section>
  );
}
