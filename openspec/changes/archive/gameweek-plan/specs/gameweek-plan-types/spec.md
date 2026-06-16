## ADDED Requirements

### Requirement: AnalysisContext type
The system SHALL define an `AnalysisContext` interface bundling the once-computed inputs shared by the optimizer and captain pipelines: `analysis` (SquadAnalysisResult), `managerProfile` (ManagerProfile), `players` (Player[]), `teams` (Team[]), `fixtures` (Fixture[]), `gwFlags` (GameweekFlags[]).

#### Scenario: Context is self-sufficient
- **WHEN** an AnalysisContext is constructed
- **THEN** it contains everything both sub-pipelines need, so neither has to re-fetch bootstrap/fixtures or re-run squad analysis

### Requirement: GameweekPlan type
The system SHALL define a `GameweekPlan` interface: `teamId` (number), `currentGw` (number), `transfers` (OptimizerResult | null), `captaincy` (CaptainResult | null), `alerts` (string[] — plan-level alerts), `generatedAt` (string — ISO timestamp).

#### Scenario: Both sub-results present
- **WHEN** both pipelines succeed
- **THEN** transfers and captaincy are both populated and alerts is empty (barring sub-result alerts, which live inside each sub-result)

#### Scenario: One sub-result missing
- **WHEN** a sub-pipeline fails hard
- **THEN** its field is null AND alerts contains a plain-English note identifying which side failed
