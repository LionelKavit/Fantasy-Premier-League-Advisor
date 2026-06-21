// The Scout's proactive opening brief (scout-opening-brief).
//
// A short, spoken greeting that leads with the week's highest-leverage decision
// and names the deadline — deliberately NOT the long-form ScoutVerdict / long-term
// prose. Two paths share one shape (greet · lead with the decision · name the
// deadline · ≤4 sentences · spoken-aloud · no markdown):
//   - streamOpeningBrief        — the LLM stream (persona + a brief-specific prompt)
//   - composeDeterministicBrief — the keyless fallback, templated to the same shape
//
// Both ground on the same compact summary distilled from the already-computed,
// fully-merged plan (transfer + captain + deadline together) — the one place that
// sees every decision at once, since the underlying syntheses run in parallel.
import type { GameweekPlan } from "../plan/types";
import type { TransferType } from "../optimizer/types";
import type { ChipsRemaining } from "../types";
import { llm } from "../llm/client";
import { SCOUT_PERSONA } from "../llm/persona";

export interface BriefTransfer {
  type: TransferType;
  headline: string; // e.g. "Make one free transfer"
  moves: { out: string; in: string }[];
  reasoning: string | null; // the transfer narrativeSummary (LLM context only — never pasted into the brief)
}

export interface BriefCaptain {
  name: string;
  vice: string | null;
  why: string | null;
}

// The compact, token-light summary the brief grounds on. Everything here comes
// from the plan; the brief may reference only these facts (it never invents).
export interface BriefGrounding {
  managerName: string;
  currentGw: number;
  deadline: string | null; // ISO
  transfer: BriefTransfer | null;
  captain: BriefCaptain | null;
  topAlert: string | null;
  chips: string[]; // remaining chips, human-readable
}

