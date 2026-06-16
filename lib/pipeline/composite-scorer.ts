import type { Position } from "../types";
import type {
  StatisticalSignals,
  TrendSignals,
  FixtureSignals,
  MarketSignals,
  LlmContextSignals,
  CompositeScore,
} from "./types";
import { normalizeSignal, normalizeInverted } from "./normalize";
import {
  SCORING_WEIGHTS,
  NORMALIZATION_BOUNDS,
  PIPELINE_CONFIG,
  OPPONENT_ABSENCE_MULTIPLIER,
} from "../config";

// Market signals are stored on ScoredPlayer for the synthesis/optimizer nodes but do not
// contribute to the base composite score — the spec's weight mappings use only statistical,
// fixture, trend, and LLM signals.
export function computeCompositeScore(
  stats: StatisticalSignals,
  trend: TrendSignals | null,
  fixture: FixtureSignals,
  market: MarketSignals,
  llm: LlmContextSignals,
  position: Position,
  totalMinutes: number
): CompositeScore {
  if (totalMinutes < PIPELINE_CONFIG.minMinutes) {
    return {
      total: PIPELINE_CONFIG.insufficientDataFallbackScore,
      breakdown: {},
      trendAdjustment: 0,
      llmAdjustment: 0,
      trendClassification: null,
      position,
    };
  }

  const signalMap = buildSignalMap(stats, fixture, position);
  const weights = SCORING_WEIGHTS[position];

  const breakdown: Record<string, number> = {};
  let baseScore = 0;

  for (const [category, weight] of Object.entries(weights)) {
    const signalValue = signalMap[category] ?? 0;
    const contribution = signalValue * weight;
    breakdown[category] = contribution;
    baseScore += contribution;
  }

  breakdown.epNextSignal = market.epNextSignal;
  breakdown.differentialValue = market.differentialValue;
  breakdown.transferMomentum = market.transferMomentum;

  const trendAdjustment = trend?.additive ?? 0;

  const posMultiplier = OPPONENT_ABSENCE_MULTIPLIER[position];
  const llmAdjustment =
    -llm.rotationRisk * 0.15 +
    llm.oopBonus +
    llm.tacticalBoost +
    llm.opponentKeyAbsence * posMultiplier -
    llm.injurySeverity * 0.2;

  const suspensionPenalty = stats.suspensionRisk * 0.05;

  const total = Math.max(
    0,
    Math.min(1, baseScore + trendAdjustment + llmAdjustment - suspensionPenalty)
  );

  return {
    total,
    breakdown,
    trendAdjustment,
    llmAdjustment,
    trendClassification: trend?.classification ?? null,
    position,
  };
}

function buildSignalMap(
  stats: StatisticalSignals,
  fixture: FixtureSignals,
  position: Position
): Record<string, number> {
  const b = NORMALIZATION_BOUNDS;

  const nGoalThreat = normalizeSignal(stats.goalThreat, b.goalThreat.min, b.goalThreat.max);
  const nAssistPotential = normalizeSignal(stats.assistPotential, b.assistPotential.min, b.assistPotential.max);
  const nForm = normalizeSignal(stats.formSignal, b.formSignal.min, b.formSignal.max);
  const nBonus = normalizeSignal(stats.bonusEfficiency, b.bonusEfficiency.min, b.bonusEfficiency.max);
  const nSetPiece = normalizeSignal(stats.setPieceValue, b.setPieceValue.min, b.setPieceValue.max);
  const nValue = normalizeSignal(stats.valueScore, b.valueScore.min, b.valueScore.max);
  const nCleanSheet = normalizeSignal(stats.cleanSheetRate, b.cleanSheetRate.min, b.cleanSheetRate.max);
  const nXgcRate = normalizeInverted(stats.xgcRate, b.xgcRate.min, b.xgcRate.max);
  const nDefensive = normalizeSignal(stats.defensiveScore, b.defensiveScore.min, b.defensiveScore.max);
  const nSaves = normalizeSignal(stats.savesRate, b.savesRate.min, b.savesRate.max);
  const nMinutes = Math.max(0, Math.min(1, stats.minutesReliability));
  const nSuspension = normalizeInverted(stats.suspensionRisk, b.suspensionRisk.min, b.suspensionRisk.max);

  switch (position) {
    case "FWD":
      return {
        goalThreat: nGoalThreat,
        assistPotential: nAssistPotential,
        form: nForm,
        bonus: nBonus,
        fixture: fixture.fdrScore,
        minutes: nMinutes,
        value: nValue,
      };
    case "MID":
      return {
        goalThreat: nGoalThreat,
        assistPotential: nAssistPotential,
        form: nForm,
        cleanSheet: nCleanSheet,
        bonus: nBonus,
        fixture: fixture.fdrScore,
        minutes: nMinutes,
        value: nValue,
      };
    case "DEF":
      return {
        cleanSheet: nCleanSheet,
        xgcRate: nXgcRate,
        defensive: nDefensive,
        goalAssistSetPiece: (nGoalThreat + nAssistPotential + nSetPiece) / 3,
        form: nForm,
        bonus: nBonus,
        fixture: fixture.fdrScore,
        minutes: nMinutes,
        value: nValue,
      };
    case "GK":
      return {
        cleanSheet: nCleanSheet,
        xgcRate: nXgcRate,
        saves: nSaves,
        form: nForm,
        bonus: nBonus,
        fixture: fixture.fdrScore,
        minutes: nMinutes,
        value: nValue,
        suspensionPenalty: nSuspension,
      };
  }
}
