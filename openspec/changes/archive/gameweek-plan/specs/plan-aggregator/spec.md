## ADDED Requirements

### Requirement: Build shared analysis context
The system SHALL provide a `buildAnalysisContext(teamId: number): Promise<AnalysisContext>` function that runs squad analysis and the shared reference fetches exactly once.

#### Scenario: Single analysis pass
- **WHEN** buildAnalysisContext is called
- **THEN** `runSquadAnalysisPipeline` is invoked once AND bootstrap, fixtures, manager profile, and gameweek flags are each obtained once
- **AND** the returned context carries all of them

### Requirement: Run the gameweek plan
The system SHALL provide a `runGameweekPlan(teamId: number, options: { freeTransfers: number; captainHorizon?: number }): Promise<GameweekPlan>` function that builds the shared context once and fans out to both sub-pipelines.

#### Scenario: Shared context, no recomputation
- **WHEN** runGameweekPlan executes
- **THEN** it builds one AnalysisContext and passes it to both `runOptimizerWithContext` and `runCaptainWithContext`
- **AND** squad analysis is NOT run a second time

#### Scenario: Parallel fan-out
- **WHEN** the context is ready
- **THEN** the optimizer and captain pipelines run concurrently
- **AND** total time after analysis approximates the slower of the two, not their sum

#### Scenario: Both succeed
- **WHEN** both sub-pipelines return results
- **THEN** the GameweekPlan has transfers and captaincy populated and plan-level alerts empty

### Requirement: Partial-failure resilience
A hard failure in one sub-pipeline SHALL NOT fail the whole plan.

#### Scenario: Optimizer fails, captain succeeds
- **WHEN** `runOptimizerWithContext` throws
- **THEN** the plan returns captaincy populated, transfers null, and an alert noting the transfer pipeline failed

#### Scenario: Captain fails, optimizer succeeds
- **WHEN** `runCaptainWithContext` throws
- **THEN** the plan returns transfers populated, captaincy null, and an alert noting the captain pipeline failed

#### Scenario: Both fail
- **WHEN** both throw
- **THEN** the plan returns both fields null and alerts describing both failures (the request itself still resolves successfully)

### Requirement: Injected-context entry points
The optimizer and captain pipelines SHALL each expose a function that accepts a pre-built `AnalysisContext` instead of fetching/recomputing.

#### Scenario: Optimizer accepts context
- **WHEN** `runOptimizerWithContext(ctx, freeTransfers)` is called
- **THEN** it uses ctx.analysis, ctx.players, ctx.teams, ctx.fixtures, ctx.managerProfile, and ctx.gwFlags directly and does not call `runSquadAnalysisPipeline`

#### Scenario: Captain accepts context
- **WHEN** `runCaptainWithContext(ctx, captainHorizon)` is called
- **THEN** it uses the shared context directly and does not call `runSquadAnalysisPipeline`

#### Scenario: Standalone entry points preserved
- **WHEN** the existing `runOptimizerPipeline(teamId, freeTransfers)` or `runCaptainPipeline(teamId, ...)` is called
- **THEN** it builds an AnalysisContext internally and delegates to its `*WithContext` core
- **AND** `/api/optimize` and `/api/captain` behavior is unchanged

### Requirement: Plan API route
The system SHALL expose `GET /api/plan?team_id=X&free_transfers=N&horizon=M` returning a `GameweekPlan`.

#### Scenario: Missing team id
- **WHEN** team_id is absent
- **THEN** respond 400 with an error payload, mirroring `/api/optimize`

#### Scenario: Defaults
- **WHEN** free_transfers or horizon are absent
- **THEN** free_transfers defaults to 1 (clamped to 1–2) and the captain horizon uses its pipeline default

#### Scenario: Success
- **WHEN** a valid team_id is supplied
- **THEN** respond 200 with the GameweekPlan JSON
