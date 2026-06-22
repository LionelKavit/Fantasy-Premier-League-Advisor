import type {
  SynthesisInput,
  OptimizerResult,
  TransferAction,
  ValidTransfer,
  SingleTransferResult,
  HitTransferResult,
} from "./types";
import { llm } from "../llm/client";
import { loadKnowledge } from "../knowledge";
import { SCOUT_PERSONA } from "../llm/persona";

// Deterministic, code-authored notice (transfer-ep-notice) — surfaced when the optimizer
// held transfers because ep_next is unavailable, independent of the LLM narrative.
const EP_UNAVAILABLE_NOTICE =
  "Transfer recommendations are paused — FPL hasn't published expected points (ep_next) for the upcoming gameweek yet. They'll resume once projections are available.";
function epDataNotice(singleResult: SingleTransferResult): string | null {
  return singleResult.holdReason === "ep_unavailable" ? EP_UNAVAILABLE_NOTICE : null;
}

export async function synthesizeRecommendation(
  inputs: SynthesisInput
): Promise<OptimizerResult> {
  const failSafe = buildFailSafe(inputs);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[synthesis] ANTHROPIC_API_KEY not set — using fail-safe");
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, "LLM synthesis unavailable: API key not set"],
    };
  }

  try {
    const prompt = buildPrompt(inputs);
    const text = await llm.complete({ prompt, maxTokens: 4096, system: SCOUT_PERSONA });

    const parsed = parseOptimizerResult(text, inputs);
    if (parsed) return parsed;

    console.error("[synthesis] Failed to parse LLM response");
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, "LLM synthesis failed: malformed response"],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[synthesis] API call failed:", msg);
    return {
      ...failSafe,
      alerts: [...failSafe.alerts, `LLM synthesis failed: ${msg}`],
    };
  }
}

