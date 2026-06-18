import type { HorizonEntry, ChipRecommendation, RestructureOption } from "./types";
import type { ChipsRemaining, ManagerProfile } from "../types";
import { llm } from "../llm/client";

export interface LongTermInput {
  horizon: HorizonEntry[];
  chipRecommendations: ChipRecommendation[];
  restructureOptions: RestructureOption[];
  chipsRemaining: ChipsRemaining;
  currentGw: number;
  riskProfile: ManagerProfile["riskProfile"];
}

/**
 * Long-term verdict — a separate LLM call (parallel to the weekly synthesis)
 * that writes plain-English strategic prose about transfer timing over the
 * horizon and chip sequencing. Returns the response text directly, or `null`
 * (missing key / error / nothing to plan) so the UI falls back to the
 * deterministic summary.
 */
export async function synthesizeLongTerm(input: LongTermInput): Promise<string | null> {
  // Nothing to plan → skip the call; the deterministic fallback handles the empty state.
  if (input.horizon.length === 0 && input.chipRecommendations.length === 0) {
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[long-term-synthesis] ANTHROPIC_API_KEY not set — falling back");
    return null;
  }

  try {
    const text = (
      await llm.complete({ prompt: buildLongTermPrompt(input), maxTokens: 600 })
    ).trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[long-term-synthesis] API call failed:", msg);
    return null;
  }
}

function buildLongTermPrompt(input: LongTermInput): string {
  const { horizon, chipRecommendations, restructureOptions, chipsRemaining, currentGw, riskProfile } = input;

  const tone =
    riskProfile.rankTrend === "rising"
      ? "The manager is protecting a rising rank — favour patient, lower-variance planning."
      : riskProfile.rankTrend === "falling" && riskProfile.gwsRemaining < 10
        ? "The manager is chasing rank with little time left — be willing to endorse bolder, earlier moves."
        : "Balance patience against upside.";

  const held = (["wildcard", "freeHit", "benchBoost", "tripleCaptain"] as const)
    .filter((k) => chipsRemaining[k] > 0);

  return `You are an FPL strategist writing a short LONG-TERM outlook for a manager at GW${currentGw}. ${tone}

## Transfer horizon (next 5 GWs)
${JSON.stringify(
    horizon.map((h) => ({
      target: h.candidate.player.webName,
      replacing: h.weakPlayer.player.webName,
      timing: h.timing, // BUY_NOW | WAIT | BUY_NOW_SELL_LATER
      fixtureSwing: h.fixtureSwing,
      cumulativeGain: h.cumulativeGain.map((g) => g.toFixed(2)),
    })),
    null,
    2
  )}

## Restructure options (sell-to-fund a stronger target)
${JSON.stringify(
    restructureOptions.map((r) => ({
      dreamTarget: r.dreamTarget.candidate.player.webName,
      sell: r.downgradedPlayer.player.webName,
      buy: r.downgradeReplacement.player.webName,
      netScoreChange: r.netScoreChange.toFixed(2),
      totalCost: r.totalCost,
    })),
    null,
    2
  )}

## Chips
- Remaining: ${held.length ? held.join(", ") : "none"}
- Recommended windows: ${JSON.stringify(
    chipRecommendations.map((c) => ({ chip: c.chip, gw: c.triggerGw, reason: c.reason }))
  )}

## Instructions
The transfer horizon and chip windows are ALREADY shown as a chart and timeline on screen. Write 2–4 sentences of plain-English LONG-TERM insight the chart can't convey: the strategic logic behind the timing (why buy now vs wait — what fixture swing or price trend drives it), how to sequence the chips and what that decision hinges on, and the main risk to the plan. Be specific with player names and gameweeks, but explain the WHY rather than re-listing the moves. Do NOT restate this week's single transfer. Return ONLY the prose, no preamble, no JSON.`;
}