const CHIP_LABELS: Record<keyof ChipsRemaining, string> = {
  wildcard: "Wildcard",
  freeHit: "Free Hit",
  benchBoost: "Bench Boost",
  tripleCaptain: "Triple Captain",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Headline verb for a transfer action (mirrors the This Week panel's wording). */
function transferHeadline(type: TransferType): string {
  switch (type) {
    case "ROLL":
      return "Roll your transfer";
    case "FREE":
      return "Make one free transfer";
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

/** Human-readable deadline label in UTC/GMT (FPL deadlines are published in UTC). */
export function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm} GMT`;
}

function remainingChips(chips: ChipsRemaining): string[] {
  return (Object.keys(CHIP_LABELS) as (keyof ChipsRemaining)[])
    .filter((k) => (chips[k] ?? 0) > 0)
    .map((k) => CHIP_LABELS[k]);
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Distil a fully-merged GameweekPlan into the compact grounding summary. */
export function buildBriefGrounding(plan: GameweekPlan): BriefGrounding {
  const t = plan.transfers;
  const transfer: BriefTransfer | null = t
    ? {
        type: t.primaryRecommendation.type,
        headline: transferHeadline(t.primaryRecommendation.type),
        moves: t.primaryRecommendation.transfers.map((v) => ({
          out: v.weakPlayer.player.webName,
          in: v.candidate.player.webName,
        })),
        reasoning: t.narrativeSummary || null,
      }
    : null;

  const c = plan.captaincy;
  const captain: BriefCaptain | null = c
    ? {
        name: c.captain.player.player.webName,
        vice: c.viceCaptain?.player.player.webName ?? null,
        why: c.captain.whyCaptain?.[0] ?? null,
      }
    : null;

  // Merge plan-level + sub-result alerts; the brief mentions at most the first.
  const alerts = [...plan.alerts, ...(t?.alerts ?? []), ...(c?.alerts ?? [])];

  return {
    managerName: plan.manager.name,
    currentGw: plan.currentGw,
    deadline: plan.deadline,
    transfer,
    captain,
    topAlert: alerts[0] ?? null,
    chips: remainingChips(plan.chipsRemaining),
  };
}

/** The brief-specific instruction + grounding facts for the LLM path. */
function buildBriefPrompt(g: BriefGrounding): string {
  const deadline = formatDeadline(g.deadline) ?? "not published yet";
  const transferLine = g.transfer
    ? `${g.transfer.headline}${
        g.transfer.moves.length ? " — " + g.transfer.moves.map((m) => `${m.out} → ${m.in}`).join(", ") : ""
      }`
    : "no transfer recommendation available";
  const captainLine = g.captain
    ? `${g.captain.name}${g.captain.vice ? `, vice ${g.captain.vice}` : ""}`
    : "no captain pick available";

  return `Greet ${g.managerName || "the manager"} and give their opening brief for GW${g.currentGw}.

## Facts (use ONLY these — never invent names, numbers, prices, or fixtures)
- Deadline: ${deadline}
- Transfer call: ${transferLine}
- Transfer reasoning (context only — do not quote verbatim): ${g.transfer?.reasoning ?? "n/a"}
- Captain: ${captainLine}
- Top alert: ${g.topAlert ?? "none"}
- Chips left: ${g.chips.length ? g.chips.join(", ") : "none"}

## How to write it
This is a spoken opening line — a pundit greeting the manager before kickoff — NOT the written verdict.
- Greet them, then lead with the single highest-leverage decision this week.
- Name the deadline.
- At most 4 short sentences. Plain spoken prose. No markdown, no headings, no bullet lists, no tables.
- Be specific and confident; mention the alert only if it genuinely matters. Don't restate every number — set up the week and invite them in.

Return only the brief text.`;
}

// Brevity is governed by the prompt (≤4 sentences) — this cap is only a runaway
// guard. It's a ceiling, not a target: the model stops at its natural end, so
// unused headroom costs nothing, while too low a cap would truncate the brief
// mid-sentence. ~4 spoken sentences ≈ 110-150 tokens; 320 leaves ~2x margin so a
// slightly chatty-but-valid brief is never cut off.
const BRIEF_MAX_TOKENS = 320;

/**
 * Stream the LLM opening brief token-by-token. Scout persona + a brief-specific
 * prompt; no tools. The prompt enforces the ≤4-sentence brevity; BRIEF_MAX_TOKENS
 * is just a safety ceiling against runaway output.
 */
export async function streamOpeningBrief(
  grounding: BriefGrounding,
  onToken: (text: string) => void
): Promise<void> {
  const s = llm.stream({
    model: llm.DEFAULT_MODEL,
    max_tokens: BRIEF_MAX_TOKENS,
    system: SCOUT_PERSONA,
    messages: [{ role: "user", content: buildBriefPrompt(grounding) }],
  });
  for await (const delta of s.textStream) onToken(delta);
  await s.finalMessage();
}

/**
 * Keyless fallback. Same brief shape as the LLM path (greet · lead with the
 * decision · name the deadline · ≤4 spoken sentences · no markdown), but the
 * wording is templated — assembled from a few short fragments, never the
 * long-form narrativeSummary/longTermNarrative prose.
 */
export function composeDeterministicBrief(g: BriefGrounding): string {
  const sentences: string[] = [];
  const firstName = g.managerName ? g.managerName.trim().split(/\s+/)[0] : "";
  const dl = formatDeadline(g.deadline);

  // 1 — greet + deadline.
  sentences.push(
    dl
      ? `Right${firstName ? ` ${firstName}` : ""} — your GW${g.currentGw} deadline is ${dl}.`
      : `Right${firstName ? ` ${firstName}` : ""} — let's get GW${g.currentGw} sorted.`
  );

  // 2 — the highest-leverage call: this week's transfer decision.
  if (g.transfer) {
    if (g.transfer.type === "ROLL" || g.transfer.moves.length === 0) {
      sentences.push("Hold your transfer this week — nothing clears the bar worth doing.");
    } else {
      const moves = g.transfer.moves.map((m) => `${m.out} → ${m.in}`).join(", ");
      sentences.push(`${g.transfer.headline}: ${moves}.`);
    }
  }

  // 3 — captain.
  if (g.captain) {
    sentences.push(
      g.captain.vice ? `Captain ${g.captain.name}, ${g.captain.vice} as vice.` : `Captain ${g.captain.name}.`
    );
  }

  // 4 — at most one alert.
  if (g.topAlert) sentences.push(`Heads up: ${lowerFirst(g.topAlert)}`);

  return sentences.slice(0, 4).join(" ");
}
