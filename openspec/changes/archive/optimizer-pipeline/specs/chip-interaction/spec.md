## ADDED Requirements

### Requirement: Evaluate chip interactions
The system SHALL provide a `evaluateChipInteractions(analysis: SquadAnalysisResult, managerProfile: ManagerProfile, validTransfers: ValidTransfer[], gwFlags: GameweekFlags[], singleResult: SingleTransferResult, hitResult: HitTransferResult): ChipRecommendation[]` function that evaluates whether any chips should be activated and how they alter transfer recommendations.

### Requirement: Wildcard trigger
#### Scenario: Wildcard recommended
- **WHEN** chipsRemaining.wildcard > 0 AND 3 or more validTransfers have gw1Gain > 0.05
- **THEN** recommend wildcard for the current gameweek
- **AND** reason explains how many beneficial transfers are available
- **AND** alteredTransfers is a TransferAction with type "WILDCARD" containing ALL beneficial transfers (since all are free under wildcard)

#### Scenario: Wildcard not triggered
- **WHEN** fewer than 3 validTransfers have gw1Gain > 0.05
- **THEN** wildcard is not recommended

### Requirement: Free Hit trigger
#### Scenario: Free Hit recommended
- **WHEN** chipsRemaining.freeHit > 0 AND a BGW exists within the next 3 GWs AND 3 or more squad players have blank fixtures in that BGW
- **THEN** recommend freeHit for the BGW gameweek
- **AND** reason explains which squad players would blank
- **AND** alteredTransfers is null (free hit is independent of permanent transfers — the squad reverts after the GW)

#### Scenario: Free Hit not triggered
- **WHEN** no BGW exists within 3 GWs, or fewer than 3 squad players blank
- **THEN** freeHit is not recommended

### Requirement: Bench Boost trigger
#### Scenario: Bench Boost recommended
- **WHEN** chipsRemaining.benchBoost > 0 AND a DGW exists within the next 3 GWs AND the average composite score of bench players (positions 12–15) is > 0.40
- **THEN** recommend benchBoost for the DGW gameweek
- **AND** reason includes the bench players' average score and DGW details

#### Scenario: Bench Boost — weak bench
- **WHEN** average bench score ≤ 0.40
- **THEN** benchBoost is not recommended (even if DGW exists)

### Requirement: Triple Captain trigger
#### Scenario: Triple Captain recommended
- **WHEN** chipsRemaining.tripleCaptain > 0 AND a DGW exists within the next 2 GWs AND the highest-scoring squad player has both DGW fixtures with FDR ≤ 2
- **THEN** recommend tripleCaptain for that DGW
- **AND** reason names the player and their fixture difficulty

#### Scenario: Triple Captain — hard fixtures
- **WHEN** the best player's DGW fixtures include an FDR > 2
- **THEN** tripleCaptain is not recommended

### Requirement: Chip alters transfer recommendations
#### Scenario: Wildcard makes hits moot
- **WHEN** wildcard is recommended
- **THEN** the single-transfer and hit-transfer recommendations become irrelevant (all transfers are free under wildcard)
- **AND** the chip recommendation's alteredTransfers replaces them

#### Scenario: Bench Boost alters transfer priority
- **WHEN** benchBoost is recommended for a nearby DGW
- **THEN** alteredTransfers may prioritize bench upgrades over starting XI upgrades

### Requirement: No chips available
#### Scenario: All chips used
- **WHEN** all chip counts in chipsRemaining are 0
- **THEN** return an empty array

### Requirement: Chip sequencing conflict
#### Scenario: Multiple chips triggered
- **WHEN** both benchBoost and wildcard are triggered for the same GW range
- **THEN** prefer wildcard (more impactful)
- **AND** defer benchBoost to the next DGW if one exists within the remaining season
