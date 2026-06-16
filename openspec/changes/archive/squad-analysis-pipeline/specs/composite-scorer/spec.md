## ADDED Requirements

### Requirement: CompositeScore type
The system SHALL define a `CompositeScore` interface with fields: `total` (number, 0-1), `breakdown` (object mapping each weight category to its contribution), `trendAdjustment` (number), `llmAdjustment` (number), `trendClassification` (string or null), `position` (Position).

### Requirement: Normalize signal to 0-1
The system SHALL provide a `normalizeSignal(value: number, min: number, max: number): number` function that maps raw values to 0-1 using `(value - min) / (max - min)`, clamped to [0, 1].

#### Scenario: Value within bounds
- **WHEN** value is 0.4, min is 0, max is 0.8
- **THEN** the normalized value is `0.5`

#### Scenario: Value at lower bound
- **WHEN** value is 0, min is 0, max is 0.8
- **THEN** the normalized value is `0.0`

#### Scenario: Value exceeds upper bound
- **WHEN** value is 1.2, min is 0, max is 0.8
- **THEN** the normalized value is `1.0` (clamped)

#### Scenario: Value below lower bound
- **WHEN** value is -0.5, min is 0, max is 0.8
- **THEN** the normalized value is `0.0` (clamped)

### Requirement: Normalize inverted signal
The system SHALL provide a `normalizeInverted(value: number, min: number, max: number): number` function that maps raw values to 0-1 where LOWER input produces HIGHER output, using `1 - ((value - min) / (max - min))`, clamped to [0, 1]. Used for xgcRate (lower xGC = better CS chance) and suspensionRisk (lower risk = better).

#### Scenario: Low xGC rate
- **WHEN** xgcRate is 0.8, min is 0.5, max is 2.0
- **THEN** normalized value is `1 - ((0.8 - 0.5) / 1.5) = 0.80` (good — low goals conceded)

#### Scenario: High xGC rate
- **WHEN** xgcRate is 1.8, min is 0.5, max is 2.0
- **THEN** normalized value is `1 - ((1.8 - 0.5) / 1.5) = 0.133` (bad — high goals conceded)

### Requirement: Compute composite score
The system SHALL provide a `computeCompositeScore(stats: StatisticalSignals, trend: TrendSignals | null, fixture: FixtureSignals, market: MarketSignals, llm: LlmContextSignals, position: Position): CompositeScore` function that:

1. Normalizes all statistical signals using bounds from `NORMALIZATION_BOUNDS` (standard or inverted as specified)
2. Maps normalized signals to position-specific weight categories
3. Applies position-specific weights from `SCORING_WEIGHTS` to produce a base score
4. Adds regression additive from trend signals
5. Adds LLM adjustment
6. Subtracts suspension risk penalty: `suspensionRisk * 0.05` (small but non-zero penalty for card-prone players)
7. Clamps final score to [0, 1]

### Requirement: Signal-to-weight mapping per position

#### Scenario: FWD signal mapping
- **WHEN** scoring a FWD
- **THEN** weight categories map to signals as:
  - `goalThreat` ← normalized `stats.goalThreat`
  - `assistPotential` ← normalized `stats.assistPotential`
  - `form` ← normalized `stats.formSignal`
  - `bonus` ← normalized `stats.bonusEfficiency`
  - `fixture` ← `fixture.fdrScore`
  - `minutes` ← `stats.minutesReliability` (already 0-1)
  - `value` ← normalized `stats.valueScore`

#### Scenario: MID signal mapping
- **WHEN** scoring a MID
- **THEN** weight categories map to signals as:
  - `goalThreat` ← normalized `stats.goalThreat`
  - `assistPotential` ← normalized `stats.assistPotential`
  - `form` ← normalized `stats.formSignal`
  - `cleanSheet` ← normalized `stats.cleanSheetRate`
  - `bonus` ← normalized `stats.bonusEfficiency`
  - `fixture` ← `fixture.fdrScore`
  - `minutes` ← `stats.minutesReliability`
  - `value` ← normalized `stats.valueScore`

#### Scenario: DEF signal mapping
- **WHEN** scoring a DEF
- **THEN** weight categories map to signals as:
  - `cleanSheet` ← normalized `stats.cleanSheetRate`
  - `xgcRate` ← inverted-normalized `stats.xgcRate` (lower xGC = higher score)
  - `defensive` ← normalized `stats.defensiveScore`
  - `goalAssistSetPiece` ← average of normalized `stats.goalThreat`, normalized `stats.assistPotential`, normalized `stats.setPieceValue`
  - `form` ← normalized `stats.formSignal`
  - `bonus` ← normalized `stats.bonusEfficiency`
  - `fixture` ← `fixture.fdrScore`
  - `minutes` ← `stats.minutesReliability`
  - `value` ← normalized `stats.valueScore`

