## ADDED Requirements

### Requirement: Banked-transfer copy respects the 5-transfer cap
When the engine recommends rolling, the number of free transfers it says will be banked next week SHALL be
capped at the FPL maximum of 5, not the old maximum of 2.

#### Scenario: Rolling from three
- **WHEN** `freeTransfers` is 3 and the engine recommends a roll
- **THEN** the roll reason says 4 free transfers will be banked next week

#### Scenario: Rolling at the cap
- **WHEN** `freeTransfers` is 5 and the engine recommends a roll
- **THEN** the roll reason says 5 free transfers will be banked (the cap, not 6)

#### Scenario: Rolling from one is unchanged
- **WHEN** `freeTransfers` is 1 and the engine recommends a roll
- **THEN** the roll reason says 2 free transfers will be banked (unchanged)

### Requirement: Restructure cost reflects the two transfers it spends
A restructure chain spends two transfers, so its points cost SHALL be `max(0, 2 − freeTransfers) × 4`,
correct across the full 0–5 range.

#### Scenario: No free transfers
- **WHEN** a restructure is evaluated with `freeTransfers` of 0
- **THEN** its `totalCost` is 8 (two −4 hits) and the row displays "−8 pts"

#### Scenario: One free transfer
- **WHEN** a restructure is evaluated with `freeTransfers` of 1
- **THEN** its `totalCost` is 4 (one −4 hit)

#### Scenario: Two or more free transfers
- **WHEN** a restructure is evaluated with `freeTransfers` of 2, 3, 4, or 5
- **THEN** its `totalCost` is 0 and the row displays "free" (unchanged)
