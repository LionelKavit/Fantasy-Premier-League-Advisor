"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Scoring transfer options…",
  "Weighing captaincy…",
  "Mapping the run-in…",
  "Writing the verdict…",
];

/**
 * Scoped, step-aware "Scout is analyzing…" affordance shown in the verdict /
 * detail region while the LLM insights phase runs. The pitch is already on
 * screen — this only covers the part that's still loading.
 */
export function AnalyzingIndicator({ className = "" }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <Sparkles className="size-5 animate-pulse text-fpl-green" />
      <div className="text-sm font-semibold text-foreground">The Scout is analyzing…</div>
      <div className="text-xs text-muted-foreground">{STEPS[step]}</div>
      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-colors ${
              i === step ? "bg-fpl-green" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
