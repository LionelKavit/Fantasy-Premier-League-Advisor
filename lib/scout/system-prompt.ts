import type { ScoutContext } from "./context";
import type { ChipRecommendation } from "../optimizer/types";
import type { ChipsRemaining } from "../types";
import { CHIP_CALENDAR } from "../config";
import { SCOUT_PERSONA } from "../llm/persona";
import { loadKnowledge } from "../knowledge";

/** Slim chip plan the chat is grounded in (no transfer draft). */
export type ChipPlanLine = Pick<ChipRecommendation, "chip" | "status" | "triggerGw" | "reason">;

const CHIP_LABELS: Record<ChipRecommendation["chip"], string> = {
  wildcard: "Wildcard",
  freeHit: "Free Hit",
  benchBoost: "Bench Boost",
  tripleCaptain: "Triple Captain",
};

/** The gameweek the current half's chips expire (use-it-or-lose-it after this). */
function chipExpiryGw(currentGw: number): number {
  return currentGw <= CHIP_CALENDAR.firstHalfExpiryGw
    ? CHIP_CALENDAR.firstHalfExpiryGw
    : CHIP_CALENDAR.seasonEndGw;
}

/**
 * Ground the chat in the manager's HELD chips and their expiry — including chips
 * with no scheduled window (e.g. a Wildcard) — so it can reason about
 * use-it-or-lose-it and offer the Wildcard as a free alternative to a points hit.
 */
function heldChipsBlock(chipsRemaining: ChipsRemaining, currentGw: number): string {
  const held = (Object.keys(chipsRemaining) as (keyof ChipsRemaining)[]).filter(
    (k) => chipsRemaining[k] > 0
  );
  if (held.length === 0) return "";
  const deadline = chipExpiryGw(currentGw);
  const names = held.map((k) => CHIP_LABELS[k]).join(", ");
  return `

## Chips in hand (expire GW${deadline})
${names}
A held chip is use-it-or-lose-it as GW${deadline} nears. In particular, a held Wildcard makes unlimited transfers at no points cost — so if the manager weighs a points hit to make extra moves and still holds a Wildcard, point out the Wildcard does those moves for free (a better option than a −4 hit). Still lead with the optimal call; don't urge spending a chip purely to avoid losing it unless it beats the alternatives.`;
}

/**
 * Render the committed chip plan as authoritative grounding so the chat backs the
 * panels' chip verdict instead of re-deriving its own (single source of truth).
 */
function chipPlanBlock(chipPlan: ChipPlanLine[] | undefined, currentGw: number): string {
  if (!chipPlan || chipPlan.length === 0) return "";
  const lines = chipPlan
    .map((c) => {
      const label = CHIP_LABELS[c.chip];
      const decision =
        c.status === "play-now"
          ? `PLAY NOW this gameweek (GW${currentGw})`
          : c.status === "hold"
            ? "HOLD"
            : `play in GW${c.triggerGw}`;
      return `- ${label}: ${decision} — ${c.reason}`;
    })
    .join("\n");
  return `

## Chip plan (the app's committed recommendation — treat as authoritative)
${lines}
When the manager asks which chip to play or about chip timing, explain and defend THIS plan. Do not produce a different chip verdict; if they push back, surface the plan's reasoning rather than contradicting it.`;
}

/**
 * Ground the agentic loop in the repo's curated expert knowledge (the same
 * content that grounds the optimizer/captain syntheses), so the chat reasons
 * with the same principles the panels are built on — including chip rules like
 * "one chip per gameweek". Additive: a missing file degrades to "" (no section).
 * Framed as GENERAL guidance — the committed Chip plan (above) and the closing
 * authority clause (below) keep the chip *decision* with the plan, not these.
 */
function expertKnowledgeBlock(): string {
  const parts = [loadKnowledge("chips"), loadKnowledge("rank-strategy")].filter(Boolean);
  if (parts.length === 0) return "";
  return `

## Expert principles (curated knowledge — GENERAL guidance for your reasoning; the committed Chip plan above has already applied these to this squad and remains the authority on the chip decision)
${parts.join("\n\n")}`;
}

/**
 * Closing authority clause — rendered last (after the knowledge) so it governs
 * it by recency. Only present when a committed chip plan exists. Keeps the chip
 * *verdict* with the plan while leaving explanation/comparison free.
 */
function chipVerdictAuthorityClause(chipPlan: ChipPlanLine[] | undefined): string {
  if (!chipPlan || chipPlan.length === 0) return "";
  return `

## Chip decision authority (read this last)
The Expert principles above are general guidance; the committed Chip plan has already applied them to THIS squad and gameweek. For the actual chip decision, defer to the committed Chip plan: do NOT recommend playing a different chip this gameweek than its play-now call, and do NOT recommend playing a chip when the plan holds — even if a principle might seem to suggest otherwise. Use the principles only to explain and justify the committed call. You may still compare chips and lay out trade-offs; you simply never issue a competing chip recommendation.`;
}

