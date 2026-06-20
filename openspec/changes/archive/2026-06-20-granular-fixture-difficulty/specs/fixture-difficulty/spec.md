## MODIFIED Requirements

### Requirement: The composite's fixture signal uses granular team strength, not the crude FDR
The composite's `fixture` input SHALL be derived from FPL's continuous, position-aware team-strength ratings (the existing `opponentStrength`, or a calibrated blend with `fdrScore`) rather than the crude 1–5 FDR bucket — with the variant chosen by the `composite-backtest` benchmark.

#### Scenario: Source is FPL strength, not external Elo
- **WHEN** the fixture signal is computed
- **THEN** it is derived from FPL's own `strength_attack_*` / `strength_defence_*` ratings (already fetched), not an external/results-based Elo dataset

#### Scenario: Position-aware difficulty
- **WHEN** the strength-based signal is computed for a player
- **THEN** attackers (FWD/MID) are scored against the opponent's defensive strength and defenders/GK against the opponent's attacking strength (as `opponentStrength` already does)

#### Scenario: Replace-vs-blend is chosen by the backtest
- **WHEN** the fixture variant is selected
- **THEN** a report-only calibration compares `fdr-only` (current), `strength-only`, and blends of the two on the existing dataset's fixture-complete, gate-clean rows, and the best-ranking, stable variant is chosen and recorded
- **AND** if `fdr-only` already wins, no change is made and that result is documented

#### Scenario: Composite reads the new signal
- **WHEN** `buildSignalMap` builds the composite inputs
- **THEN** its `fixture` value reads the chosen `fixtureScore`, while `fdrScore` / `opponentStrength` / `gw5AvgFdr` remain available on `FixtureSignals` for other consumers

#### Scenario: Validated with no regression; refit only if needed
- **WHEN** the swap is applied and the `composite-backtest` benchmark is re-run
- **THEN** within-position ranking does not regress versus the current composite (~0.53); the learned weights are refit only if the swap regresses, otherwise the shipped weights are kept and only the signal changes
- **AND** `tsc` / `eslint` / `next build` / `vitest` stay clean

#### Scenario: Scope limited to the composite
- **WHEN** this change ships
- **THEN** only the composite's `fixture` input changes; the captain `fixtureMultiplier` and horizon `gw5AvgFdr` still use the 1–5 FDR (a separate follow-up)