#### Scenario: GK signal mapping
- **WHEN** scoring a GK
- **THEN** weight categories map to signals as:
  - `cleanSheet` ← normalized `stats.cleanSheetRate`
  - `xgcRate` ← inverted-normalized `stats.xgcRate`
  - `saves` ← normalized `stats.savesRate`
  - `form` ← normalized `stats.formSignal`
  - `bonus` ← normalized `stats.bonusEfficiency`
  - `fixture` ← `fixture.fdrScore`
  - `minutes` ← `stats.minutesReliability`
  - `value` ← normalized `stats.valueScore`
  - `suspensionPenalty` ← inverted-normalized `stats.suspensionRisk`

### Requirement: LLM adjustment formula
The system SHALL compute the LLM adjustment as: `-rotationRisk * 0.15 + oopBonus + tacticalBoost + opponentKeyAbsence * posMultiplier - injurySeverity * 0.20`, where `posMultiplier` is 1.0 for FWD/MID, 1.5 for DEF, 2.0 for GK (reflecting how much opponent absence affects clean sheet probability).

#### Scenario: DEF with opponent absence
- **WHEN** a DEF player has rotationRisk 0.1, opponentKeyAbsence 0.04, injurySeverity 0
- **THEN** llmAdjustment is `-0.1*0.15 + 0 + 0 + 0.04*1.5 - 0 = -0.015 + 0.06 = 0.045`

#### Scenario: FWD with injury concern
- **WHEN** a FWD player has rotationRisk 0, injurySeverity 0.6, all else 0
- **THEN** llmAdjustment is `0 + 0 + 0 + 0 - 0.6*0.20 = -0.12`

### Requirement: Suspension risk penalty
The system SHALL subtract `suspensionRisk * 0.05` from the composite score for all positions. This is separate from the LLM adjustment and applies directly as a penalty.

#### Scenario: Player on 4 yellows before GW 19
- **WHEN** a player has suspensionRisk 0.8
- **THEN** the composite score is reduced by `0.8 * 0.05 = 0.04`

#### Scenario: Clean disciplinary record
- **WHEN** a player has suspensionRisk 0.1
- **THEN** the penalty is `0.1 * 0.05 = 0.005` (negligible)

### Requirement: Full composite score example

#### Scenario: FWD composite score with all signals
- **WHEN** a FWD has normalized signals: goalThreat 0.6, assistPotential 0.4, form 0.7, bonus 0.5, fixture 0.75, minutes 0.9, value 0.5
- **AND** trend classification BUY (additive +0.03), no LLM adjustments, suspensionRisk 0.1
- **THEN** baseScore is `0.6*0.35 + 0.4*0.18 + 0.7*0.10 + 0.5*0.08 + 0.75*0.14 + 0.9*0.05 + 0.5*0.10 = 0.21 + 0.072 + 0.07 + 0.04 + 0.105 + 0.045 + 0.05 = 0.592`
- **AND** total is `0.592 + 0.03 - (0.1*0.05) = 0.617`

#### Scenario: DEF composite score with xGC and defensive contribution
- **WHEN** a DEF has normalized signals: cleanSheet 0.5, xgcRate 0.7 (inverted — low xGC), defensive 0.6, goalAssistSetPiece 0.3, form 0.5, bonus 0.6, fixture 0.8, minutes 0.95, value 0.4
- **AND** no trend data, LLM opponentKeyAbsence 0.03 (×1.5 = 0.045), suspensionRisk 0.2
- **THEN** baseScore is `0.5*0.25 + 0.7*0.10 + 0.6*0.08 + 0.3*0.12 + 0.5*0.08 + 0.6*0.10 + 0.8*0.10 + 0.95*0.07 + 0.4*0.10 = 0.125 + 0.07 + 0.048 + 0.036 + 0.04 + 0.06 + 0.08 + 0.0665 + 0.04 = 0.5655`
- **AND** total is `0.5655 + 0 + 0.045 - (0.2*0.05) = 0.6005`

### Requirement: Score clamping

#### Scenario: Score exceeds 1.0
- **WHEN** the combined total exceeds 1.0
- **THEN** the final score is clamped to `1.0`

#### Scenario: Score below 0.0
- **WHEN** heavy penalties drive the total below 0.0
- **THEN** the final score is clamped to `0.0`

### Requirement: Insufficient data fallback
The system SHALL return a fallback score when a player has fewer than `PIPELINE_CONFIG.minMinutes` (270) total minutes.

#### Scenario: New signing with 100 minutes
- **WHEN** a player has 100 total minutes
- **THEN** `total` is `PIPELINE_CONFIG.insufficientDataFallbackScore` (0.3)
- **AND** `trendAdjustment` is `0`
- **AND** `trendClassification` is `null`

### Requirement: Breakdown includes all contributions
The `breakdown` object SHALL include named entries for each weight category's contribution (e.g., `goalThreat: 0.21` for a FWD with normalized goalThreat 0.6 × weight 0.35), enabling downstream nodes to explain which signals drove the score.

#### Scenario: Score breakdown transparency
- **WHEN** a composite score is computed
- **THEN** the `breakdown` object contains entries for every weight category used by that position
- **AND** the sum of breakdown values equals the base score (before trend, LLM, and suspension adjustments)
