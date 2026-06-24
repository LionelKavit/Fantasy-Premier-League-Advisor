import type {
  CaptainSynthesisInput,
  CaptainResult,
  CaptainCandidate,
} from "./types";
import { llm } from "../llm/client";
import { loadKnowledge } from "../knowledge";
import { SCOUT_PERSONA } from "../llm/persona";

export async function synthesizeCaptainPick(
  inputs: CaptainSynthesisInput,
  opts: { demo?: boolean } = {}
): Promise<CaptainResult> {
  const demo = opts.demo ?? false;
  const failSafe = buildFailSafe(inputs, demo);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[captain-synthesis] ANTHROPIC_API_KEY not set — using fail-safe");
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, "Captain synthesis unavailable: API key not set"],
    };
  }

  try {
    const prompt = buildPrompt(inputs, demo);
    const text = await llm.complete({ prompt, maxTokens: 2048, system: SCOUT_PERSONA });

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

export function buildPrompt(inputs: CaptainSynthesisInput, demo = false): string {
  const { managerProfile, rankedCandidates, viceCaptain, differentialOption, horizon, tripleCaptainAdvice, currentGw } = inputs;
  const rp = managerProfile.riskProfile;

  // Demo mode has no manager behind the squad — keep the captaincy reasoning
  // general (no rank, no rank-chasing bias), so the prose never implies ownership.
  const strategyBias = demo
    ? "Balanced — weigh the safe, high-floor pick against differential upside on merit."
    : rp.rankTrend === "rising"
      ? "Protect rank — favor the template (highly-owned, safe) captain unless a differential is clearly superior."
      : rp.rankTrend === "falling" && rp.gwsRemaining < 10
        ? "Chase rank — be willing to endorse a differential captain to gain ground."
        : "Balanced — weigh the safe pick against differential upside.";

  const rankPrinciples = demo ? null : loadKnowledge("rank-strategy");
  const principlesBlock = rankPrinciples
    ? `\n## Expert rank principles (apply these)\n${rankPrinciples}\n`
    : "";

  const opening = demo
    ? `Pick the captain for GW${currentGw} from this sample squad (a general showcase team, not a specific manager's). Speak generally — never reference a manager's rank or "your team".`
    : `Pick this manager's captain for GW${currentGw}. They are ranked ${rp.currentRank} (trend: ${rp.rankTrend}, ${rp.gwsRemaining} GWs remaining).`;

  return `${opening}

Strategy guidance: ${strategyBias}
${principlesBlock}
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
      // Risk alerts (incl. captain availability) are computed centrally in lib/alerts
      // and surfaced on plan.alerts; the success path emits no alerts.
      alerts: [],
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

function buildFailSafe(inputs: CaptainSynthesisInput, demo = false): CaptainResult {
  const captain = inputs.rankedCandidates[0];
  const narrativeSummary = captain
    ? demo
      ? `Top projected captain this gameweek: ${captain.player.player.webName}.`
      : `Automated pick: captain ${captain.player.player.webName} (highest projected return this gameweek). Review manually.`
    : "No viable captain candidate found.";
  return {
    captain,
    viceCaptain: inputs.viceCaptain,
    differentialOption: inputs.differentialOption,
    rankedCandidates: inputs.rankedCandidates,
    tripleCaptainAdvice: inputs.tripleCaptainAdvice,
    confidence: "low",
    narrativeSummary,
    alerts: [], // risk alerts computed centrally (lib/alerts); system notices appended by callers
    currentGw: inputs.currentGw,
    generatedAt: new Date().toISOString(),
  };
}
