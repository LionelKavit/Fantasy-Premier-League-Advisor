## ADDED Requirements

The end-to-end tests drive the **real** pipelines with the FPL fetchers mocked to return a synthetic-but-realistic dataset and the Claude boundary mocked. They prove the system understands a user's request and that data flows from the API through every node into a final, personalized output.

### Requirement: Request is understood
The system SHALL correctly interpret a user request (`team_id`, `free_transfers`, `horizon`) and thread it through the pipelines.

#### Scenario: Required and optional params
- **WHEN** `/api/plan` is called without `team_id`
- **THEN** it returns a 400 error; and when `free_transfers`/`horizon` are omitted they default (free transfers 1, horizon to the captain default)

#### Scenario: Param clamping drives behavior
- **WHEN** `free_transfers` is given out of range (e.g. 0 or 5) and `horizon` out of range
- **THEN** they are clamped to 1–2 and 1–10 respectively, and the clamped values actually affect behavior (see free-transfer scenario below)

#### Scenario: team_id selects the manager's data
- **WHEN** two different `team_id`s map (via mocked fetchers) to two different squads
- **THEN** the two plans differ accordingly (the output is tied to the requested manager, not generic)

### Requirement: End-to-end data flow produces a complete output
#### Scenario: Full chain happy path
- **WHEN** `runGameweekPlan` runs over a synthetic bootstrap/picks/fixtures/history with the Claude mock returning valid responses
- **THEN** it returns a well-formed `GameweekPlan` with `teamId`, `currentGw`, a populated `transfers` (with a `primaryRecommendation`), a populated `captaincy` (with a `captain` and a full 11-candidate ranking), and no plan-level failure alerts

#### Scenario: Continuity of API-sourced data
- **WHEN** the plan is produced
- **THEN** values sourced at the API surface appear coherently downstream: `GameweekPlan.currentGw` equals the detected gameweek; the manager's bank constrains valid transfers; `chipsRemaining` gates chip advice; and `picks` positions 12–15 are the squad used for bench-boost evaluation

#### Scenario: No data dropped between nodes
- **WHEN** tracing a single squad through squad-analysis → optimizer/captain → plan
- **THEN** the weak spots feeding the optimizer are the squad-analysis weak spots, and the captain candidates are the squad-analysis starting XI (no silent loss or substitution of upstream data)

### Requirement: Output is personalized to the manager
#### Scenario: Transfers target the manager's own weaknesses
- **WHEN** the plan recommends transfers
- **THEN** every transfer "out" is one of the manager's weakest-3 players and every "in" respects the manager's bank and the 3-per-club rule for that squad

#### Scenario: Captain is from the manager's XI
- **WHEN** the plan recommends a captain and vice
- **THEN** both are members of the requested manager's starting XI, and the vice is in a different match from the captain

#### Scenario: Free transfers change the recommendation
- **WHEN** the same squad is planned with `free_transfers` 1 vs 2
- **THEN** the 2-FT plan can surface a second free transfer (`bestSecond`) that the 1-FT plan does not

#### Scenario: Chips gate chip advice
- **WHEN** the manager has a chip available vs already used
- **THEN** the relevant chip recommendation/triple-captain advice can appear only when the chip is available

#### Scenario: Risk profile biases synthesis (mocked LLM)
- **WHEN** the manager profile is rank-rising vs rank-falling and the Claude mock echoes the prompt's strategy guidance
- **THEN** the prompt conveys the corresponding template-vs-differential / hit-aversion posture for that manager

#### Scenario: Different managers, different plans
- **WHEN** two managers with different squads, banks, and chip states are planned
- **THEN** their plans differ in weak spots, recommended transfers, and captain — confirming personalization rather than a fixed response

### Requirement: End-to-end resilience
#### Scenario: Partial failure still personalized
- **WHEN** one sub-pipeline fails mid-flow (fault injected) for a given manager
- **THEN** the surviving side of the plan is still correct and specific to that manager, with a plan-level alert for the failed side
