## ADDED Requirements

### Requirement: TrendSignals type
The system SHALL define a `TrendSignals` interface with fields: `rollingXg` (number), `rollingGoals` (number), `xgTrend` (number — slope), `gap` (number), `finisherPremium` (boolean), `classification` (`"BUY" | "HIDDEN_GEM_BUY" | "SELL_RISK" | "SELL" | "HOLD" | null`), `additive` (number).

### Requirement: Compute trend signals from per-GW history
The system SHALL provide a `computeTrendSignals(history: PlayerGameweekHistory[], historyPast: PlayerPastSeason[]): TrendSignals` function that uses the last `TREND_THRESHOLDS.rollingWindow` (5) gameweeks with >0 minutes to compute rolling averages, trends, and a regression classification.

#### Scenario: Rolling xG computation
- **WHEN** a player's last 5 GWs with minutes have xG values [0.4, 0.5, 0.3, 0.6, 0.5] and minutes [90, 90, 70, 90, 90]
- **THEN** `rollingXg` is the average of per-90 xG values across those 5 GWs

#### Scenario: Rolling goals computation
- **WHEN** a player scored [1, 0, 1, 0, 2] goals in those 5 GWs with [90, 90, 70, 90, 90] minutes
- **THEN** `rollingGoals` is the average of goals-per-90 across those 5 GWs

#### Scenario: xG trend slope
- **WHEN** a player's per-90 xG over 5 GWs is [0.3, 0.35, 0.4, 0.45, 0.5]
- **THEN** `xgTrend` is a positive value (linear slope), classified as "rising"

#### Scenario: Gap computation
- **WHEN** `rollingGoals` is 0.6 and `rollingXg` is 0.4
- **THEN** `gap` is `0.2` (overperforming xG)

#### Scenario: Finisher premium detection
- **WHEN** a player overperformed xG (goals_scored > expected_goals) in 3 or more past seasons from `historyPast`
- **THEN** `finisherPremium` is `true`

#### Scenario: Finisher premium — insufficient history
- **WHEN** a player has fewer than 3 past seasons
- **THEN** `finisherPremium` is `false`

### Requirement: Regression classification
The system SHALL classify each player's trend into a signal with a corresponding additive adjustment:

#### Scenario: BUY — real improvement
- **WHEN** xG trend is rising (slope > 0.02) AND goals > xG AND gap is stable (not widening beyond 0.15)
- **THEN** classification is `"BUY"` and additive is `+0.03`

#### Scenario: HOLD — real but inflated
- **WHEN** xG trend is rising AND goals > xG AND gap is widening (> 0.15)
- **THEN** classification is `"HOLD"` and additive is `0`

#### Scenario: SELL_RISK — lucky finishing
- **WHEN** xG trend is flat (slope between -0.02 and 0.02) AND goals > xG AND gap is widening
- **THEN** classification is `"SELL_RISK"` and additive is `-0.05`

#### Scenario: HIDDEN_GEM_BUY — rising xG, suppressed output
- **WHEN** xG trend is rising AND goals <= xG
- **THEN** classification is `"HIDDEN_GEM_BUY"` and additive is `+0.05`

#### Scenario: SELL — declining quality
- **WHEN** xG trend is falling (slope < -0.02)
- **THEN** classification is `"SELL"` and additive is `-0.06`

#### Scenario: Finisher premium bonus
- **WHEN** `finisherPremium` is true (regardless of other classification)
- **THEN** an additional `+0.02` is added to the additive

### Requirement: Handle insufficient data
The system SHALL skip trend analysis for players with fewer than `TREND_THRESHOLDS.minGws` (3) gameweeks with >0 minutes.

#### Scenario: New signing with 2 GWs
- **WHEN** a player has only 2 gameweeks with minutes played
- **THEN** `classification` is `null` and `additive` is `0`

### Requirement: Exclude zero-minute gameweeks
Gameweeks where the player had 0 minutes SHALL be excluded from the rolling window. The window extends further back in time to find qualifying GWs.

#### Scenario: Player benched in recent GWs
- **WHEN** a player has GWs [28: 90min, 29: 0min, 30: 0min, 31: 90min, 32: 90min, 33: 90min, 34: 90min]
- **THEN** the rolling window uses GWs [28, 31, 32, 33, 34] (the most recent 5 with minutes)
