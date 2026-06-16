## ADDED Requirements

### Requirement: Validate a single transfer
The system SHALL provide a `validateTransfer(weak: ScoredPlayer, candidate: ScoredPlayer, bank: number, squadTeamCounts: Map<number, number>): ValidTransfer | null` function that checks whether a transfer is valid and computes its metrics.

The number of free transfers (1 or 2) is accepted as input via the API parameter — not derived from history.

#### Scenario: Budget pass
- **WHEN** candidate.price is 8.0, weak.price is 6.5, and bank is 2.0
- **THEN** fitsBudget is true and priceDelta is 1.5

#### Scenario: Budget fail
- **WHEN** candidate.price is 10.0, weak.price is 6.0, and bank is 1.0
- **THEN** return null (filtered out; restructure analyzer handles these separately)

#### Scenario: Club rule — within limit
- **WHEN** the squad has 2 players from the candidate's team
- **THEN** the transfer is valid

#### Scenario: Club rule — at limit, different team
- **WHEN** the squad has 3 players from the candidate's team AND the weak player is NOT from that team
- **THEN** return null (would exceed 3-per-team rule)

#### Scenario: Club rule — at limit, same team (sell frees slot)
- **WHEN** the squad has 3 players from the candidate's team AND the weak player IS from that team
- **THEN** the transfer is valid (selling the weak player frees a slot)

#### Scenario: Unavailable candidate
- **WHEN** candidate.player.availability.status is "injured", "suspended", or "unavailable"
- **THEN** return null

#### Scenario: Score diff percentage
- **WHEN** candidate.score.total is 0.65 and weak.score.total is 0.40
- **THEN** scoreDiffPct is ((0.65 - 0.40) / 0.40) × 100 = 62.5

### Requirement: Build all valid transfers
The system SHALL provide a `buildValidTransfers(analysis: SquadAnalysisResult, bank: number, squadTeamCounts: Map<number, number>): ValidTransfer[]` function that iterates all weakest3 × their targets, calls validateTransfer for each, and returns a flat array of valid transfers.

#### Scenario: Full iteration
- **WHEN** there are 3 weak spots with 5 candidates each
- **THEN** up to 15 transfer pairs are evaluated, and only valid ones are returned

#### Scenario: No valid transfers
- **WHEN** all candidates are too expensive, violate club rule, or are unavailable
- **THEN** return an empty array
