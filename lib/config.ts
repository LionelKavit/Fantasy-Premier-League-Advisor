import type { Position } from "./types";

export const SCORING_WEIGHTS: Record<Position, Record<string, number>> = {
  FWD: {
    goalThreat: 0.35,
    assistPotential: 0.18,
    form: 0.10,
    bonus: 0.08,
    fixture: 0.14,
    minutes: 0.05,
    value: 0.10,
  },
  MID: {
    goalThreat: 0.28,
    assistPotential: 0.15,
    form: 0.10,
    cleanSheet: 0.08,
    bonus: 0.08,
    fixture: 0.14,
    minutes: 0.07,
    value: 0.10,
  },
  DEF: {
    cleanSheet: 0.25,
    xgcRate: 0.10,
    defensive: 0.08,
    goalAssistSetPiece: 0.12,
    form: 0.08,
    bonus: 0.10,
    fixture: 0.10,
    minutes: 0.07,
    value: 0.10,
  },
  GK: {
    cleanSheet: 0.30,
    xgcRate: 0.10,
    saves: 0.18,
    form: 0.08,
    bonus: 0.08,
    fixture: 0.10,
    minutes: 0.03,
    value: 0.10,
    suspensionPenalty: 0.03,
  },
};

export const NORMALIZATION_BOUNDS: Record<string, { min: number; max: number; inverted?: boolean }> = {
  goalThreat: { min: 0, max: 0.8 },
  assistPotential: { min: 0, max: 0.5 },
  formSignal: { min: 0, max: 12 },
  bonusEfficiency: { min: 0, max: 35 },
  setPieceValue: { min: 0, max: 0.28 },
  valueScore: { min: 0, max: 1.5 },
  cleanSheetRate: { min: 0, max: 0.6 },
  xgcRate: { min: 0.5, max: 2.0, inverted: true },
  defensiveScore: { min: 0, max: 15 },
  savesRate: { min: 0, max: 5 },
  minutesReliability: { min: 0, max: 1.0 },
  suspensionRisk: { min: 0, max: 1.0, inverted: true },
};

export const SUSPENSION_THRESHOLDS = {
  yellowBeforeGw19: 5,
  yellowBeforeGw32: 10,
  redCardPenalty: 0.2,
};

export const TREND_THRESHOLDS = {
  rollingWindow: 5,
  minGws: 3,
  slopeRising: 0.02,
  slopeFalling: -0.02,
  gapWideningThreshold: 0.15,
  finisherMinSeasons: 3,
};

export const REGRESSION_ADDITIVES = {
  BUY: 0.03,
  HIDDEN_GEM_BUY: 0.05,
  SELL_RISK: -0.05,
  SELL: -0.06,
  FINISHER_PREMIUM: 0.02,
};

export const LLM_SIGNAL_RANGES: Record<string, [number, number]> = {
  rotationRisk: [0, 1],
  oopBonus: [0, 0.10],
  injurySeverity: [0, 1],
  tacticalBoost: [-0.05, 0.10],
  opponentKeyAbsence: [0, 0.05],
};

export const PIPELINE_CONFIG = {
  minMinutes: 270,
  candidatePoolPerPosition: 10,
  candidatesPerWeakSpot: 5,
  fdrRunLength: 5,
  insufficientDataFallbackScore: 0.3,
};

export const OPPONENT_ABSENCE_MULTIPLIER: Record<Position, number> = {
  FWD: 1.0,
  MID: 1.0,
  DEF: 1.5,
  GK: 2.0,
};

// Captaincy is ceiling-weighted and single-gameweek focused, unlike the
// floor/value-weighted transfer composite. These constants drive captain scoring.
export const CAPTAIN_CONFIG = {
  // Base projection (rough expected points for one match)
  appearancePoints: 2,
  assistPoints: 3,
  pointsPerGoal: { GK: 6, DEF: 6, MID: 5, FWD: 4 } as Record<Position, number>,
  // Blend FPL's own expected points (ep) with the model projection for the
  // immediate next gameweek (ep only exists for that GW).
  epBlendWeight: 0.5,
  // Ceiling boost — rewards explosiveness/upside beyond the mean
  penaltyTakerPremium: 1.0,
  threatCeilingWeight: 1.0,
  threatPer90Norm: 80, // threat-per-90 value treated as ~1.0 of ceiling
  // Fixture multiplier: 1 at FDR 3 (neutral), scaled per step, plus home bonus
  fixtureStepK: 0.12,
  homeBonus: 0.05,
  fixtureMultiplierMin: 0.6,
  fixtureMultiplierMax: 1.4,
  // DGW multiplier: second fixture adds between these bounds, scaled by its FDR
  dgwSecondFixtureMin: 0.5,
  dgwSecondFixtureMax: 1.0,
  // Minutes certainty gate
  rotationPenaltyWeight: 0.5,
  // Differential / vice / triple-captain
  differentialOwnershipThreshold: 0.15, // effective ownership below this = differential
  differentialBand: 0.85, // differential option must score >= band × top score
  tripleCaptainMargin: 1.25, // horizon peak must exceed baseline × this to recommend TC
  captainDoubtfulChanceAlert: 75, // alert if recommended captain chance <= this
  horizonLengthDefault: 5,
};
