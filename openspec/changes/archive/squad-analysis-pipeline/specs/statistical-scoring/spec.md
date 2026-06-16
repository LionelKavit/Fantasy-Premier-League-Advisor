## ADDED Requirements

### Requirement: StatisticalSignals type
The system SHALL define a `StatisticalSignals` interface with fields: `goalThreat` (number), `assistPotential` (number), `formSignal` (number), `bonusEfficiency` (number), `setPieceValue` (number), `valueScore` (number), `cleanSheetRate` (number), `xgcRate` (number), `defensiveScore` (number), `savesRate` (number), `minutesReliability` (number), `suspensionRisk` (number).

### Requirement: Compute statistical signals
The system SHALL provide a `computeStatisticalSignals(player: Player, currentGw: number, elementSummary?: ElementSummary): StatisticalSignals` function that computes raw (un-normalized) signal values from a player's season stats.

#### Scenario: Goal threat computation
- **WHEN** a FWD player has `expectedGoalsPer90: 0.45`
- **THEN** `goalThreat` is `0.45`

#### Scenario: Assist potential computation
- **WHEN** a MID player has `expectedAssistsPer90: 0.30`
- **THEN** `assistPotential` is `0.30`

#### Scenario: Form signal computation
- **WHEN** a player has `form: 6.5` (FPL's 4-GW rolling points per game)
- **THEN** `formSignal` is `6.5`

#### Scenario: Bonus efficiency computation
- **WHEN** a player has `bps: 600`, `bonus: 12`, `influence: 800`, and `minutes: 2700`
- **THEN** `bonusEfficiency` is a weighted combination of BPS per 90 (`600 / 2700 * 90 = 20.0`), actual bonus per 90 (`12 / 2700 * 90 = 0.4`), and influence per 90 (`800 / 2700 * 90 = 26.7`)

#### Scenario: Bonus efficiency formula
- **WHEN** computing bonusEfficiency
- **THEN** the formula is `(bpsPer90 * 0.5) + (bonusPer90 * 10 * 0.3) + (influencePer90 * 0.2)` — weighting raw BPS heaviest as the predictor, actual bonus as validation, and influence as the involvement driver

#### Scenario: Set piece value — primary penalty taker
- **WHEN** a player has `penalties.order: 1`, `corners.order: null`, `directFreekicks.order: null`
- **THEN** `setPieceValue` is `0.15`

#### Scenario: Set piece value — multiple duties
- **WHEN** a player has `penalties.order: 1`, `corners.order: 1`, `directFreekicks.order: 1`
- **THEN** `setPieceValue` is `0.15 + 0.08 + 0.05 = 0.28`

#### Scenario: Set piece value — non-primary taker
- **WHEN** a player has `penalties.order: 2`
- **THEN** the penalty contribution to `setPieceValue` is `0` (only order 1 counts)

#### Scenario: Value score computation
- **WHEN** a player has `pointsPerGame: 5.2` and `price: 8.0`
- **THEN** `valueScore` is `5.2 / 8.0 = 0.65`

#### Scenario: Clean sheet rate for DEF
- **WHEN** a DEF player has `cleanSheets: 10` and `minutes: 2700`
- **THEN** `cleanSheetRate` is `10 / (2700 / 90) = 0.333`

#### Scenario: Clean sheet rate for FWD
- **WHEN** a FWD player has any clean sheet stats
- **THEN** `cleanSheetRate` is `0` (not applicable to position)

#### Scenario: xGC rate for DEF/GK
- **WHEN** a DEF player has `expectedGoalsConcededPer90: 1.2` and `goalsConcededPer90: 1.0`
- **THEN** `xgcRate` is a weighted combination: `expectedGoalsConcededPer90 * 0.6 + goalsConcededPer90 * 0.4 = 0.72 + 0.40 = 1.12` — lower is better for clean sheet probability

#### Scenario: xGC rate for FWD/MID
- **WHEN** a FWD or MID player
- **THEN** `xgcRate` is `0` (not used in their scoring)

#### Scenario: Defensive score for DEF
- **WHEN** a DEF player has `defensiveContributionPer90: 8.5`
- **THEN** `defensiveScore` is `8.5`

#### Scenario: Defensive score for GK
- **WHEN** a GK player has `defensiveContributionPer90: 0`
- **THEN** `defensiveScore` is `0` (GKs scored on saves and CS, not defensive contribution)

#### Scenario: Defensive score for FWD/MID
- **WHEN** a FWD or MID player
- **THEN** `defensiveScore` is `0`

#### Scenario: Saves rate for GK
- **WHEN** a GK player has `savesPer90: 3.5`
- **THEN** `savesRate` is `3.5`

#### Scenario: Saves rate for non-GK
- **WHEN** a DEF player
- **THEN** `savesRate` is `0`

#### Scenario: Minutes reliability with availability
- **WHEN** a player has `starts: 25`, current gameweek is 30, and `chanceOfPlayingNext: 75`
- **THEN** `minutesReliability` is `(starts / currentGw) * (chanceOfPlayingNext / 100) = (25/30) * 0.75 = 0.625`

#### Scenario: Minutes reliability — full availability
- **WHEN** a player has `starts: 25`, current gameweek is 30, and `chanceOfPlayingNext: null` (null means fully available)
- **THEN** `minutesReliability` is `25 / 30 = 0.833` (null treated as 100%)

#### Scenario: Minutes reliability — flagged doubtful
- **WHEN** a player has `starts: 28`, current gameweek is 30, and `chanceOfPlayingNext: 25`
- **THEN** `minutesReliability` is `(28/30) * 0.25 = 0.233` — heavily penalized despite good start history

#### Scenario: Suspension risk — approaching threshold
- **WHEN** a player has `yellowCards: 4` and fewer than 19 GWs played (5 yellows before GW 19 = 1-match ban)
- **THEN** `suspensionRisk` is `0.8` (high risk — one yellow away from ban)

#### Scenario: Suspension risk — safe
- **WHEN** a player has `yellowCards: 1` and 15 GWs played
- **THEN** `suspensionRisk` is approximately `0.1` (low risk)

#### Scenario: Suspension risk — red card history
- **WHEN** a player has `redCards: 1`
- **THEN** `suspensionRisk` is increased by `0.2` (indicates disciplinary tendency)

#### Scenario: Suspension risk formula
- **WHEN** computing suspensionRisk
- **THEN** the formula considers: proximity to yellow card threshold (4→5 before GW19, 9→10 before GW32), yellow card rate per game (`yellowCards / gamesPlayed`), and red card history. Clamped to [0, 1].

#### Scenario: Zero minutes player
- **WHEN** a player has `minutes: 0`
- **THEN** all per-90 signals are `0`, `minutesReliability` is `0`, and `suspensionRisk` is `0`
