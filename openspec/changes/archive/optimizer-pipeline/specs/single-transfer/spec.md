## ADDED Requirements

### Requirement: Evaluate single free transfer
The system SHALL provide a `evaluateSingleTransfer(validTransfers: ValidTransfer[], managerProfile: ManagerProfile, freeTransfers: number): SingleTransferResult` function that determines the best free transfer option(s) or recommends rolling the transfer.

#### Scenario: Best by gw1Gain
- **WHEN** valid transfers exist with positive gw1Gain
- **THEN** bestSingle is the one with the highest gw1Gain
- **AND** alternatives are the next 3 by gw1Gain

#### Scenario: Tiebreaker
- **WHEN** two transfers have equal gw1Gain
- **THEN** prefer the one with higher gw5Gain (longer-term value)

#### Scenario: Roll transfer
- **WHEN** all valid transfers have gw1Gain ≤ 0
- **THEN** bestSingle is null
- **AND** rollReason is "No transfer improves GW{N} projection. Rolling transfer to bank 2 free transfers next week."

#### Scenario: No valid transfers at all
- **WHEN** validTransfers is empty
- **THEN** bestSingle is null
- **AND** rollReason is "No valid transfer targets available within budget and squad constraints."

#### Scenario: Savings option identified
- **WHEN** a valid transfer exists where candidate.price < weak.price - 0.5 AND gw1Gain > -0.05
- **THEN** savingsOption is that transfer
- **AND** the savings option is the one that frees the most budget among qualifying transfers

#### Scenario: No savings option
- **WHEN** no transfer meets the savings criteria
- **THEN** savingsOption is null

#### Scenario: Fewer than 3 alternatives
- **WHEN** only 2 valid transfers exist beyond the bestSingle
- **THEN** alternatives contains 2 entries (not padded to 3)

### Requirement: Second free transfer
The system SHALL recommend a second transfer when 2 free transfers are available.

#### Scenario: Two free transfers — second pick exists
- **WHEN** freeTransfers is 2 AND bestSingle is not null
- **THEN** bestSecond is the highest gw1Gain ValidTransfer that targets a DIFFERENT weak player than bestSingle
- **AND** bestSecond.gw1Gain must be > 0 (don't waste a free transfer on a downgrade)

#### Scenario: Two free transfers — no valid second
- **WHEN** freeTransfers is 2 AND no valid transfer targets a different weak player with positive gw1Gain
- **THEN** bestSecond is null (bank the second free transfer as a roll)

#### Scenario: One free transfer
- **WHEN** freeTransfers is 1
- **THEN** bestSecond is null

#### Scenario: Budget after first transfer
- **WHEN** evaluating bestSecond AND bestSingle has a negative priceDelta (frees budget)
- **THEN** the freed budget from bestSingle is available for bestSecond's budget check
