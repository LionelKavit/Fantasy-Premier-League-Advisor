# Composite weight training (Phase 2)

## Why
`composite-backtest` (Phase 1, archived) ran and produced the verdict: the hand-tuned composite scores **Spearman 0.31** at ranking players by next-3-GW points versus FPL's own **`xP` at 0.62** (ppg 0.34) — it **does not beat FPL's own numbers**, even on gate-clean seasons. This change (Phase 2) uses Phase 1's point-in-time dataset to **fit the linear composite weights from data** (and fold `ep_next` in) instead of hand-tuning them.

The composite is already a per-position linear model (`Σ signalᵢ × weightᵢ`), so "training" = fitting a regression and replacing the constants in `SCORING_WEIGHTS`. **The runtime pipeline does not change** — no model is served, no inference, no new latency. The only product artifact is the fitted weight values (and folding `epNextSignal` into the weighted sum).

**Depends on `composite-backtest`** (the dataset + the benchmark harness must exist first).

## What changes
- **`weight-training`** — fit **unconstrained ridge regression, per position** (GK/DEF/MID/FWD), on the Phase 1 dataset (label = next-3-GW realized points). Validate on a time-aware hold-out, re-run the Phase 1 benchmark with the fitted weights, and ship them **only if** they beat the hand-tuned composite and the baselines on held-out data.

## Impact
- Reuses the Phase 1 Python env (`pandas`/`scipy`) + the dataset and benchmark harness.
- The only runtime change: fitted **`SCORING_WEIGHTS`** in `lib/config.ts`, and folding `epNextSignal` into the weighted base sum in `composite-scorer.ts`.

## Out of scope
- Non-linear models (gradient boosting) — only if ridge materially underfits (a later change).
- Points-scale calibration of the output.
- LLM-context signals (not in the dataset; the `llmAdj` term is left as-is).
