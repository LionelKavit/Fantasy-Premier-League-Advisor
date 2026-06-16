## ADDED Requirements

### Requirement: Degenerate inputs never crash
#### Scenario: Empty and minimal squads
- **WHEN** pipelines/nodes run with an empty squad, an empty candidate pool, zero bank, or no upcoming fixtures
- **THEN** they return well-formed results (empty arrays, ROLL, or documented defaults) without throwing

#### Scenario: All-unavailable XI for captaincy
- **WHEN** every starter is injured/suspended/blank
- **THEN** captain scoring yields zeros and the pipeline returns a coherent result (fail-safe narrative, no crash)

### Requirement: Boundary value sweeps
#### Scenario: Threshold edges
- **WHEN** inputs sit exactly on documented thresholds (minutes minimum, suspension yellow counts, FDR 1 and 5, ownership differential cutoff, hit cost break-even, free transfers 1 vs 2)
- **THEN** behavior matches the spec on each side of the boundary

#### Scenario: Extreme magnitudes
- **WHEN** signals receive very large or negative raw values
- **THEN** normalization and scoring clamp to their documented ranges (no Infinity/NaN)

### Requirement: Malformed LLM payload handling
#### Scenario: Varied bad payloads
- **WHEN** the Claude mock returns empty content, text with no JSON, JSON missing required fields, wrong-typed fields, or out-of-range confidence
- **THEN** the synthesis nodes and `batchComputeLlmContext` fall back or coerce per spec (clamp confidence, neutral LLM defaults) and never throw

### Requirement: Scale / stress
#### Scenario: Large candidate pools and pair search
- **WHEN** the optimizer runs with a large valid-transfer set (double-hit pair search is O(n²))
- **THEN** it completes within a sane time bound and returns correct top results (a performance guard, not just correctness)

#### Scenario: Full-season horizon sweep
- **WHEN** captain and transfer horizons are computed near the season start (maximum remaining gameweeks)
- **THEN** they complete and respect the configured horizon length

### Requirement: Invariants / properties
#### Scenario: Score range invariants
- **WHEN** any composite or captain score is produced across swept inputs
- **THEN** composite totals are within [0,1] and captain scores are non-negative

#### Scenario: Referential transparency
- **WHEN** a pure node is called twice with identical inputs
- **THEN** it returns deeply-equal outputs (timestamps excluded)

#### Scenario: Conservation rules
- **WHEN** transfers are validated/built
- **THEN** no result violates the 3-per-club rule or the budget constraint, for any constructed squad/bank combination