/**
 * The Scout's instruction set. Kept in its own module so the assistant's
 * behaviour and output formatting live in one legible place. Built per request
 * so it can name the manager and inject the current situation.
 */
export function buildScoutSystemPrompt(
  sc: ScoutContext,
  freeTransfers: number,
  chipPlan?: ChipPlanLine[],
  demo = false
): string {
  const a = sc.ctx.analysis;
  if (demo) return buildDemoScoutSystemPrompt(sc);
  const manager = sc.ctx.managerProfile.entry.name;
  return `${SCOUT_PERSONA}

You are operating here as the in-app chat assistant for the manager of "${manager}".

## Scope
Answer ONLY questions about this FPL team, players, transfers, captaincy, chips, fixtures and strategy. If asked anything unrelated to FPL, politely decline in one sentence and steer back to their team.

## Grounding
Never invent prices, scores, projections, ownership or transfer legality — call the tools to get real numbers. Call get_plan first when the user asks for general advice. Use simulate_transfer / simulate_captain for any "should I…" or "what if…" question, and make clear these are hypotheticals, not executed moves.

## Current situation
GW${a.currentGw}, £${a.bank.toFixed(1)}m in the bank, ${freeTransfers} free transfer(s) available.

${FORMAT_GUIDE}

## What to say
The manager can already see their squad, the recommended transfer, restructure options and captaincy on screen. Don't just restate those — answer the actual question and add the reasoning: why this option over the alternatives, the key trade-off or risk, and context the raw numbers don't show (recent form vs underlying, fixtures, ownership/template, timing). Reference specific players, gameweeks and numbers.${heldChipsBlock(a.chipsRemaining, a.currentGw)}${chipPlanBlock(chipPlan, a.currentGw)}${expertKnowledgeBlock()}${chipVerdictAuthorityClause(chipPlan)}`;
}

// Shared narrow-column formatting rules (identical for the manager and demo chats).
const FORMAT_GUIDE = `## How to format your answer
This renders in a narrow chat column. Be crisp:
- Lead with the answer. Your FIRST sentence states the verdict or direct answer — not setup, not "it depends", not caveats. The reasoning comes after.
- Default to 2–4 sentences (~90 words). Go longer ONLY if the user explicitly asks you to walk through it or explain in depth.
- Use at most ONE short bullet list ("- "), and only to compare 3+ options or lay out a couple of factors. Never stack multiple prose paragraphs — if you're starting a third paragraph, cut instead.
- Do NOT use Markdown tables — they don't fit. Compare options in a sentence or that one short list.
- No headings. Use **bold** sparingly — only the headline pick or a key figure, never whole sentences or scattered asterisks.`;

/**
 * Demo-mode system prompt: a sample squad, no manager. General FPL advice only —
 * never "your squad"/rank/held chips; simulate_transfer is a hypothetical teaching
 * tool, never a "you should transfer" verdict. No chip-plan / held-chip blocks
 * (there are none); curated knowledge stays for general reasoning.
 */
function buildDemoScoutSystemPrompt(sc: ScoutContext): string {
  const a = sc.ctx.analysis;
  return `${SCOUT_PERSONA}

You are operating here as the in-app chat assistant in DEMO mode. There is no manager and no real team — the squad on screen is a SAMPLE "dream team" built from the numbers to showcase Pocket Scout.

## Scope
Answer questions about FPL — players, captaincy, fixtures, value, and strategy, including this sample squad. Give GENERAL advice and analysis; never refer to "your team", "your squad", a manager's rank, or held chips (there are none). If asked anything unrelated to FPL, politely decline in one sentence and steer back.

## Grounding
Never invent prices, scores, projections or ownership — call the tools to get real numbers. Use score_player / compare_players / simulate_captain for "who's better / who to captain" questions. simulate_transfer is a HYPOTHETICAL teaching tool: explain the projected-points effect of a swap, but never tell the visitor they "should" make a transfer — there is no team to manage.

## Current situation
GW${a.currentGw}. This is a sample squad — there is no bank, free-transfer, or chip state.

${FORMAT_GUIDE}

## What to say
The visitor can see the sample squad and its 0–10 ratings on screen. Answer the actual question with reasoning: why one option over another, the key trade-off, and context the raw numbers don't show (recent form vs underlying, fixtures, value). Reference specific players and numbers.${expertKnowledgeBlock()}`;
}
