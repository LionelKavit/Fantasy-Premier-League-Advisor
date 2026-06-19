## MODIFIED Requirements

### Requirement: The composite uses a monotonic squash, not a hard clamp
The composite total SHALL be produced by a strictly-monotonic squash of the raw weighted sum (logistic), so the full ranking of a signed-weighted score is preserved while the output stays in (0,1).

#### Scenario: Ranking-preserving range mapping
- **WHEN** `computeCompositeScore` finalizes the total
- **THEN** it applies a strictly-increasing logistic `1/(1+exp(−(raw−center)/scale))` (not `clamp01`) so the output is in (0,1) with **no ties at the bounds** and the ordering equals the raw weighted sum's ordering
- **AND** `center`/`scale` are calibrated from the training raw-score distribution (config constants)

#### Scenario: Full-magnitude signed weights
- **WHEN** `SCORING_WEIGHTS` is set
- **THEN** it uses the **full-magnitude** signed ridge coefficients (epNext dominant, ~10–13 per position; other signals small signed values incl. the negative price/`value` correction) — NOT scaled to epNext=1. At full magnitude the base weighted sum dominates the small additive trend/suspension terms (±0.05), so the composite's ranking equals the fit's; scaling down to epNext=1 lets those additive terms overwhelm the compressed base and collapses ranking (~0.39).

#### Scenario: epNextSignal is normalized identically offline and at runtime
- **WHEN** the offline backtest dataset computes `epNextSignal` for the fit
- **THEN** it SHALL normalize `xP` by the **per-round pool max** (the offline analog of the runtime's `epNext / maxEpNext`, where `maxEpNext` is the max projection across the current player pool) — NOT by the season's single best-ever GW
- **AND** this keeps the fitted coefficients + squash calibration on the same scale the runtime feeds, so they transfer without saturating (normalizing by the season max made the offline signal ~20× smaller than runtime's, which saturated every squad rating near 1.0)

#### Scenario: Ranking improves vs the clamped weighted average
- **WHEN** the re-weighted+squashed composite is re-run through the `composite-backtest` benchmark
- **THEN** it ranks markedly better than the clamped non-negative average (~0.53 vs ~0.42 Spearman within position, approaching the xP baseline ~0.59 and the unconstrained fit ~0.567), with a non-degenerate distribution (no mass at the exact bounds; <0.1% near 1.0, 0% at 0)

#### Scenario: Display and downstream stay in range
- **WHEN** the composite feeds the pitch "/10" display and downstream consumers
- **THEN** the (0,1) output keeps `score × 10` ∈ [0,10] sensible and **well-spread** (verified: a real squad spans ~2.9–9.9, monotonic with epNext within position), and consumers that rank/diff the composite are unaffected — the optimizer's absolute thresholds (`gw1Gain > 0.05`, `insufficientDataFallbackScore 0.3`, `minutesCertainty < 0.7`) were audited and remain valid on the (0,1) distribution
