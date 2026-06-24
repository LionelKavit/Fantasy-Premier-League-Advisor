## ADDED Requirements

### Requirement: The optimizer recommends up to N free moves
When the manager has `freeTransfers` free moves, the engine SHALL produce up to that many non-overlapping
free transfers, not a fixed maximum of one or two. The recommended set is exposed as an ordered
`freeMoves` list on the single-transfer result.

#### Scenario: Five free transfers, five worthwhile upgrades
- **WHEN** `freeTransfers` is 5 and at least five distinct, budget- and squad-legal upgrades each clear the
  free-transfer ep bar
- **THEN** the recommendation is a `FREE` action carrying five moves, and the structured
  `primaryRecommendation.transfers` lists all five (not just the top one)

#### Scenario: Three free transfers, two worthwhile upgrades
- **WHEN** `freeTransfers` is 3 but only two moves clear the bar
- **THEN** exactly two free moves are recommended and the third is left to roll/bank (the engine stops early)

#### Scenario: Two free transfers behave as before, now structured
- **WHEN** `freeTransfers` is 2 and two upgrades clear the bar
- **THEN** both moves appear in the structured `FREE` action (previously only the first did)

### Requirement: Every stacked free move independently clears the ep bar
Each move in the `freeMoves` set SHALL clear the free-transfer expected-points bar
(`TRANSFER_THRESHOLDS.freeTransferEp`); marginal moves are banked rather than forced just because a
transfer is available.

#### Scenario: A marginal later move is not forced
- **WHEN** `freeTransfers` is 4 and the fourth-best move projects below the free-transfer ep bar
- **THEN** it is excluded from `freeMoves` (the manager is advised to bank that transfer)

#### Scenario: Running budget and club limits are respected across the stack
- **WHEN** stacking multiple free moves
- **THEN** each move is validated against the bank and 3-per-club counts *after* applying the prior moves,
  so the set is collectively legal

### Requirement: Free moves at the boundaries are unchanged
The N-move generalization SHALL preserve existing behaviour at `freeTransfers` 0 and 1.

#### Scenario: Zero free transfers still routes through the hit bar
- **WHEN** `freeTransfers` is 0
- **THEN** no free move is produced; the top move is gated on the hit bar and any recommendation is a hit
  (unchanged)

#### Scenario: One free transfer yields a single move
- **WHEN** `freeTransfers` is 1 and the top move clears the bar
- **THEN** exactly one free move is recommended (unchanged)

### Requirement: Hit evaluation excludes all free moves
The hit search SHALL exclude every transfer already in the `freeMoves` set, so no move is recommended both
as a free move and as a paid hit.

#### Scenario: A free move is not re-offered as a hit
- **WHEN** `freeTransfers` is 3 and three moves are taken for free
- **THEN** none of those three appears in the single-hit or double-hit recommendation

### Requirement: The recommendation headline reflects the number of free moves
The This Week panel and the Scout's opening brief SHALL state the actual number of free transfers in the
recommendation rather than a hardcoded singular.

#### Scenario: Plural headline for a multi-move free recommendation
- **WHEN** the `FREE` recommendation carries three moves
- **THEN** the headline reads "Make 3 free transfers" (and "Make 1 free transfer" when it carries one)
