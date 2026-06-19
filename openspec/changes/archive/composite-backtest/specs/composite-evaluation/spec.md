## ADDED Requirements

### Requirement: Composite is benchmarked against baselines on realized points
The system SHALL evaluate a predictor's player ranking against realized FPL points using decision-relevant and rank metrics, always alongside baselines.

#### Scenario: Rank correlation within position
- **WHEN** a predictor is evaluated for a gameweek
- **THEN** Spearman rank correlation is computed **within each position** (not pooled across positions) against realized points, and averaged across gameweeks

#### Scenario: Top-K precision within position
- **WHEN** the harness runs
- **THEN** it reports top-K precision within position (overlap of the predictor's top-K and the actual top-K by realized points)

> **Moved out:** captain hit-rate and transfer realized gain require a manager-squad simulation (which player you'd captain/transfer within a 15-man squad), not feasible on this player-universe dataset — relocated to the separate `squad-eval` change.

#### Scenario: Always compared to baselines
- **WHEN** any predictor is scored
- **THEN** the same metrics are computed for `xP`/`ep_next`, `ppg`, and the current hand-tuned composite, and reported side by side

#### Scenario: Per-signal ablation
- **WHEN** diagnosing the composite
- **THEN** each signal (or group) is dropped and the metrics re-measured, producing a marginal-value table that justifies inclusion/weighting

#### Scenario: Report artifact
- **WHEN** evaluation completes
- **THEN** a committed report (markdown + JSON) records metrics per position for the next-3-GW horizon, model vs every baseline, plus coverage / low-minute / DGW notes and the `xP` caveat
