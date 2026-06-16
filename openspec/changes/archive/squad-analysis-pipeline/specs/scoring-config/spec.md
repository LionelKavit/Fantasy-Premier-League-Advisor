## ADDED Requirements

### Requirement: Position-specific scoring weights
The system SHALL export a `SCORING_WEIGHTS` constant with position keys (`GK`, `DEF`, `MID`, `FWD`), each containing named weight values that sum to 1.0 for the base formula (excluding LLM and regression additives).

#### Scenario: FWD weights
- **WHEN** the system scores a FWD player
- **THEN** it applies weights: `goalThreat: 0.35`, `assistPotential: 0.18`, `form: 0.10`, `bonus: 0.08`, `fixture: 0.14`, `minutes: 0.05`, `value: 0.10`

#### Scenario: MID weights
- **WHEN** the system scores a MID player
- **THEN** it applies weights: `goalThreat: 0.28`, `assistPotential: 0.15`, `form: 0.10`, `cleanSheet: 0.08`, `bonus: 0.08`, `fixture: 0.14`, `minutes: 0.07`, `value: 0.10`

#### Scenario: DEF weights
- **WHEN** the system scores a DEF player
- **THEN** it applies weights: `cleanSheet: 0.25`, `xgcRate: 0.10`, `defensive: 0.08`, `goalAssistSetPiece: 0.12`, `form: 0.08`, `bonus: 0.10`, `fixture: 0.10`, `minutes: 0.07`, `value: 0.10`, and the LLM `opponentKeyAbsence` signal is multiplied by 1.5

#### Scenario: GK weights
- **WHEN** the system scores a GK player
- **THEN** it applies weights: `cleanSheet: 0.30`, `xgcRate: 0.10`, `saves: 0.18`, `form: 0.08`, `bonus: 0.08`, `fixture: 0.10`, `minutes: 0.03`, `value: 0.10`, `suspensionPenalty: 0.03`, and the LLM `opponentKeyAbsence` signal is multiplied by 2.0

#### Scenario: Weight sum validation
- **WHEN** the weights for any position are summed
- **THEN** the total equals 1.0

### Requirement: Normalization bounds
The system SHALL export a `NORMALIZATION_BOUNDS` constant containing per-signal min/max values used for 0-1 normalization. Each bound defines the expected range for a signal; values outside the range are clamped to 0.0 or 1.0.

#### Scenario: Goal threat bounds
- **WHEN** normalizing `goalThreat` (expectedGoalsPer90)
- **THEN** bounds are `min: 0, max: 0.8`

#### Scenario: Assist potential bounds
- **WHEN** normalizing `assistPotential` (expectedAssistsPer90)
- **THEN** bounds are `min: 0, max: 0.5`

#### Scenario: Form bounds
- **WHEN** normalizing `formSignal` (FPL 4-GW rolling PPG)
- **THEN** bounds are `min: 0, max: 12`

#### Scenario: Bonus efficiency bounds
- **WHEN** normalizing `bonusEfficiency` (composite of BPS/90, bonus/90, influence/90)
- **THEN** bounds are `min: 0, max: 35`

#### Scenario: Set piece value bounds
- **WHEN** normalizing `setPieceValue`
- **THEN** bounds are `min: 0, max: 0.28` (maximum is all 3 duties at order 1)

#### Scenario: Value score bounds
- **WHEN** normalizing `valueScore` (PPG / price)
- **THEN** bounds are `min: 0, max: 1.5`

#### Scenario: Clean sheet rate bounds
- **WHEN** normalizing `cleanSheetRate`
- **THEN** bounds are `min: 0, max: 0.6`

#### Scenario: xGC rate bounds (inverted — lower is better)
- **WHEN** normalizing `xgcRate`
- **THEN** bounds are `min: 0.5, max: 2.0` and the normalization is INVERTED: `1 - ((value - min) / (max - min))` so lower xGC produces higher normalized score

#### Scenario: Defensive score bounds
- **WHEN** normalizing `defensiveScore` (defensiveContributionPer90)
- **THEN** bounds are `min: 0, max: 15`

#### Scenario: Saves rate bounds
- **WHEN** normalizing `savesRate`
- **THEN** bounds are `min: 0, max: 5`

#### Scenario: Minutes reliability bounds
- **WHEN** normalizing `minutesReliability`
- **THEN** bounds are `min: 0, max: 1.0` (already in 0-1 range from computation)

#### Scenario: Suspension risk bounds (inverted — lower is better)
- **WHEN** normalizing `suspensionRisk`
- **THEN** bounds are `min: 0, max: 1.0` and the normalization is INVERTED: `1 - value` so lower risk produces higher normalized score

#### Scenario: Clamping above max
- **WHEN** a raw signal value of 0.95 is normalized with bounds min 0 max 0.8
- **THEN** the normalized value is 1.0

#### Scenario: Clamping below min
- **WHEN** a raw signal value of -0.1 is normalized with bounds min 0 max 0.8
- **THEN** the normalized value is 0.0

### Requirement: Suspension thresholds
The system SHALL export a `SUSPENSION_THRESHOLDS` constant defining yellow card ban thresholds: `{ yellowBeforeGw19: 5, yellowBeforeGw32: 10, redCardPenalty: 0.2 }`. A player within 1 yellow of a threshold receives high suspension risk.

#### Scenario: Approaching first threshold
- **WHEN** a player has 4 yellow cards and fewer than 19 GWs played
- **THEN** `suspensionRisk` is high (≥0.8) because one more yellow triggers a 1-match ban

### Requirement: Trend thresholds
The system SHALL export a `TREND_THRESHOLDS` constant containing: `rollingWindow` (5), `minGws` (3), `slopeRising` (0.02), `slopeFalling` (-0.02), `gapWideningThreshold` (0.15), `finisherMinSeasons` (3).

#### Scenario: Minimum gameweeks for trend analysis
- **WHEN** a player has fewer than 3 gameweeks with >0 minutes
- **THEN** trend analysis returns null classification and 0 additive

### Requirement: Regression additives
The system SHALL export a `REGRESSION_ADDITIVES` constant: `BUY: 0.03`, `HIDDEN_GEM_BUY: 0.05`, `SELL_RISK: -0.05`, `SELL: -0.06`, `FINISHER_PREMIUM: 0.02`.

#### Scenario: Additive application
- **WHEN** a player is classified as SELL with finisher premium
- **THEN** the total regression additive is `-0.06 + 0.02 = -0.04`

### Requirement: LLM signal ranges
The system SHALL export a `LLM_SIGNAL_RANGES` constant defining valid ranges: `rotationRisk: [0, 1]`, `oopBonus: [0, 0.10]`, `injurySeverity: [0, 1]`, `tacticalBoost: [-0.05, 0.10]`, `opponentKeyAbsence: [0, 0.05]`.

#### Scenario: LLM signal clamping
- **WHEN** the LLM returns a rotationRisk of 1.5
- **THEN** the system clamps it to 1.0

### Requirement: Pipeline tuning constants
The system SHALL export a `PIPELINE_CONFIG` constant: `minMinutes: 270`, `candidatePoolPerPosition: 10`, `candidatesPerWeakSpot: 5`, `fdrRunLength: 5`, `insufficientDataFallbackScore: 0.3`.

#### Scenario: Insufficient data fallback
- **WHEN** a player has fewer than 270 total minutes
- **THEN** the composite scorer assigns a fallback score of 0.3