function buildPrompt(inputs: SynthesisInput): string {
  const { managerProfile, singleResult, hitResult, restructureOptions, horizon, chipRecommendations, freeTransfers, validTransfers } = inputs;
  const rp = managerProfile.riskProfile;

  const riskBias =
    rp.rankTrend === "rising" && rp.totalHitsTaken < 3
      ? "This manager is risk-averse — bias toward ROLL or free transfers over hits."
      : rp.rankTrend === "falling" && rp.gwsRemaining < 10
        ? "This manager should be aggressive — consider hits and wildcards more readily."
        : "Balanced approach — weigh immediate vs long-term gains.";

  const rankPrinciples = loadKnowledge("rank-strategy");
  const principlesBlock = rankPrinciples
    ? `\n## Expert rank principles (apply these)\n${rankPrinciples}\n`
    : "";

  return `Analyze this manager's GW${inputs.analysis.currentGw} transfer options. They are ranked ${rp.currentRank}.
${principlesBlock}
## Context
- Rank trend: ${rp.rankTrend} (best: ${rp.bestRank})
- GWs remaining: ${rp.gwsRemaining}
- Hits taken this season: ${rp.totalHitsTaken} (cost: ${rp.totalHitCost} pts)
- Free transfers: ${freeTransfers}
- Bank: £${inputs.analysis.bank.toFixed(1)}m
- Chips remaining: ${JSON.stringify(inputs.analysis.chipsRemaining)}
- Risk guidance: ${riskBias}

## Node Outputs

### Valid Transfers (${validTransfers.length})
${JSON.stringify(validTransfers.map(vt => ({
  out: vt.weakPlayer.player.webName,
  in: vt.candidate.player.webName,
  gw1Gain: vt.gw1Gain.toFixed(3),
  gw5Gain: vt.gw5Gain.toFixed(3),
  priceDelta: vt.priceDelta.toFixed(1),
})), null, 2)}

### Single Transfer Result
${JSON.stringify({
  bestSingle: singleResult.bestSingle ? formatTransfer(singleResult.bestSingle) : null,
  bestSecond: singleResult.bestSecond ? formatTransfer(singleResult.bestSecond) : null,
  rollReason: singleResult.rollReason,
  savingsOption: singleResult.savingsOption ? formatTransfer(singleResult.savingsOption) : null,
  alternatives: singleResult.alternatives.map(formatTransfer),
}, null, 2)}

### Hit Transfer Result
${JSON.stringify({
  singleHit: hitResult.singleHit ? {
    transfers: hitResult.singleHit.transfers.map(formatTransfer),
    netGain: hitResult.singleHit.netGain,
    breakEvenGw: hitResult.singleHit.breakEvenGw,
  } : null,
  doubleHit: hitResult.doubleHit ? {
    transfers: hitResult.doubleHit.transfers.map(formatTransfer),
    netGain: hitResult.doubleHit.netGain,
    breakEvenGw: hitResult.doubleHit.breakEvenGw,
  } : null,
}, null, 2)}

### Restructure Options (${restructureOptions.length})
${JSON.stringify(restructureOptions.map(ro => ({
  dreamTarget: ro.dreamTarget.candidate.player.webName,
  downgrade: ro.downgradedPlayer.player.webName,
  replacement: ro.downgradeReplacement.player.webName,
  netScoreChange: ro.netScoreChange.toFixed(3),
  totalCost: ro.totalCost,
})), null, 2)}

### Horizon Projections (${horizon.length})
${JSON.stringify(horizon.map(h => ({
  candidate: h.candidate.player.webName,
  replacing: h.weakPlayer.player.webName,
  timing: h.timing,
  fixtureSwing: h.fixtureSwing,
  cumulativeGain: h.cumulativeGain.map(g => g.toFixed(3)),
})), null, 2)}

### Chip Recommendations (${chipRecommendations.length})
${JSON.stringify(chipRecommendations.map(c => ({
  chip: c.chip,
  triggerGw: c.triggerGw,
  reason: c.reason,
})), null, 2)}

## Instructions
Evaluate conflicts between recommendations. Consider the manager's risk tolerance. Output JSON matching the OptimizerResult schema exactly. (Chip timing is decided separately — do not recommend playing a chip here.)

The narrativeSummary is shown ALONGSIDE the structured recommendation — the chosen transfer, restructure chain, hit verdict and captain are already displayed as chips and rows on screen. So do NOT restate which move to make. Instead, in 2-4 sentences, give the INSIGHT the numbers don't show: why this option beats the alternatives, the key trade-off or risk being accepted, and context such as recent form vs underlying stats, fixture swing, ownership/template, or timing. Add reasoning, not a summary.

For hitVerdict.reasoning: explain the judgement (is the points hit worth it and why), not just the verdict.

For secondaryRecommendation: suggest a plan for next week if applicable (e.g. a WAIT-timed horizon transfer, or rolling for 2 FTs).

## Output Schema
{
  "primaryRecommendation": { "type": "FREE|HIT_SINGLE|HIT_DOUBLE|ROLL", "transfers": [{"outPlayer": "name", "inPlayer": "name"}], "netPointsCost": number, "netGain": number, "breakEvenGw": number|null },
  "secondaryRecommendation": same shape or null,
  "hitVerdict": { "recommended": boolean, "reasoning": "string", "breakEvenGw": number|null },
  "confidence": "high|medium|low",
  "narrativeSummary": "2-4 sentences of plain English",
  "alerts": ["string"]
}

Return ONLY valid JSON. No explanation.`;
}

function formatTransfer(vt: ValidTransfer) {
  return {
    out: vt.weakPlayer.player.webName,
    in: vt.candidate.player.webName,
    gw1Gain: vt.gw1Gain.toFixed(3),
    gw5Gain: vt.gw5Gain.toFixed(3),
    priceDelta: vt.priceDelta.toFixed(1),
  };
}

