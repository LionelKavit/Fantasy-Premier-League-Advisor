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
import { llm, withCachedSystem } from "../llm/client";
import { SCOUT_PERSONA } from "../llm/persona";
import type { DemoSeason } from "../demo/squad";

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
  // The chip the committed plan plays THIS gameweek (play-now), if any — so the
  // brief can lead with it and stay consistent with the verdict bar / This Week.
  chip: { label: string; reason: string } | null;
  chips: string[]; // remaining (held) chips, human-readable
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

  // The chip the plan plays THIS gameweek — same predicate the panels use, so the
  // brief can't disagree with the verdict bar / This Week.
  const playNow =
    t?.chipPlan?.find((p) => p.status === "play-now" && p.triggerGw === plan.currentGw) ?? null;
  const chip = playNow ? { label: CHIP_LABELS[playNow.chip], reason: playNow.reason } : null;

  return {
    managerName: plan.manager.name,
    currentGw: plan.currentGw,
    deadline: plan.deadline,
    transfer,
    captain,
    topAlert: alerts[0] ?? null,
    chip,
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
- Chip call: ${g.chip ? `Play your ${g.chip.label} this gameweek — ${g.chip.reason}` : "no chip recommended this gameweek"}
- Top alert: ${g.topAlert ?? "none"}
- Chips held: ${g.chips.length ? g.chips.join(", ") : "none"}

## How to write it
This is a spoken opening line — a pundit greeting the manager before kickoff — NOT the written verdict.
- Greet them, then lead with the single highest-leverage decision this week.
- If a chip is recommended this gameweek (the Chip call above), treat it as a top-tier lever — lead with it (you can still name the transfer); do NOT imply the chips are merely being held.
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
    system: withCachedSystem(SCOUT_PERSONA),
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

  // 2b — a chip the plan plays this gameweek is a top lever; name it next so it
  // survives the 4-sentence cap (ahead of captain/alert).
  if (g.chip) {
    sentences.push(`Play your ${g.chip.label} this week — it's the big lever.`);
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

// ── Demo welcome brief ───────────────────────────────────────────────────────
// A different brief for ID-less visitors: greet, explain the sample squad and
// what it was built from (season-aware), name the captain, and invite a question.
// No deadline / transfer / chip / "your squad" references — there's no manager.

export interface DemoBriefGrounding {
  season: DemoSeason;
  captain: string | null;
  vice: string | null;
}

const seasonBasis = (s: DemoSeason): string =>
  s === "offseason" ? "last season's points returns" : "this week's projected points";

export function buildDemoBriefGrounding(plan: GameweekPlan): DemoBriefGrounding {
  const c = plan.captaincy;
  return {
    season: plan.demoSeason ?? "live",
    captain: c?.captain.player.player.webName ?? null,
    vice: c?.viceCaptain?.player.player.webName ?? null,
  };
}

function buildDemoBriefPrompt(g: DemoBriefGrounding): string {
  const captainLine = g.captain
    ? `${g.captain}${g.vice ? `, with ${g.vice} as vice` : ""}`
    : "the standout pick";
  return `Greet a new visitor who is exploring Pocket Scout with a SAMPLE squad (they have not entered a manager ID).

## Facts (use ONLY these — never invent names or numbers)
- The sample squad was built from ${seasonBasis(g.season)}.
- Suggested captain: ${captainLine}.

## How to write it
This is a spoken welcome — a pundit showing a newcomer around, NOT a written verdict.
- Greet them, say you've put together a sample "dream team" from ${seasonBasis(g.season)}, and name the captain.
- Invite them to ask anything — compare two players, why someone made the team, or who to draft next season.
- Do NOT mention a deadline, transfers, chips, a manager's rank, or "your team" — there is no manager here.
- At most 3 short sentences. Plain spoken prose. No markdown, headings, bullets or tables.

Return only the brief text.`;
}

/** Stream the LLM demo welcome brief token-by-token (Scout persona, no tools). */
export async function streamDemoBrief(
  grounding: DemoBriefGrounding,
  onToken: (text: string) => void
): Promise<void> {
  const s = llm.stream({
    model: llm.DEFAULT_MODEL,
    max_tokens: BRIEF_MAX_TOKENS,
    system: withCachedSystem(SCOUT_PERSONA),
    messages: [{ role: "user", content: buildDemoBriefPrompt(grounding) }],
  });
  for await (const delta of s.textStream) onToken(delta);
  await s.finalMessage();
}

/**
 * Deterministic demo welcome brief — the fallback for BOTH no-key and any runtime
 * LLM failure, so a demo visitor never sees an error string in the brief bubble.
 */
export function composeDeterministicDemoBrief(g: DemoBriefGrounding): string {
  const sentences: string[] = [
    `Welcome to Pocket Scout — I've built a sample squad from ${seasonBasis(g.season)} to show you around.`,
  ];
  if (g.captain) {
    sentences.push(g.vice ? `I'd captain ${g.captain}, with ${g.vice} as vice.` : `I'd captain ${g.captain}.`);
  }
  sentences.push(
    "Ask me anything — compare two players, why someone's in the team, or who to draft for next season."
  );
  return sentences.slice(0, 3).join(" ");
}
