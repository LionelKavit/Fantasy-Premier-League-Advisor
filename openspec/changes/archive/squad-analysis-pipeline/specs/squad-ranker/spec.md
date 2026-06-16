## ADDED Requirements

### Requirement: ScoredPlayer type
The system SHALL define a `ScoredPlayer` interface with fields: `player` (Player), `score` (CompositeScore), `fixtureSignals` (FixtureSignals), `trendSignals` (TrendSignals | null), `marketSignals` (MarketSignals), `llmSignals` (LlmContextSignals).

### Requirement: WeakSpot type
The system SHALL define a `WeakSpot` interface with fields: `player` (ScoredPlayer), `whyWeak` (string[]), `targets` (TransferCandidate[]).

### Requirement: TransferCandidate type
The system SHALL define a `TransferCandidate` interface with fields: `candidate` (ScoredPlayer), `gw1Gain` (number — candidate GW1 projected score minus weak player GW1 score), `gw5Gain` (number — candidate 5GW avg score minus weak player 5GW avg score), `fitsBudget` (boolean), `restructureNeeded` (boolean).

### Requirement: SquadAnalysisResult type
The system SHALL define a `SquadAnalysisResult` interface with fields: `rankedSquad` (ScoredPlayer[] — 15 players sorted by score descending), `weakest3` (WeakSpot[]), `chipsRemaining` (ChipsRemaining), `bank` (number), `currentGw` (number), `generatedAt` (string — ISO timestamp).

### Requirement: Rank squad players
The system SHALL provide a `rankSquad(scoredPlayers: ScoredPlayer[]): ScoredPlayer[]` function that sorts the 15 squad players by composite score descending.

#### Scenario: Ranking order
- **WHEN** 15 players have composite scores [0.72, 0.65, 0.58, ..., 0.31]
- **THEN** the returned array is sorted from 0.72 to 0.31

### Requirement: Identify weakest 3 players
The system SHALL identify the 3 lowest-scoring players from the ranked squad as `WeakSpot` entries, each with a `whyWeak` string array explaining the low score.

#### Scenario: Weakness reasons from score breakdown
- **WHEN** a player's score breakdown shows fixture contribution of 0.02 (out of weight 0.15)
- **THEN** `whyWeak` includes "Poor fixture run (FDR avg X.X over next 5 GWs)"

#### Scenario: Weakness from trend analysis
- **WHEN** a player has trend classification "SELL"
- **THEN** `whyWeak` includes "Falling xG trend (SELL signal)"

#### Scenario: Weakness from rotation risk
- **WHEN** a player has LLM rotationRisk > 0.6
- **THEN** `whyWeak` includes "High rotation risk (X.X)"

#### Scenario: Weakness from injury
- **WHEN** a player has LLM injurySeverity > 0.5
- **THEN** `whyWeak` includes "Injury concern: [news text]"

#### Scenario: Weakness from value
- **WHEN** a player's value score is in the bottom quartile
- **THEN** `whyWeak` includes "Low value score (X.X pts/£m)"

#### Scenario: Weakness from suspension risk
- **WHEN** a player has suspensionRisk > 0.7
- **THEN** `whyWeak` includes "Suspension risk: X yellow cards (ban at Y)"

#### Scenario: Weakness from poor form
- **WHEN** a player has formSignal below 3.0
- **THEN** `whyWeak` includes "Poor recent form (X.X PPG over last 4 GWs)"

#### Scenario: Weakness from high xGC (DEF/GK)
- **WHEN** a DEF or GK player has xgcRate above 1.5
- **THEN** `whyWeak` includes "High expected goals conceded (X.XX per 90)"

#### Scenario: Weakness from low availability
- **WHEN** a player has minutesReliability below 0.5 (due to chanceOfPlayingNext being low)
- **THEN** `whyWeak` includes "Availability concern: X% chance of playing"

