## ADDED Requirements

### Requirement: Evaluate hit transfers
The system SHALL provide a `evaluateHitTransfers(validTransfers: ValidTransfer[], bank: number, squadTeamCounts: Map<number, number>, freeTransfers: number): HitTransferResult` function that evaluates single and double hit transfers.

`freeTransfers` (1 or 2) is passed via API input. With 2 free transfers, the manager can make 2 transfers for free — so a "single hit" means 3 transfers total (2 free + 1 hit at −4 cost).

### Requirement: Single hit analysis
The system SHALL evaluate the best additional transfer beyond the free transfer(s), at a cost of −4 points.

#### Scenario: Single hit net gain — positive
- **WHEN** the best free transfer has gw1Gain 3.0 and the best additional hit transfer has gw1Gain 5.5
- **THEN** singleHit.netGain is 5.5 - 4 = 1.5
- **AND** singleHit.transfers contains the hit transfer

#### Scenario: Single hit not worth it
- **WHEN** no additional transfer yields gw1Gain > 4
- **THEN** singleHit is null

#### Scenario: Break-even computation
- **WHEN** a hit transfer has gw5Gain of 2.0 per gameweek equivalent
- **THEN** breakEvenGw is ceil(4 / 2.0) = 2
- **AND** if gw5Gain ≤ 0, breakEvenGw is null (never breaks even)

### Requirement: Double hit analysis
The system SHALL evaluate all valid pairs of hit transfers at a combined cost of −8 points.

#### Scenario: Budget chain simulation
- **WHEN** evaluating transfer pair (A, B)
- **THEN** simulate transfer A first: bankAfterA = bank + weakA.price - candidateA.price
- **AND** validate candidateB.price ≤ weakB.price + bankAfterA
- **AND** try both orderings (A then B, B then A) and pick the one with higher combined net gain

#### Scenario: Club rule after both transfers
- **WHEN** transfer A brings in a player from TeamX AND transfer B also brings in a player from TeamX
- **THEN** validate that the total TeamX count after both sells and both buys is ≤ 3

#### Scenario: Double hit threshold
- **WHEN** combined gw1Gain of both hit transfers exceeds 8
- **THEN** doubleHit.netGain is combined gw1Gain - 8
- **AND** doubleHit.transfers contains both transfers

#### Scenario: Double hit not worth it
- **WHEN** no pair of hit transfers yields combined gw1Gain > 8
- **THEN** doubleHit is null

#### Scenario: Same weak player in both transfers
- **WHEN** both transfers target the same weak player
- **THEN** the pair is invalid (can only replace a player once)

#### Scenario: With 2 free transfers
- **WHEN** freeTransfers is 2
- **THEN** both free transfers are used first, and hits are evaluated as transfers beyond those 2
- **AND** singleHit cost is still −4 (for the 3rd transfer)
- **AND** doubleHit cost is still −8 (for 3rd + 4th transfers)