function parseOptimizerResult(
  text: string,
  inputs: SynthesisInput
): OptimizerResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const raw = JSON.parse(jsonMatch[0]);

    if (!raw.primaryRecommendation || !raw.narrativeSummary) return null;

    const primaryAction = mapTransferAction(
      raw.primaryRecommendation,
      inputs.validTransfers,
      inputs.singleResult,
      inputs.hitResult
    );

    let secondaryAction: TransferAction | null = null;
    if (raw.secondaryRecommendation) {
      secondaryAction = mapTransferAction(
        raw.secondaryRecommendation,
        inputs.validTransfers,
        inputs.singleResult,
        inputs.hitResult
      );
    }

    // Risk alerts are computed centrally (lib/alerts) and surfaced on plan.alerts;
    // the success path no longer emits the model's free-form alerts.
    const alerts: string[] = [];

    return {
      primaryRecommendation: primaryAction,
      secondaryRecommendation: secondaryAction,
      hitVerdict: {
        recommended: raw.hitVerdict?.recommended ?? false,
        reasoning: raw.hitVerdict?.reasoning ?? "No hit analysis available",
        breakEvenGw: raw.hitVerdict?.breakEvenGw ?? null,
      },
      chipPlan: inputs.chipRecommendations,
      restructureOptions: inputs.restructureOptions,
      horizon: inputs.horizon,
      alerts,
      confidence: validateConfidence(raw.confidence),
      narrativeSummary: raw.narrativeSummary,
      generatedAt: new Date().toISOString(),
      dataNotice: epDataNotice(inputs.singleResult),
    };
  } catch {
    return null;
  }
}

function mapTransferAction(
  raw: { type?: string; netPointsCost?: number; netGain?: number; breakEvenGw?: number | null },
  validTransfers: ValidTransfer[],
  singleResult: SingleTransferResult,
  hitResult: HitTransferResult
): TransferAction {
  const type = raw.type ?? "ROLL";

  switch (type) {
    case "FREE":
      return {
        type: "FREE",
        transfers: singleResult.bestSingle ? [singleResult.bestSingle] : [],
        netPointsCost: 0,
        netGain: singleResult.bestSingle?.gw1Gain ?? 0,
        breakEvenGw: null,
      };
    case "HIT_SINGLE":
      return {
        type: "HIT_SINGLE",
        transfers: hitResult.singleHit?.transfers ?? [],
        netPointsCost: -4,
        netGain: hitResult.singleHit?.netGain ?? 0,
        breakEvenGw: hitResult.singleHit?.breakEvenGw ?? null,
      };
    case "HIT_DOUBLE":
      return {
        type: "HIT_DOUBLE",
        transfers: hitResult.doubleHit?.transfers ?? [],
        netPointsCost: -8,
        netGain: hitResult.doubleHit?.netGain ?? 0,
        breakEvenGw: hitResult.doubleHit?.breakEvenGw ?? null,
      };
    default:
      return {
        type: "ROLL",
        transfers: [],
        netPointsCost: 0,
        netGain: 0,
        breakEvenGw: null,
      };
  }
}

function validateConfidence(
  raw: unknown
): "high" | "medium" | "low" {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

function buildFailSafe(inputs: SynthesisInput): OptimizerResult {
  const { singleResult, chipRecommendations, restructureOptions, horizon } = inputs;

  let primaryRecommendation: TransferAction;
  if (singleResult.bestSingle) {
    primaryRecommendation = {
      type: "FREE",
      transfers: [singleResult.bestSingle],
      netPointsCost: 0,
      netGain: singleResult.bestSingle.gw1Gain,
      breakEvenGw: null,
    };
  } else {
    primaryRecommendation = {
      type: "ROLL",
      transfers: [],
      netPointsCost: 0,
      netGain: 0,
      breakEvenGw: null,
    };
  }

  return {
    primaryRecommendation,
    secondaryRecommendation: null,
    hitVerdict: {
      recommended: false,
      reasoning: "LLM synthesis unavailable",
      breakEvenGw: null,
    },
    chipPlan: chipRecommendations,
    restructureOptions,
    horizon,
    alerts: [],
    confidence: "low",
    narrativeSummary:
      "Automated recommendation without AI synthesis. Review manually.",
    generatedAt: new Date().toISOString(),
    dataNotice: epDataNotice(singleResult),
  };
}