### Requirement: Find replacement candidates
The system SHALL provide a `findCandidates(weakPlayer: ScoredPlayer, allPlayers: Player[], budget: number, existingTeamIds: Map<number, number>, scoredCache: Map<number, CompositeScore>): TransferCandidate[]` function that returns the top `PIPELINE_CONFIG.candidatesPerWeakSpot` (5) replacement candidates.

#### Scenario: Position matching
- **WHEN** the weak player is a MID
- **THEN** all candidates are MID players

#### Scenario: Budget filtering
- **WHEN** a weak MID costs £6.0m and the manager has £1.5m in the bank
- **THEN** candidates are filtered to price ≤ £7.5m

#### Scenario: Squad exclusion
- **WHEN** a player is already in the manager's 15-player squad
- **THEN** that player is not included as a candidate

#### Scenario: Availability filtering
- **WHEN** a player has status "injured", "suspended", or "unavailable"
- **THEN** that player is not included as a candidate

#### Scenario: Club rule enforcement
- **WHEN** the manager already has 3 players from Arsenal
- **THEN** no Arsenal players appear as candidates

#### Scenario: Club rule with sell
- **WHEN** the weak player is from Arsenal and the manager has 3 Arsenal players
- **THEN** Arsenal players CAN appear as candidates (selling the weak player frees a slot)

#### Scenario: GW1 gain computation
- **WHEN** a candidate has GW1 projected score 0.75 and the weak player has 0.40
- **THEN** `gw1Gain` is `0.35`

#### Scenario: Budget-exceeding candidate flagged
- **WHEN** a strong candidate costs more than weak player price + bank
- **THEN** `fitsBudget` is `false` and `restructureNeeded` is `true`
- **AND** the candidate is still included but flagged

#### Scenario: Top 5 selection
- **WHEN** 20 valid candidates exist
- **THEN** only the top 5 by composite score are returned

### Requirement: Limit fetchElementSummary calls
The system SHALL fetch `ElementSummary` for the 15 squad players plus a pre-filtered pool of at most `PIPELINE_CONFIG.candidatePoolPerPosition` (10) players per position from bootstrap (by `pointsPerGame`), minus already-scored players. This caps total API calls at approximately 45.

#### Scenario: Candidate pool pre-filtering
- **WHEN** preparing the candidate pool
- **THEN** the system selects the top 10 players per position (GK, DEF, MID, FWD) by `pointsPerGame` from the bootstrap, excluding players already in the squad
- **AND** fetches `ElementSummary` for all of them in parallel

#### Scenario: Cached element summaries
- **WHEN** `ElementSummary` was fetched for a player within the last hour
- **THEN** the cached version is used without an API call

### Requirement: Pipeline orchestrator
The system SHALL provide a `runSquadAnalysisPipeline(teamId: number): Promise<SquadAnalysisResult>` function that orchestrates the full pipeline:

1. Fetch bootstrap + fixtures + manager profile in parallel
2. Fetch picks for current GW to get the 15-player squad
3. Fetch `ElementSummary` for squad players + candidate pool in parallel
4. Fetch set piece notes
5. Compute statistical + fixture + market signals for all players (parallel per player)
6. Compute trend signals for players with element summaries
7. Compute LLM context signals in batched API call(s)
8. Compute composite scores for all players
9. Rank squad, identify weakest 3, find candidates
10. Return `SquadAnalysisResult`

#### Scenario: End-to-end pipeline
- **WHEN** `runSquadAnalysisPipeline` is called with a valid team ID
- **THEN** it returns a `SquadAnalysisResult` with 15 ranked players, 3 weak spots with candidates, chips remaining, bank, and current GW

#### Scenario: Pipeline timing
- **WHEN** the pipeline runs for the first time (no cache)
- **THEN** it completes within 6 seconds

#### Scenario: Pipeline with cached data
- **WHEN** the pipeline runs within 1 hour of a previous run for the same team
- **THEN** it completes within 1 second (all data cached, only composite scoring recomputed)
