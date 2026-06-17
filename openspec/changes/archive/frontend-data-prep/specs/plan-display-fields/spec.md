## ADDED Requirements

### Requirement: GameweekPlan carries the squad for the pitch
`GameweekPlan` SHALL include a `squad` array of 15 lean player views in pick-slot order, plus `bank`, `chipsRemaining`, and `manager`, all derived from the shared `AnalysisContext` (no second analysis pass, no extra fetch).

#### Scenario: Squad in pick order with starting/bench split
- **WHEN** a plan is produced for a manager
- **THEN** `squad` has 15 entries ordered by pick slot (1–15), each with `pickSlot` and `isStarting` true for slots 1–11 and false for 12–15

#### Scenario: Per-player display fields
- **WHEN** building each squad entry
- **THEN** it carries id, webName, teamShortName, teamCode, position, price, composite `score`, and `availability` { status, chanceOfPlayingNext, news }

#### Scenario: Recommendation flags resolved server-side
- **WHEN** the captain pipeline recommends a captain/vice and the analysis has weak spots
- **THEN** the matching squad entries have `isCaptainRec` / `isViceRec` / `isWeakSpot` set true, so the client needs no cross-referencing

#### Scenario: Manager and team meta present
- **WHEN** a plan is produced
- **THEN** `manager` contains the manager's name, overall rank, and team name (from `managerProfile.entry`), and `bank` / `chipsRemaining` reflect the analysis

### Requirement: Display data survives partial failure
Because the squad and meta come from the shared analysis (computed before fan-out), they SHALL be present even when a sub-pipeline fails.

#### Scenario: Optimizer or captain fails
- **WHEN** a sub-pipeline throws and its result is null
- **THEN** `squad`, `bank`, `chipsRemaining`, and `manager` are still fully populated

#### Scenario: Flags degrade gracefully when captain data is absent
- **WHEN** `captaincy` is null (captain pipeline failed)
- **THEN** every squad entry's `isCaptainRec` and `isViceRec` are false, and the squad still renders correctly

### Requirement: Additive, non-breaking
#### Scenario: Existing consumers unaffected
- **WHEN** the new fields are added to `GameweekPlan`
- **THEN** existing fields (`transfers`, `captaincy`, `alerts`, `currentGw`, `generatedAt`, `teamId`) are unchanged and existing tests still pass
