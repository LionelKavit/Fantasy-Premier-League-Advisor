## ADDED Requirements

### Requirement: Compute captain score
The system SHALL provide a `computeCaptainScore(player: ScoredPlayer, fixtures: Fixture[], teams: Team[], gameweek: number): CaptainScore` function that produces a single-gameweek captaincy score, distinct from the transfer composite score.

The score SHALL be ceiling-weighted (favoring upside/explosiveness) rather than floor-weighted (favoring consistency), and SHALL exclude price/value entirely.

#### Scenario: Ceiling over floor
- **WHEN** player A is a forward with high goal threat and penalty duty, and player B is a defender with a high clean-sheet rate and equal transfer composite score
- **THEN** player A's captainScore.total is higher than player B's (captaincy rewards ceiling, not floor)

#### Scenario: Base projection anchor
- **WHEN** computing baseProjection
- **THEN** it anchors on the player's expected points for the gameweek (e.g. `player.epThis` / `player.epNext` as appropriate) blended with the model's goal/assist threat

#### Scenario: Ceiling boost components
- **WHEN** a player is the team's penalty taker AND has high goal threat
- **THEN** ceilingBoost reflects both (penalty duty materially raises captaincy ceiling)

### Requirement: Minutes certainty gate
Minutes certainty SHALL act as a multiplier in [0,1] on the captain score, not an additive term.

#### Scenario: Doubtful starter penalized hard
- **WHEN** a player's `chanceOfPlayingNext` is 50 or rotationRisk is high
- **THEN** minutesCertainty is well below 1.0 AND the final captainScore.total is reduced proportionally, ranking the player below a nailed-on alternative of similar raw output

#### Scenario: Nailed-on starter
- **WHEN** a player has started every recent gameweek and `chanceOfPlayingNext` is null or 100
- **THEN** minutesCertainty is at or near 1.0

#### Scenario: Flagged unavailable
- **WHEN** a player's availability status is "injured", "suspended", or "unavailable"
- **THEN** minutesCertainty is 0 (the player is not a viable captain)

### Requirement: Fixture multiplier
The captain score SHALL adjust for the specific gameweek's fixture difficulty and venue.

#### Scenario: Easy home fixture
- **WHEN** the player's team plays at home against an FDR 2 opponent in the target gameweek
- **THEN** fixtureMultiplier is above 1.0

#### Scenario: Hard away fixture
- **WHEN** the player's team plays away against an FDR 5 opponent
- **THEN** fixtureMultiplier is below 1.0

### Requirement: Double gameweek multiplier
The captain score SHALL apply a DGW multiplier when the player's team has two fixtures in the target gameweek.

#### Scenario: Genuine DGW
- **WHEN** the player's team has two fixtures in the gameweek
- **THEN** dgwMultiplier is greater than 1 (approaching 2, discounted by the weaker of the two fixtures) AND isDgw is true

#### Scenario: DGW outranks stronger single fixture
- **WHEN** a moderate player has two fixtures and a stronger player has one fixture of similar per-match quality
- **THEN** the DGW player's captainScore.total is higher (two doubled returns beat one)

#### Scenario: Blank gameweek
- **WHEN** the player's team has no fixture in the target gameweek
- **THEN** captainScore.total is 0 (cannot captain a player who does not play)

### Requirement: Batch scoring
The system SHALL provide a `batchComputeCaptainScores(squad: ScoredPlayer[], picks: Pick[], fixtures: Fixture[], teams: Team[], gameweek: number): CaptainCandidate[]` function that scores only the starting XI (picks positions 1–11) and returns candidates with effective ownership and reasons populated.

#### Scenario: Starting XI only
- **WHEN** the squad has 15 players with picks positions 1–15
- **THEN** only the 11 players at positions 1–11 are scored as captain candidates
