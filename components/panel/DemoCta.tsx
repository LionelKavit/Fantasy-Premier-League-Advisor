"use client";

import { Button } from "@/components/ui/button";
import { Section } from "./parts";
import { UserPlus } from "lucide-react";

/**
 * The demo conversion prompt — a low-pressure nudge to switch from the sample
 * squad to the personalized ID-based flow. Rendered in demo where the AlertsCard
 * would otherwise sit.
 */
export function DemoCta({ onEnterId }: { onEnterId: () => void }) {
  return (
    <Section title="Your squad" icon={<UserPlus className="size-3.5" />}>
      <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
        <p>
          You&rsquo;re exploring a sample squad. Want tailored transfers, captaincy, and chip
          strategy for <span className="font-medium text-foreground">your</span> team?
        </p>
        <Button size="sm" className="self-start" onClick={onEnterId}>
          Enter your manager ID →
        </Button>
      </div>
    </Section>
  );
}
