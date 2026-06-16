import type {
  CaptainSynthesisInput,
  CaptainResult,
  CaptainCandidate,
} from "./types";
import { CAPTAIN_CONFIG } from "../config";

export async function synthesizeCaptainPick(
  inputs: CaptainSynthesisInput
): Promise<CaptainResult> {
  const failSafe = buildFailSafe(inputs);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[captain-synthesis] ANTHROPIC_API_KEY not set — using fail-safe");
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, "Captain synthesis unavailable: API key not set"],
    };
  }

  try {
    const prompt = buildPrompt(inputs);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    const parsed = parseResult(text, inputs);
    if (parsed) return parsed;

    console.error("[captain-synthesis] Failed to parse LLM response");
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, "Captain synthesis failed: malformed response"],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[captain-synthesis] API call failed:", msg);
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, `Captain synthesis failed: ${msg}`],
    };
  }
}

function buildPrompt(inputs: CaptainSynthesisInput): string {
  const { managerProfile, rankedCandidates, viceCaptain, differentialOption, horizon, tripleCaptainAdvice, currentGw } = inputs;
  const rp = managerProfile.riskProfile;

  const strategyBias =
    rp.rankTrend === "rising"
      ? "Protect rank — favor the template (highly-owned, safe) captain unless a differential is clearly superior."
      : rp.rankTrend === "falling" && rp.gwsRemaining < 10
        ? "Chase rank — be willing to endorse a differential captain to gain ground."
        : "Balanced — weigh the safe pick against differential upside.";

  return `You are an FPL captaincy advisor for GW${currentGw}. The manager is ranked ${rp.currentRank} (trend: ${rp.rankTrend}, ${rp.gwsRemaining} GWs remaining).

Strategy guidance: ${strategyBias}

## Captain candidates (starting XI, ranked by captain score)
${JSON.stringify(rankedCandidates.slice(0, 6).map(fmt), null, 2)}

## Vice-captain (auto-fallback, different match)
${viceCaptain ? JSON.stringify(fmt(viceCaptain), null, 2) : "null"}

## Differential option
${differentialOption ? JSON.stringify(fmt(differentialOption), null, 2) : "null"}

## Captain horizon (best captain per upcoming GW)
${JSON.stringify(horizon.map((h) => ({ gw: h.gameweek, player: h.bestCaptain.player.player.webName, score: h.bestScore.toFixed(2), isDgw: h.isDgw })), null, 2)}

## Triple Captain advice
${tripleCaptainAdvice ? JSON.stringify(tripleCaptainAdvice, null, 2) : "null"}

## Instructions
Pick the captain (usually the top-ranked, but you may prefer the template or differential per the strategy). Keep the vice-captain as given unless you have strong reason. Output JSON only:
{
  "captainName": "web name of chosen captain",
  "confidence": "high|medium|low",
  "narrativeSummary": "2-4 sentences: who to captain, why, and any TC/differential note",
  "alerts": ["string"]
}
Return ONLY valid JSON.`;
}

function fmt(c: CaptainCandidate) {
  return {
    name: c.player.player.webName,
    team: c.player.player.teamName,
    position: c.player.player.position,
    captainScore: c.captainScore.total.toFixed(2),
    isDgw: c.captainScore.isDgw,
    effectiveOwnership: (c.effectiveOwnership * 100).toFixed(1) + "%",
    isDifferential: c.isDifferential,
    why: c.whyCaptain,
  };
}

function parseResult(
  text: string,
  inputs: CaptainSynthesisInput
): CaptainResult | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const raw = JSON.parse(match[0]);
    if (!raw.captainName || !raw.narrativeSummary) return null;

    const chosen =
      inputs.rankedCandidates.find(
        (c) => c.player.player.webName === raw.captainName
      ) ?? inputs.rankedCandidates[0];

    return {
      captain: chosen,
      viceCaptain: inputs.viceCaptain,
      differentialOption: inputs.differentialOption,
      rankedCandidates: inputs.rankedCandidates,
      tripleCaptainAdvice: inputs.tripleCaptainAdvice,
      confidence: validateConfidence(raw.confidence),
      narrativeSummary: raw.narrativeSummary,
      alerts: buildAlerts(inputs, chosen, raw.alerts ?? []),
      currentGw: inputs.currentGw,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function validateConfidence(raw: unknown): "high" | "medium" | "low" {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

function buildAlerts(
  inputs: CaptainSynthesisInput,
  captain: CaptainCandidate | undefined,
  llmAlerts: string[]
): string[] {
  const alerts: string[] = [...llmAlerts];

  if (!captain) return alerts;
  const chance = captain.player.player.availability.chanceOfPlayingNext;
  if (chance !== null && chance <= CAPTAIN_CONFIG.captainDoubtfulChanceAlert) {
    alerts.push(
      `Captain ${captain.player.player.webName} is doubtful (${chance}% chance) — confirm the vice-captain before the deadline`
    );
  }

  const tc = inputs.tripleCaptainAdvice;
  if (tc?.recommended && tc.targetGw !== null && tc.targetGw - inputs.currentGw <= 2) {
    alerts.push(
      `Triple Captain window approaching: consider GW${tc.targetGw} for ${tc.targetPlayer}`
    );
  }

  return alerts;
}

function buildFailSafe(inputs: CaptainSynthesisInput): CaptainResult {
  const captain = inputs.rankedCandidates[0];
  return {
    captain,
    viceCaptain: inputs.viceCaptain,
    differentialOption: inputs.differentialOption,
    rankedCandidates: inputs.rankedCandidates,
    tripleCaptainAdvice: inputs.tripleCaptainAdvice,
    confidence: "low",
    narrativeSummary: captain
      ? `Automated pick: captain ${captain.player.player.webName} (highest projected return this gameweek). Review manually.`
      : "No viable captain candidate found.",
    alerts: buildAlerts(inputs, captain, []),
    currentGw: inputs.currentGw,
    generatedAt: new Date().toISOString(),
  };
}
