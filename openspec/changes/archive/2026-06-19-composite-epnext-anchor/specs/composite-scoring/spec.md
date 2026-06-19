## MODIFIED Requirements

### Requirement: The composite score incorporates FPL's epNext, range-safe
The composite score SHALL include FPL's `ep_next` (via `epNextSignal`) as a dominant weighted input, with weights derived from the data-fit and rescaled so the total stays in [0,1] and the ranking is preserved.

#### Scenario: epNext is weighted into the total
- **WHEN** `computeCompositeScore` runs
- **THEN** `market.epNextSignal` contributes to the weighted base sum (via an `epNext` weight in `SCORING_WEIGHTS[position]`) — it is no longer computed-but-excluded
- **AND** when `ep_next` is null, `epNextSignal` falls back to a neutral 0.5 so the player isn't collapsed

#### Scenario: Weights are data-derived and range-safe
- **WHEN** `SCORING_WEIGHTS` is set
- **THEN** the per-position weights come from the `composite-weight-training` fit, rescaled to the [0,1] convention so the clamped composite does not saturate (epNext dominant; other normalized signals share the remainder)

#### Scenario: Ranking improves and is validated
- **WHEN** the re-weighted composite is re-run through the `composite-backtest` benchmark
- **THEN** it ranks players markedly better than the prior hand-tuned weights (≈0.57 vs ~0.33 Spearman on held-out, beating `ppg`), with a non-degenerate score distribution (not pinned at 1.0)

#### Scenario: Explainability retained
- **WHEN** the composite is computed
- **THEN** the deterministic signal `breakdown` (goalThreat, fixture, form, …) is still produced (signals kept at small weight) so the Scout's prose can explain the score
