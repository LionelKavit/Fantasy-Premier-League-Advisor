import type { GameweekPlan } from "@/lib/plan/types";
import { ScrollText, WifiOff } from "lucide-react";
import { buildLongTermSummary } from "@/lib/client/longTermSummary";

export function ScoutVerdict({
  plan,
  tab,
}: {
  plan: GameweekPlan;
  tab: "this-week" | "long-term";
}) {
  const { transfers, captaincy } = plan;
  const aiOffline = transfers?.confidence === "low" || captaincy?.confidence === "low";

  const longTerm = transfers?.longTermNarrative;
  const paragraphs: string[] =
    tab === "long-term"
      ? // Prefer the LLM long-term verdict; fall back to the deterministic summary.
        longTerm
        ? longTerm.split(/\n+/).map((s) => s.trim()).filter(Boolean)
        : buildLongTermSummary(plan)
      : [
          transfers?.narrativeSummary,
          transfers?.hitVerdict?.reasoning,
        ].filter((p): p is string => Boolean(p));

  const title = tab === "long-term" ? "Long-term outlook" : "Scout's verdict";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ScrollText className="size-3.5" />
        {title}
      </div>

      {tab === "this-week" && aiOffline && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" />
          AI synthesis offline — showing automated reasoning.
        </div>
      )}

      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No verdict available.</p>
      )}
    </div>
  );
}
