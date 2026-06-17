import type { GameweekPlan } from "@/lib/plan/types";
import type { TransferAction } from "@/lib/optimizer/types";
import { ArrowRight, Crown, TriangleAlert, WifiOff, Shield, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const cls =
    confidence === "high"
      ? "bg-fpl-green text-fpl-purple"
      : confidence === "medium"
        ? "bg-fpl-cyan text-fpl-purple"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", cls)}>
      {confidence} confidence
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function primaryHeadline(action: TransferAction): string {
  switch (action.type) {
    case "ROLL":
      return "Roll your transfer";
    case "FREE":
      return "Make 1 free transfer";
    case "HIT_SINGLE":
      return "Take a −4 hit";
    case "HIT_DOUBLE":
      return "Take a −8 hit";
    case "WILDCARD":
      return "Play your Wildcard";
    case "FREE_HIT":
      return "Play your Free Hit";
    default:
      return "Recommendation";
  }
}

function TransferLine({
  out,
  inn,
}: {
  out: string;
  inn: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded bg-fpl-pink/15 px-1.5 py-0.5 font-medium text-fpl-pink">{out}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
      <span className="rounded bg-fpl-green/15 px-1.5 py-0.5 font-medium text-fpl-green">{inn}</span>
    </div>
  );
}

export function RecommendationPanel({ plan }: { plan: GameweekPlan }) {
  const { transfers, captaincy } = plan;

  const aiOffline = transfers?.confidence === "low" || captaincy?.confidence === "low";

  const alerts = Array.from(
    new Set([
      ...plan.alerts,
      ...(transfers?.alerts ?? []),
      ...(captaincy?.alerts ?? []),
    ])
  );

  return (
    <div className="flex flex-col gap-3">
      {aiOffline && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" />
          AI synthesis offline — showing automated picks.
        </div>
      )}

      {/* Primary move */}
      <Section title="This week" icon={<Repeat className="size-3.5" />}>
        {!transfers ? (
          <p className="text-sm text-muted-foreground">Transfer analysis unavailable.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {primaryHeadline(transfers.primaryRecommendation)}
              </span>
              <ConfidenceBadge confidence={transfers.confidence} />
            </div>
            {transfers.primaryRecommendation.transfers.map((t, i) => (
              <TransferLine
                key={i}
                out={t.weakPlayer.player.webName}
                inn={t.candidate.player.webName}
              />
            ))}
            {transfers.narrativeSummary && (
              <p className="text-sm leading-snug text-muted-foreground">
                {transfers.narrativeSummary}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Hit verdict */}
      {transfers?.hitVerdict && (
        <Section title="Hit verdict" icon={<Shield className="size-3.5" />}>
          <p className="text-sm">
            <span
              className={cn(
                "font-semibold",
                transfers.hitVerdict.recommended ? "text-fpl-green" : "text-foreground"
              )}
            >
              {transfers.hitVerdict.recommended ? "Worth a hit" : "No hit needed"}
            </span>
            {transfers.hitVerdict.breakEvenGw != null && (
              <span className="text-muted-foreground"> · breaks even GW{transfers.hitVerdict.breakEvenGw}</span>
            )}
          </p>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {transfers.hitVerdict.reasoning}
          </p>
        </Section>
      )}

      {/* Captain */}
      <Section title="Captaincy" icon={<Crown className="size-3.5" />}>
        {!captaincy ? (
          <p className="text-sm text-muted-foreground">Captain analysis unavailable.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            <div>
              <span className="font-semibold text-fpl-green">C</span>{" "}
              {captaincy.captain.player.player.webName}
              {captaincy.captain.whyCaptain[0] && (
                <span className="text-muted-foreground"> — {captaincy.captain.whyCaptain[0]}</span>
              )}
            </div>
            {captaincy.viceCaptain && (
              <div>
                <span className="font-semibold text-fpl-cyan">V</span>{" "}
                {captaincy.viceCaptain.player.player.webName}
              </div>
            )}
            {captaincy.differentialOption && (
              <div className="text-muted-foreground">
                Differential: {captaincy.differentialOption.player.player.webName}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Alerts */}
      {alerts.length > 0 && (
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
      )}
    </div>
  );
}
