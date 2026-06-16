## ADDED Requirements

### Requirement: Compute captain horizon
The system SHALL provide a `computeCaptainHorizon(squad: ScoredPlayer[], picks: Pick[], fixtures: Fixture[], teams: Team[], currentGw: number, horizonLength: number): HorizonCaptainEntry[]` function that, for each gameweek from currentGw+1 to currentGw+horizonLength, scores the starting XI for captaincy and records the best candidate.

#### Scenario: Per-GW best captain
- **WHEN** computing the horizon entry for GW+2
- **THEN** every XI player is scored via `computeCaptainScore` for GW+2 AND the entry's bestCaptain is the highest-scoring candidate for that gameweek

#### Scenario: DGW peak surfaces
- **WHEN** a double gameweek falls within the horizon and an XI player has two strong fixtures
- **THEN** that gameweek's entry has isDgw true and a bestScore notably above single-fixture weeks

#### Scenario: End of season
- **WHEN** fewer than horizonLength gameweeks remain before GW38
- **THEN** only the remaining gameweeks are computed

### Requirement: Triple-captain advice
The system SHALL provide a `deriveTripleCaptainAdvice(horizon: HorizonCaptainEntry[], baselineScore: number, chipAvailable: boolean): TripleCaptainAdvice` function.

`baselineScore` is the best captain score in a normal (single-fixture) week — the opportunity cost of not banking the chip.

#### Scenario: Recommend on strong peak
- **WHEN** the chip is available AND the horizon's peak bestScore exceeds baselineScore by a configurable margin (e.g. a strong DGW)
- **THEN** recommended is true, targetGw and targetPlayer are the peak entry's, peakScore and baselineScore are reported, and reasoning explains the edge

#### Scenario: Hold the chip
- **WHEN** no horizon peak meaningfully exceeds the baseline
- **THEN** recommended is false AND reasoning advises holding the chip for a better week

#### Scenario: Chip already used
- **WHEN** chipAvailable is false
- **THEN** recommended is false AND reasoning notes the chip is unavailable

### Requirement: Triple-captain integration with chip node
The triple-captain branch of the optimizer's `evaluateChipInteractions` SHALL consume `deriveTripleCaptainAdvice` output instead of selecting `squad[0]` and independently checking DGW fixtures.

#### Scenario: Chip node defers to captain horizon
- **WHEN** the optimizer evaluates the triple-captain chip
- **THEN** it uses the captain pipeline's recommended target gameweek and player rather than its own `squad[0]` heuristic

#### Scenario: Behavior preserved when captain data absent
- **WHEN** captain advice is not provided to the chip node (e.g. captain pipeline not run)
- **THEN** the chip node falls back to its existing DGW-based heuristic (no regression)
