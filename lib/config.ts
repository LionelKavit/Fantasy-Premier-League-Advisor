import type { Position } from "./types";

// Data-fit weights (composite-clamp-relax): per-position ridge coefficients from the
// composite-backtest dataset, at full magnitude (signed; incl. the negative price/`value`
// correction — pricier players score slightly lower per projected point). FPL's `epNext`
// dominates and is injected into the signal map in `composite-scorer.ts`. The backtest's
// `epNextSignal` is normalized the SAME way the runtime is (`epNext / poolMaxEpNext`), so
// these coefficients transfer faithfully. They rank ~0.53 in the backtest — but ONLY with
// the monotonic logistic squash below (a hard [0,1] clamp would tie the negative tail at 0).
export const SCORING_WEIGHTS: Record<Position, Record<string, number>> = {
  FWD: {
    epNext: 11.8794,
    assistPotential: 1.4233,
    form: 2.3096,
    fixture: 0.7787,
    minutes: 1.1334,
    goalThreat: -0.4541,
    bonus: -3.0614,
    value: -3.4376,
  },
  MID: {
    epNext: 12.6451,
    assistPotential: 1.452,
    form: 3.7499,
    fixture: 2.8487,
    minutes: 0.8095,
    goalThreat: -0.5482,
    bonus: -2.8853,
    value: -4.5302,
  },
  DEF: {
    epNext: 10.4106,
    xgcRate: 3.2131,
    form: 3.6749,
    fixture: 2.8699,
    minutes: 2.9633,
    cleanSheet: -1.131,
    goalAssistSetPiece: -0.177,
    bonus: -0.1112,
    value: -3.4238,
  },
  GK: {
    epNext: 11.54,
    xgcRate: 5.005,
    saves: 2.9682,
    form: 6.063,
    bonus: 5.0195,
    fixture: 1.6599,
    minutes: 1.9908,
    cleanSheet: -1.6626,
    suspensionPenalty: -1.4593,
    value: -13.2387,
  },
};

// Composite range mapping (composite-clamp-relax): a strictly-monotonic logistic
// squash replaces the old hard `clamp01`. The raw weighted sum has wide range (epNext
// coef ~40), so the base dominates the small additive trend/suspension terms and the
// fit's ranking is preserved; the squash maps it to (0,1) for the "/10" display and
// downstream [0,1] consumers. Calibrated from the training raw-score distribution.
export const COMPOSITE_SQUASH = { center: 3.0965, scale: 1.8508 };

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

// Transfer-vs-hold gate (transfer-hold-threshold): a transfer is recommended only if its
// projected POINTS gain clears a bar — otherwise hold/roll. Denominated in `ep_next` (FPL's
// expected points), anchored to the one hard FPL number: a hit costs 4 pts.
//  - hitCostEp 4   : exact — a hit move must out-project the points it costs.
//  - freeTransferEp 1.5 : the free-transfer opportunity cost. Data noise floor is ~0.5 Δep
//    (below which a swap is a coin flip); banking the FT to make a typical worthwhile move
//    (~1.5 Δep) later raises the bar to ~1.5 — which also matches the FPL ~1.5–2 heuristic.
// When `ep_next` is unavailable we HOLD: the squad-eval calibration showed transfers chosen on
// the composite alone (ep absent) are negative-EV at every gain level (realized −2 to −4 pts,
// P(gain>0) 0.33–0.42), so we don't spend a transfer without FPL's projection to justify it.
export const TRANSFER_THRESHOLDS = {
  freeTransferEp: 1.5,
  hitCostEp: 4,
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

// Season chip calendar (2025/26 — update each season; mirrors lib/knowledge/chips.md).
// Two sets of chips: the first expires at the GW19 deadline, the second unlocks at
// GW20 and expires at GW38. A held chip can only be played within its half.
export const CHIP_CALENDAR = {
  firstHalfExpiryGw: 19,
  secondHalfStartGw: 20,
  seasonEndGw: 38,
  expiryPressureGws: 4, // raise urgency when the current half's deadline is within this many GWs
};

// Deterministic Wildcard trigger: a Wildcard window opens on a fixture swing (a chunk
// of the XI facing a hard upcoming run) or to set up a near-term Double Gameweek —
// NOT merely because upgrades are available.
export const WILDCARD_TRIGGER = {
  lookahead: 4, // gameweeks of fixtures to assess for the swing
  hardFdr: 3.5, // average FDR at/above which a run counts as "hard"
  hardStartersMin: 6, // # of starting XI in a hard run to call it a swing
  dgwSetupLookahead: 4, // a DGW within this many GWs opens a "set up for the double" window
  minDraft: 3, // need at least this many beneficial targets to rebuild into
};
