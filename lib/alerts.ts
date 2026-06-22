// Curated, deterministic risk alerts (declutter-alerts-and-outlook).
//
// An alert is a HIGH-RISK event the manager might overlook elsewhere in the app —
// not commentary. These are code-authored template strings filled from squad data
// (no LLM): a starting-XI availability doubt (captain & vice rank highest) and an
// imminent price rise on a recommended transfer target. Severity-ordered, deduped,
// and capped. Strategic/advisory lines and free-form LLM alerts are deliberately
// excluded — that judgment lives in the opening brief and the structured panels.
import type { SquadAnalysisResult } from "./pipeline/types";
import type { OptimizerResult } from "./optimizer/types";
import type { CaptainResult } from "./captain/types";

const DOUBT_CHANCE = 75; // a starter at/under this chance-of-playing is a genuine doubt
const PRICE_RISE_MOMENTUM = 0.7; // strong net transfers-in → imminent price rise
const MAX_ALERTS = 4;

export interface RiskAlertInput {
  analysis: SquadAnalysisResult;
  transfers: OptimizerResult | null;
  captaincy: CaptainResult | null;
}

export function computeRiskAlerts({ analysis, transfers, captaincy }: RiskAlertInput): string[] {
  const xiIds = new Set(analysis.picks.filter((p) => p.position <= 11).map((p) => p.element));
  const captainId = captaincy?.captain.player.player.id ?? null;
  const viceId = captaincy?.viceCaptain?.player.player.id ?? null;

  const flags: { severity: number; text: string }[] = [];

  // 1) Availability risk on the starting XI — captain & vice are the worst case
  //    (a blank armband with no recovery gameweek is the costliest miss).
  for (const sp of analysis.rankedSquad) {
    const p = sp.player;
    if (!xiIds.has(p.id)) continue;

    const chance = p.availability.chanceOfPlayingNext;
    const doubtful = p.availability.status !== "available" || (chance !== null && chance <= DOUBT_CHANCE);
    if (!doubtful) continue;

    const how = chance !== null ? `${chance}% to play` : p.availability.status;
    if (p.id === captainId) {
      flags.push({ severity: 0, text: `Captain ${p.webName} is a doubt (${how}) — line up a different armband before the deadline.` });
    } else if (p.id === viceId) {
      flags.push({ severity: 1, text: `Vice-captain ${p.webName} is a doubt (${how}) — your backup armband is shaky.` });
    } else {
      flags.push({ severity: 2, text: `${p.webName} is a doubt (${how}) — check before the deadline.` });
    }
  }

  // 2) Imminent price rise on a recommended transfer target (act-before-deadline).
  for (const t of transfers?.primaryRecommendation.transfers ?? []) {
    if (t.candidate.marketSignals.transferMomentum > PRICE_RISE_MOMENTUM) {
      flags.push({ severity: 3, text: `Price rise likely for ${t.candidate.player.webName} — act before the deadline.` });
    }
  }

  // Severity-ordered, deduped, capped.
  flags.sort((a, b) => a.severity - b.severity);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of flags) {
    if (seen.has(f.text)) continue;
    seen.add(f.text);
    out.push(f.text);
    if (out.length >= MAX_ALERTS) break;
  }
  return out;
}
