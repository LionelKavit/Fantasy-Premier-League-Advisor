# Composite backtest — point-in-time dataset + benchmark (Phase 1)

## Why
The composite score (`lib/pipeline/composite-scorer.ts`) ranks every player the app touches — squad, transfer candidates, captaincy — but its weights (`SCORING_WEIGHTS`) are **hand-tuned and never validated against reality.** Before tuning anything, we need to *measure*: does a higher composite actually predict more FPL points, and does it beat trivial baselines (`ep_next`/`xP`, `points_per_game`)?

This change (Phase 1) builds the **measurement foundation**: a point-in-time labeled dataset from the vaastav historical archive (reusing the app's own signal code for train/serve parity) and a benchmark harness that scores the current composite against baselines. It answers "is the composite even reliable?" and produces the dataset the weight-fitting phase will train on.

**Phase 2 — fitting/optimizing the weights via ridge regression — is a separate change (`composite-weight-training`) that depends on this one.** Splitting lets us land the "is it broken?" answer and the dataset before building the fitter.

## What changes
- **`backtest-dataset`** — an offline pipeline that ingests targeted vaastav files (specifics to be supplied by the project owner), reconstructs point-in-time inputs, runs the app's real signal functions to emit feature rows, and attaches the **realized next-3-GW points** label. **`xP` is included** as a feature/baseline (data-engineering for it directed by the owner).
- **`composite-evaluation`** — the benchmark harness: rank-correlation (within position) + decision metrics (captain hit-rate, transfer realized gain, top-K precision), always vs baselines (`xP`/`ep_next`, `ppg`, current composite), + per-signal ablation. Emits a committed report.

## Impact
- Adds **offline tooling only** — not part of the deployed app runtime; nothing in `lib/`/`app/` changes.
- New external data dependency: the **vaastav archive** (specific files/seasons pending the owner's data-engineering instructions).
- Tooling split (decided): **TS dataset builder** (reuses real signal code → parity) + **Python (`pandas`/`scipy`) eval/analysis**.

## Out of scope (→ separate changes)
- **Weight fitting/optimization** → `composite-weight-training` (Phase 2, depends on this dataset).
- LLM-prose answer quality (groundedness / golden scenarios).
- Non-linear models; `NORMALIZATION_BOUNDS` re-derivation.
