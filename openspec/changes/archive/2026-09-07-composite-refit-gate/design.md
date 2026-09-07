# Design — composite refit gate

## Context

`fit.py` fits per-position ridge coefficients on `sm_*` + `sm_epNextSignal` + `ppg` with a season-level holdout, then derives the squash from the training raw-score distribution (`center` = median, `scale` = (q90 − q10)/4) and writes `out/weights.json`. `benchmark.py` provides `per_group_metrics` (within-position Spearman, top-K precision). The live dataset arrives one gameweek at a time with labels complete three gameweeks later. The runtime reads `SCORING_WEIGHTS` and `COMPOSITE_SQUASH` from `lib/config.ts`.

The June headline is the constraint on ambition: fitted composite 0.567 vs raw `ep_next` 0.613 on held-out 2024-25. A refit is expected to move the composite a few hundredths, not to beat `ep_next`.

## Goals / Non-Goals

**Goals:**
- A drift report the operator can read weekly, produced with zero judgment calls.
- A refit that is honest about sample size and time ordering, and recalibrates the squash with the weights.
- Ship criteria that are fixed text in the spec, evaluated mechanically, and cannot be relaxed by the loop.
- Shipping = a branch + a drafted PR + a human merge. No path from the loop to `main`.
- Exactly one model-judgment step (the PR narrative), with a deterministic fallback.

**Non-Goals:**
- Beating `ep_next`. The report shows the gap; the gate does not require closing it.
- Refitting the decision layer (captain ceiling, transfer bar, τ). Those stay on the 37-row-per-season eval and a quarterly human review (new-season-readiness Tasks 3–4 as written).
- Auto-merge, auto-deploy, or editing `lib/scoring-weights.json` on `main`.

## Decisions

**D1 — Rolling holdout = last three labelled gameweeks; train = everything earlier.** Time-aware, no leakage, and the holdout window slides forward each week so "two consecutive passes" (D4) are on different holdouts. Minimum sizes (per position): 200 train rows and 100 holdout rows, else the position is `insufficient` and the gate cannot pass. *Alternative rejected:* fixed frozen holdout gameweeks — too few rows early in the season, and the fixed set would become a de facto test set the loop trains toward.

**D2 — Shipped baseline = the dataset's own `composite` column.** Universe rows carry the lite composite computed by the shipped weights at capture time. Comparing the candidate to that column is exact and needs no re-implementation of the runtime in Python.

**D3 — The squash is refit with the weights, by the same rule `fit.py` uses.** Saturation is a calibration failure, not a weight failure; shipping weights without the squash would leave it. The drift report tracks saturation (share of composite ≥ 0.98) so the operator sees it move.

**D4 — Pre-registered ship criteria (normative in the spec, restated here):**
1. All four positions fitted with ≥ 200 train and ≥ 100 holdout rows.
2. Candidate held-out within-position Spearman ≥ shipped composite Spearman + **0.02**, pooled across positions (row-weighted).
3. Criterion 2 holds on **two consecutive** scoring runs (different holdout windows).
4. No coefficient with shipped |weight| ≥ 1.0 changes sign.
5. Candidate held-out Spearman ≥ 0.9 × raw `ep_next` Spearman on the same rows (a sanity floor: a refit that falls far below `ep_next` indicates a data problem, not a model improvement).
The tick stores the pass streak in state. The numbers are not configurable by the tick.

**D5 — Weights as JSON, config imports it.** `lib/scoring-weights.json` = `{ SCORING_WEIGHTS, COMPOSITE_SQUASH }`, imported in `config.ts` with `resolveJsonModule` (already on for Next). The refit branch writes this one file. Verified behaviour-identical by the replay diff and the `vitest` suite at migration time.

**D6 — Counterfactual is a rescoring, not a re-decision.** `scripts/rescore-counterfactual.ts` imports the scorer with an injected `{weights, squash}` (new optional last parameter on `computeCompositeScore`; default = shipped), rescoring the latest full-tier pool rows and the latest universe rows, and emits the top-10 per position before/after with rank deltas and the saturation count. The captain/transfer logs are not rescored: their decisions are ep-gated; the report says so.

**D7 — Branch mechanics.** From the main checkout: `git fetch`, `git worktree add .worktrees/refit refit/gw<NN>-<date> origin/main` (never checking out in the working tree), write `lib/scoring-weights.json` + reports under `research/composite-backtest/out/refit-gw<NN>/`, commit, push, remove the worktree. Failure at any point leaves `main` and the working tree untouched.

**D8 — The single judgment step.** `claude -p` (CLI present) with `scripts/refit-pr-prompt.md` and the report paths as input, `--allowedTools` restricted to reading those files, output captured to `refit-pr-body.md` and committed to the branch. Timeout 5 min; on failure or malformed output the deterministic body (headline metrics + criteria table + counterfactual top-10 deltas) is used. The agent cannot run the fit, change criteria, or push. *Alternative rejected:* letting the agent decide whether to open the PR — that is the gate's job and it is mechanical.

**D9 — Delivery.** If `gh` is on PATH and `gh auth status` succeeds: `gh pr create --draft` with the body. Else: email (Resend) with the compare URL and the body. Either way a human merges.

## Risks / Trade-offs

- [The gate passes on noise early in the season] → sample floors, two consecutive passes on sliding holdouts, and the `ep_next` sanity floor. Expected first eligible evaluation ≈ GW9–10 with the universe dump; first possible pass ≈ GW11.
- [Refit converges on `ep_next` and shrinks other weights toward zero] → that is a legitimate finding; the report shows it; the gate still requires a +0.02 improvement over the shipped composite, which "copy ep_next" would satisfy only if it genuinely ranks better on held-out rows.
- [Weights-as-JSON changes the build] → `resolveJsonModule` is already enabled by Next's tsconfig; verified by `tsc` and the replay diff at migration.
- [Claude CLI not authenticated under launchd] → deterministic fallback body; the alert names the fallback.
- [`gh` absent] → email path is the default; installing `gh` is an optional operator step.

## Migration Plan

1. Land D5 (weights → JSON) first, alone, with byte-identical replays and green tests. Rollback: revert.
2. Land the Python fit/drift + gate + counterfactual + branch mechanics. They produce files and branches only.
3. Wire the hand-off in `live-eval-tick.ts`.

## Open Questions

- Criterion 2's margin (0.02) and the sanity floor (0.9 × `ep_next`) are stated values; they are pre-registered here and changed only by a new OpenSpec change, never by the loop. Kavit owns them.
- Whether `gh` gets installed (optional; default path is email).
