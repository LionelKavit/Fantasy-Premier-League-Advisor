## ADDED Requirements

### Requirement: Single analysis pass
#### Scenario: Squad analysis runs once
- **WHEN** `runGameweekPlan` executes with squad analysis mocked/instrumented
- **THEN** the squad analysis is invoked exactly once and its result is shared by both sub-pipelines (no second pass)

### Requirement: Parallel fan-out
#### Scenario: Concurrent sub-pipelines
- **WHEN** both sub-pipelines are instrumented with delays
- **THEN** total time after context build approximates the slower of the two, not their sum (they overlap)

### Requirement: Triple-captain advice injected before fan-out
#### Scenario: Optimizer receives captain advice
- **WHEN** the plan runs and the captain deterministic phase yields recommended TC advice
- **THEN** the optimizer chip node receives that advice and its chip plan's triple-captain entry matches it (coherence), while the two syntheses still run concurrently

### Requirement: Partial-failure isolation (fault injection)
#### Scenario: Optimizer fails, captain succeeds
- **WHEN** the optimizer synthesis is mocked to throw
- **THEN** the plan resolves with `captaincy` populated, `transfers` null, and a plan-level alert naming the transfer failure

#### Scenario: Captain fails, optimizer succeeds
- **WHEN** the captain side is mocked to throw (deterministic phase or synthesis)
- **THEN** the plan resolves with `transfers` populated, `captaincy` null, and exactly one plan-level alert naming the captain failure (no duplicate alert)

#### Scenario: Both fail
- **WHEN** both sides are mocked to throw
- **THEN** the plan still resolves (does not reject) with both fields null and alerts describing both failures

#### Scenario: Context build failure surfaces
- **WHEN** `buildAnalysisContext` itself throws
- **THEN** `runGameweekPlan` rejects (so the route maps it to an error response) rather than returning a half-empty plan

### Requirement: Standalone-route equivalence
#### Scenario: WithContext cores match wrappers
- **WHEN** the same synthetic context is fed to `runOptimizerWithContext`/`runCaptainWithContext` and to the standalone `runOptimizerPipeline`/`runCaptainPipeline` (with fetchers mocked to return that context's data)
- **THEN** the results are equivalent, proving the gameweek-plan refactor introduced no behavioral drift in the standalone endpoints
