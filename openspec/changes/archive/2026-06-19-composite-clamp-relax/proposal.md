# Relax the composite's [0,1] clamp (recover the epNext ranking)

## Why
`composite-epnext-anchor` lifted the composite's ranking from **0.33 → ~0.42** but hit a wall: the runtime composite ends in `clamp01(...)`. The data-fit ridge wants **signed** weights (the negative price/`value` corrections carry real signal) and ranks **~0.57** unclamped — but in the hard-clamped composite those negatives push **~37% of players below 0**, all tying at 0, which *destroys* ranking (drops to 0.38). So the non-negative weighted average (0.42) was the best achievable under the hard clamp. **The clamp is now the binding constraint** between us and ~0.57 (xP is ~0.62).

## What changes (`composite-scoring`)
Replace the hard `clamp01` with a **smooth, strictly-monotonic squash** (logistic) of the raw weighted sum:
- **Monotonic → preserves the full ranking** of the signed-weighted score (no clamp-ties) → recovers ~0.57.
- **Still outputs (0,1)** → the pitch "/10" display and every downstream `[0,1]` assumption keep working unchanged.
- Switch `SCORING_WEIGHTS` to the **signed, epNext-dominant** weights (epNext unit-weight per position; other signals small signed fractions, incl. the negative price correction).
- Calibrate the squash's center/scale from the training raw-score distribution (emitted by `fit.py`).

## Impact
- `lib/pipeline/composite-scorer.ts` (one squash line), `lib/config.ts` (signed weights + squash constants), `research/composite-backtest/fit.py` (emit signed weights + calibration). No new deps/latency.
- Composite *values* change scale (still (0,1)); rankings improve. Audit downstream consumers that assume the old weighted-average scale (optimizer gain magnitudes, `insufficientDataFallbackScore`); fix any magic thresholds. Update pipeline tests asserting specific values.

## Out of scope
- Non-linear models; squad-decision metrics (`squad-eval`).

## Depends on / informed by
`composite-epnext-anchor` (which established the clamp as the limiter) + the `composite-backtest` benchmark (validation).
