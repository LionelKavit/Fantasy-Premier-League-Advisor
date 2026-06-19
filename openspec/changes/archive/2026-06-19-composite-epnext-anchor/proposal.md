# Anchor the composite score on FPL's epNext

## Why
The `composite-backtest` + `composite-weight-training` work produced an unambiguous, evidence-backed finding:

- The current hand-tuned composite ranks players at **Spearman 0.33** (next-3-GW points) — **worse than FPL's own `ep_next` (0.61)** and barely above raw `ppg`.
- A data-driven ridge refit lifts it to **0.57**, and its coefficients show **`epNextSignal` dominating ~40× every other signal** in all positions. The data says: *anchor the composite on FPL's `ep_next`.*
- Today the composite **excludes** market signals (incl. `epNextSignal`) from its total entirely — it's leaving the single best signal on the table.

This change makes that the runtime reality: fold `epNextSignal` into the composite with a **dominant, range-safe weight**, and rebalance the other weights from the fit. Expected to lift the live composite's ranking from ~0.33 toward ~0.57–0.61.

## What changes (`composite-scoring`)
- **Add `epNext` to the weighted base sum** in `lib/pipeline/composite-scorer.ts` (`market.epNextSignal` is already computed, just excluded today) by giving `epNext` a weight in each `SCORING_WEIGHTS[position]`.
- **Re-derive `SCORING_WEIGHTS`** from the Phase 2 fit, **rescaled to keep the composite in [0,1]** (the raw fitted coefficients, e.g. epNext≈44, would saturate the runtime `clamp01` and destroy ranking). epNext gets the dominant share (~0.5–0.7); the other normalized signals share the remainder, preserving the fitted ranking while staying range-safe.
- Keep the deterministic signals (small weight) so the `breakdown` that powers the Scout's explanations survives — even though they add little ranking value.

## Impact
- Runtime composite values/rankings change (squad/transfer ranking, weak-spot ID, pitch "rating /10"). No new latency or deps — still `Σ signal × weight`.
- `epNext` is FPL-provided and always available live (deterministic, no LLM) — improves robustness.
- Pipeline tests that assert specific composite values/orderings may need updating.

## Out of scope
- Non-linear models; squad-decision metrics (`squad-eval`).
- Removing the now-low-value deterministic signals (possible later simplification — kept here for explainability).

## Depends on / informed by
`composite-backtest` + `composite-weight-training` (the fit + benchmark are the evidence and the validation harness).
