import type { GameweekPlan } from "@/lib/plan/types";
import { TriangleAlert } from "lucide-react";
import { Section } from "./parts";

export function AlertsCard({ plan }: { plan: GameweekPlan }) {
  // Risk alerts (curated, deterministic) lead via plan.alerts; any system/
  // degradation notices from the sub-results follow. De-duplicated.
  const alerts = Array.from(
    new Set([
      ...plan.alerts,
      ...(plan.transfers?.alerts ?? []),
      ...(plan.captaincy?.alerts ?? []),
    ])
  );

  return (
    <Section title="Alerts" icon={<TriangleAlert className="size-3.5" />}>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No alerts — nothing flagged that isn&apos;t already covered above.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {alerts.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-sm text-muted-foreground">
              <span className="text-fpl-cyan">•</span>
              {a}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
