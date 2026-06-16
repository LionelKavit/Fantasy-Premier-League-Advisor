## ADDED Requirements

### Requirement: Find restructure options
The system SHALL provide a `findRestructureOptions(analysis: SquadAnalysisResult, allPlayers: Player[], fixtures: Fixture[], teams: Team[], freeTransfers: number): RestructureOption[]` function that identifies sell-to-fund chains for premium transfer targets that exceed the manager's current budget.

#### Scenario: Identify dream targets
- **WHEN** a TransferCandidate in the weakest3 targets has `restructureNeeded: true`
- **THEN** it is considered a dream target for restructure analysis

#### Scenario: Find funding source
- **WHEN** evaluating restructure options for a dream target
- **THEN** for each non-weakest squad member (ranked 4th–12th in the rankedSquad), compute: `fundsFreed = downgradedPlayer.price - cheapestReplacementAtPosition.price`
- **AND** if `weak.price + bank + fundsFreed >= dreamTarget.price`, the downgrade is a viable funding source

#### Scenario: Net score change — positive
- **WHEN** dream target scores 0.75, weak player scores 0.35, downgraded player scores 0.55, and cheap replacement scores 0.40
- **THEN** netScoreChange is (0.75 - 0.35) + (0.40 - 0.55) = 0.40 - 0.15 = 0.25
- **AND** the option is included (positive net change)

#### Scenario: Net score change — negative
- **WHEN** the score lost from downgrading exceeds the score gained from the dream target
- **THEN** netScoreChange is negative
- **AND** the option is excluded

#### Scenario: Cheapest replacement floor
- **WHEN** searching for a replacement for the downgraded player
- **THEN** the replacement must have composite score ≥ 0.3 (PIPELINE_CONFIG.insufficientDataFallbackScore)
- **AND** availability status must not be "injured", "suspended", or "unavailable"
- **AND** the replacement must be the same position as the downgraded player

#### Scenario: Club rule for replacement
- **WHEN** the cheapest replacement is from a team that already has 3 players in the squad
- **THEN** that replacement is skipped in favor of the next cheapest qualifying player

#### Scenario: Top 3 selection
- **WHEN** multiple viable restructure options exist
- **THEN** sort by netScoreChange descending and return the top 3

#### Scenario: No viable restructure
- **WHEN** no downgrade frees enough funds for any dream target, or all netScoreChanges are ≤ 0
- **THEN** return an empty array

#### Scenario: Total cost — 1 free transfer
- **WHEN** a restructure requires 2 transfers AND freeTransfers is 1
- **THEN** totalCost is 4 (first transfer is free, second costs −4)

#### Scenario: Total cost — 2 free transfers
- **WHEN** a restructure requires 2 transfers AND freeTransfers is 2
- **THEN** totalCost is 0 (both transfers are free)
