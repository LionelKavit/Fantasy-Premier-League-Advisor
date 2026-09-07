# Composite refit gate — monitored weekly, refit on live data, shipped only through a pre-registered gate and a human merge

## Why

The shipped composite weights and logistic squash were fitted in June 2026 on the historical archive without real `ep_next`; the live universe dataset (`live-dataset-universe`) is the first data on which an honest refit is possible. But a loop that refits and ships on its own is the wrong shape: the fit's objective converges on copying `ep_next`, the data arrives at one decision point per gameweek, and shipped logic, learning, and test sets each keep a human gate under the project's working rules. What is wanted is a **continuously monitored** model: a deterministic drift report every scoring run, a refit that recalibrates the squash too, ship criteria written down before any fit runs, and a single judgment step that drafts a pull request when — and only when — the criteria pass. Today the squash already shows why this matters: six players sit between 0.993 and 0.997 composite, compressing the ranking exactly where it counts.

## What Changes

- **`fit_live.py`** (in `research/composite-backtest/`), reusing `fit.py`'s per-position ridge, alpha grid, feature list, and squash calibration, on `live-dataset.parquet` with a **rolling time-aware holdout**: train = labelled gameweeks except the last three, holdout = the last three labelled gameweeks. Emits `out/live-fit.json`, `out/live-weights-candidate.json` (weights + `_squash`), and `out/live-fit.md`.
- **`live-drift.md`** every scoring run: rolling Spearman (within position) of the shipped composite (the `composite` column), the candidate, and raw `ep_next` on the last three labelled gameweeks; squash saturation (share of rows with composite ≥ 0.98); projected-Δep vs realized transfer scatter summary (from the live transfer report); top-K precision per the backtest's benchmark.
- **Pre-registered ship criteria** (fixed in the spec; the tick evaluates them, never edits them): sample floors per position, a fixed held-out margin over the shipped composite, two consecutive passes, no sign flips on material coefficients, and all four positions fitted.
- **Weights become data.** `SCORING_WEIGHTS` and `COMPOSITE_SQUASH` move from literals in `lib/config.ts` to `lib/scoring-weights.json` imported by `config.ts` — behaviour-identical (values copied verbatim; replays byte-identical) — so a refit is a JSON write, not a code edit.
- **Refit branch, never main.** When the gate passes, the tick creates `refit/gw<NN>-<date>` from `main` with the candidate JSON, the fit and drift reports, and a **counterfactual**: the full-tier pool rows and the universe rows rescored under the candidate, with the top-10 per position before/after. It pushes the branch. The captain/transfer live logs are not rescored (their decisions are ep-gated, not composite-gated; stated in the report as `unavailable — decision layer is ep-denominated`).
- **One agent, one job.** With the branch pushed, the tick invokes the local Claude Code CLI non-interactively with a fixed prompt to draft the pull-request body (summary, anomalies, recommendation) into the branch; on any failure a deterministic body is used. If `gh` is installed and authenticated the tick opens a **draft** PR; otherwise it emails the compare URL and the body. A human merges. Nothing in this change can modify `main`.

## Capabilities

### New Capabilities
- `composite-refit-gate`: weekly deterministic drift monitoring; a live-data refit with recalibrated squash; pre-registered ship criteria; a refit branch with counterfactual and drafted PR body; human merge as the only path to production.

### Modified Capabilities
<!-- None under openspec/specs/. Automates new-season-readiness Task 4 (calibration freshness); that task's checkbox is closed by this change's as-built note. -->

## Impact

- New: `research/composite-backtest/fit_live.py`, `drift_live.py`, `scripts/refit-gate.ts` (criteria evaluation, branch creation, counterfactual via a TS rescoring script, PR body, notifications), `lib/scoring-weights.json`, `scripts/refit-pr-prompt.md`.
- Modified: `lib/config.ts` (imports the JSON; values identical), `lib/pipeline/composite-scorer.ts` (optional weights/squash injection parameter for the counterfactual; default unchanged), `scripts/live-eval-tick.ts` (hand-off from `live-eval-automation`).
- Toolchain: Python with pandas/scikit-learn/pyarrow (present at `/opt/anaconda3`), Claude Code CLI (present, 2.1.216), `gh` (absent on 2026-09-06 — draft-PR creation is optional; the email fallback is the default path).
