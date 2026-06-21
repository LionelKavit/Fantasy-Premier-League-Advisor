## MODIFIED Requirements

### Requirement: GameweekPlan type
The system SHALL define a `GameweekPlan` interface: `teamId` (number), `currentGw` (number), `deadline` (string | null — ISO deadline of the current gameweek, when picks lock), `transfers` (OptimizerResult | null), `captaincy` (CaptainResult | null), `alerts` (string[] — plan-level alerts), `generatedAt` (string — ISO timestamp).

#### Scenario: Both sub-results present
- **WHEN** both pipelines succeed
- **THEN** transfers and captaincy are both populated and alerts is empty (barring sub-result alerts, which live inside each sub-result)

#### Scenario: One sub-result missing
- **WHEN** a sub-pipeline fails hard
- **THEN** its field is null AND alerts contains a plain-English note identifying which side failed

#### Scenario: Deadline present from the base phase
- **WHEN** a plan is built (base or full)
- **THEN** `deadline` carries the current gameweek's ISO `deadline_time`, available the instant the pitch paints (no dependency on the insights phase)

#### Scenario: Deadline absent
- **WHEN** the FPL bootstrap has no current/next gameweek (off-season or cold start)
- **THEN** `deadline` is `null` (never throws), consistent with the existing `currentGw` fallback

## ADDED Requirements

### Requirement: Deadline threaded through squad analysis
The system SHALL include `deadline` (string | null) on `SquadAnalysisResult`, sourced from `bootstrap.currentGameweek?.deadline_time`, at both analysis build sites so the plan can carry it without an extra fetch.

#### Scenario: Full pipeline
- **WHEN** `runSquadAnalysisPipeline` builds the analysis
- **THEN** the result's `deadline` is the bootstrap current-gameweek deadline (or `null`)

#### Scenario: Lite base context
- **WHEN** `buildLiteBaseContext` builds the lightweight analysis for the pitch
- **THEN** the result's `deadline` is set identically, so the base-phase plan is deadline-aware
