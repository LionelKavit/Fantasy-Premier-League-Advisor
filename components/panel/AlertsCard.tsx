import type { GameweekPlan } from "@/lib/plan/types";
import { TriangleAlert } from "lucide-react";
import { Section } from "./parts";

export function AlertsCard({ plan }: { plan: GameweekPlan }) {
  const alerts = Array.from(
    new Set([
      ...plan.alerts,
      ...(plan.transfers?.alerts ?? []),
      ...(plan.captaincy?.alerts ?? []),
    ])
  );
  if (alerts.length === 0) return null;

  return (
    <Section title="Alerts" icon={<TriangleAlert className="size-3.5" />}>
      <ul className="flex flex-col gap-1.5">
        {alerts.map((a, i) => (
          <li key={i} className="flex gap-1.5 text-sm text-muted-foreground">
            <span className="text-fpl-cyan">•</span>
            {a}
          </li>
        ))}
      </ul>
    </Section>
  );
}
