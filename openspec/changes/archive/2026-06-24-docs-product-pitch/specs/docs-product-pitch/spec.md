## ADDED Requirements

### Requirement: The README leads as a product pitch
The README SHALL open by framing the FPL manager's weekly pain and Pocket Scout's promise — a personalized,
educated, deterministic scout for the reader's own team — before the feature list and engineering detail,
so a player (not only an engineer) understands the value in the first screen.

#### Scenario: A player reads the top of the README
- **WHEN** an FPL manager opens the README
- **THEN** the first section names the pain (the weekly transfer/captain/chip decision, made on hunches and
  conflicting takes) and the promise (a scout that reads *your* squad and explains *why*), and only then
  proceeds to features and architecture

#### Scenario: The pitch names the three differentiators
- **WHEN** the pitch explains how Pocket Scout differs from generic tools
- **THEN** it states that it plans within the manager's real constraints (0–5 free transfers, stacked moves
  or a restructure), holds/banks rather than churns (expected-points gate), and shows its work (a
  deterministic model plus tool-grounded chat that never invents numbers)

### Requirement: The docs reflect the final state of this branch
Every doc SHALL describe the shipped behaviour — a 0–5 free-transfer input, up to N stacked free moves, and
an ep-native restructure chosen by an optimal allocation — with no stale references to a 1-or-2 toggle, a
single-move recommendation, or a composite-scored restructure.

#### Scenario: Free transfers are described as 0–5 with multi-move output
- **WHEN** the docs describe the transfer input and recommendation
- **THEN** they state the manager enters 0–5 free transfers and the Scout recommends up to that many stacked
  moves (or a restructure), not a 1-or-2 toggle producing a single move

#### Scenario: Restructure is described in expected points and as part of the allocation
- **WHEN** the docs describe the Restructure feature
- **THEN** they describe it in expected points, chosen into the primary plan when it out-projects straight
  swaps, and otherwise listed as an alternative priced against the remaining free transfers

#### Scenario: The architecture and eval docs and the test count are current
- **WHEN** ARCHITECTURE.md and EVALUATION.md describe the optimizer and the test suite
- **THEN** the optimizer section describes the optimal free-transfer allocation (swaps cost 1, restructures
  cost 2; max expected-points-net within the budget; feasibility-checked), the eval doc notes the same ep
  bar governs the allocation, and the stated test count matches the suite

### Requirement: The screenshot set shows the new surfaces
The image catalog SHALL reference screenshots that show this branch's features, and any not yet supplied
SHALL be marked as placeholders so the docs are internally consistent.

#### Scenario: New/updated screenshots are catalogued
- **WHEN** the docs reference screenshots
- **THEN** the catalog includes an updated hero (verdict bar with a multi-move summary and the 0–5 FT
  field), an updated This Week ("Make N free transfers" plus the ep-native Restructure row), and a new
  close-up of the 0–5 free-transfer field — each either present or clearly marked "to be supplied"
