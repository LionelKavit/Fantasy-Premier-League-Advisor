import type { GameweekPlan } from "@/lib/plan/types";
import type { TransferAction, RestructureOption } from "@/lib/optimizer/types";
import { ArrowRight, Crown, Repeat, Coins, Info } from "lucide-react";
import { Section, ConfidenceBadge, chipName } from "./parts";
import { CaptainRanking } from "./CaptainRanking";
import { groupTransferMoves } from "@/lib/client/transferMoves";

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
    default:
      return "Recommendation";
  }
}

function TransferLine({ out, candidates }: { out: string; candidates: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="rounded bg-fpl-pink/15 px-1.5 py-0.5 font-medium text-fpl-pink">{out}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
      {candidates.map((c, i) => (
        <span key={c} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground">/</span>}
          <span className="rounded bg-fpl-green/15 px-1.5 py-0.5 font-medium text-fpl-green">{c}</span>
        </span>
      ))}
    </div>
  );
}

export function ThisWeekDetail({ plan }: { plan: GameweekPlan }) {
  const { transfers, captaincy } = plan;
  const restructure = transfers?.restructureOptions ?? [];

  // Single source of truth: This Week activates a chip ONLY when the plan plays one
  // this gameweek (orchestrator-set play-now). The deterministic layer never does.
  const activeChip =
    transfers?.chipPlan?.find((c) => c.status === "play-now" && c.triggerGw === plan.currentGw) ?? null;

  // Group funding options under each dream target (avoids repeating "To afford X").
  const restructureGroups = restructure.reduce<Record<string, RestructureOption[]>>((acc, o) => {
    const k = o.dreamTarget.candidate.player.webName;
    (acc[k] ||= []).push(o);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      {/* Transfer move (compact — reasoning lives in the left verdict) */}
      <Section title="Transfer" icon={<Repeat className="size-3.5" />}>
        {!transfers ? (
          <p className="text-sm text-muted-foreground">Transfer analysis unavailable.</p>
        ) : activeChip ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Play your {chipName(activeChip.chip)}
            </span>
            {groupTransferMoves(activeChip.draft ?? []).map((g, i) => (
              <TransferLine key={i} out={g.out} candidates={g.candidates} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {primaryHeadline(transfers.primaryRecommendation)}
              </span>
              <ConfidenceBadge confidence={transfers.confidence} />
            </div>
            {/* Deterministic notice when transfers are held for missing ep_next (transfer-ep-notice) */}
            {transfers.dataNotice && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>{transfers.dataNotice}</span>
              </p>
            )}
            {groupTransferMoves(transfers.primaryRecommendation.transfers).map((g, i) => (
              <TransferLine key={i} out={g.out} candidates={g.candidates} />
            ))}
            {transfers.hitVerdict && (
              <p className="text-xs text-muted-foreground">
                <span className={transfers.hitVerdict.recommended ? "text-fpl-green" : ""}>
                  {transfers.hitVerdict.recommended ? "Worth a hit" : "No hit needed"}
                </span>
                {transfers.hitVerdict.breakEvenGw != null && (
                  <span> · breaks even GW{transfers.hitVerdict.breakEvenGw}</span>
                )}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Restructure chains — grouped by dream target */}
      {restructure.length > 0 && (
        <Section title="Restructure" icon={<Coins className="size-3.5" />}>
          <div className="flex flex-col gap-3">
            {Object.entries(restructureGroups).map(([dream, opts]) => (
              <div key={dream} className="text-sm">
                <div>
                  To afford <span className="font-semibold text-fpl-green">{dream}</span>:
                </div>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {opts.map((o, i) => (
                    <li key={i}>
                      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <span className="rounded bg-fpl-pink/15 px-1.5 py-0.5 text-fpl-pink">
                          sell {o.downgradedPlayer.player.webName}
                        </span>
                        <ArrowRight className="size-3" aria-label="then" />
                        <span className="rounded bg-card px-1.5 py-0.5">
                          buy {o.downgradeReplacement.player.webName}
                        </span>
                        <span className="text-xs tabular-nums">
                          net {o.netScoreChange >= 0 ? "+" : ""}
                          {o.netScoreChange.toFixed(2)} · {o.totalCost === 0 ? "free" : `−${o.totalCost} pts`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Captaincy */}
      <Section title="Captaincy" icon={<Crown className="size-3.5" />}>
        {!captaincy ? (
          <p className="text-sm text-muted-foreground">Captain analysis unavailable.</p>
        ) : (
          <div className="text-sm">
            <div className="flex flex-col gap-1.5">
              <div>
                <span className="font-semibold text-fpl-green">C</span> {captaincy.captain.player.player.webName}
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
            <CaptainRanking candidates={captaincy.rankedCandidates} />
          </div>
        )}
      </Section>
    </div>
  );
}
