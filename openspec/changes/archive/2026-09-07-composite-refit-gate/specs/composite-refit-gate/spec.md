## ADDED Requirements

### Requirement: Composite weights are data the runtime imports
`SCORING_WEIGHTS` and `COMPOSITE_SQUASH` SHALL be defined in `lib/scoring-weights.json` and imported by `lib/config.ts`, with values identical to the current literals.

#### Scenario: Behaviour-identical migration
- **WHEN** the weights move to JSON
- **THEN** `research/squad-eval/replay.ts` and `transfer-replay.ts` re-run byte-identical to their committed reports, and `vitest` passes

### Requirement: A drift report is produced on every scoring run
After each scoring run with at least one labelled gameweek, the system SHALL write `research/composite-backtest/out/live-drift.md` containing, for the last three labelled gameweeks: within-position Spearman and top-K precision of the shipped composite (the dataset's `composite` column), the current candidate (if any), and raw `ep_next`; the saturation share (rows with composite ≥ 0.98); and the projected-Δep vs realized next-1 summary from the live transfer report.

#### Scenario: Report with no candidate yet
- **WHEN** fewer than the sample floors exist for any position
- **THEN** the drift report still shows shipped vs `ep_next` and marks the candidate columns `insufficient (n=<rows>)` per position

### Requirement: The live fit uses a rolling time-aware holdout and recalibrates the squash
`fit_live.py` SHALL train per-position ridge models on all labelled gameweeks except the last three and evaluate on those three, using `fit.py`'s feature list and alpha grid, SHALL derive `center`/`scale` from the training raw-score distribution by `fit.py`'s rule, and SHALL write `live-fit.json`, `live-weights-candidate.json`, and `live-fit.md`.

#### Scenario: Holdout slides
- **WHEN** the fit runs after gameweek N is labelled and again after N+1
- **THEN** the holdout windows are `{N−2..N}` and `{N−1..N+1}` respectively

#### Scenario: Position below floor
- **WHEN** a position has fewer than 200 training or 100 holdout rows
- **THEN** that position is reported `insufficient` with its counts and no candidate weights are emitted for it

### Requirement: Ship criteria are pre-registered and evaluated mechanically
The gate SHALL pass only when all of the following hold, and the tick SHALL NOT be able to alter these values:
1. all four positions fitted with ≥ 200 training and ≥ 100 holdout rows;
2. candidate held-out within-position Spearman, row-weighted across positions, ≥ shipped composite Spearman + 0.02;
3. criterion 2 held on the immediately preceding scoring run as well (two consecutive, on different holdout windows);
4. no coefficient whose shipped |weight| ≥ 1.0 changes sign;
5. candidate held-out Spearman ≥ 0.9 × raw `ep_next` Spearman on the same rows.

#### Scenario: Single pass is not enough
- **WHEN** criteria 1, 2, 4, 5 hold for the first time
- **THEN** the gate records a streak of 1, does not create a branch, and the drift report shows `gate: 1/2 consecutive`

#### Scenario: Gate passes
- **WHEN** all five criteria hold
- **THEN** the gate records the pass, creates the refit branch, and resets the streak after the branch is pushed

#### Scenario: Sign flip blocks
- **WHEN** a coefficient with shipped |weight| ≥ 1.0 has the opposite sign in the candidate
- **THEN** the gate fails with the coefficient named, regardless of the other criteria

### Requirement: A passing gate yields a refit branch, never a change to main
On a pass, the system SHALL create `refit/gw<NN>-<YYYY-MM-DD>` from `origin/main` in a temporary worktree, commit `lib/scoring-weights.json` (candidate), the fit and drift reports, a counterfactual report, and a PR body, push the branch, and remove the worktree. `main` and the working checkout SHALL be unchanged.

#### Scenario: Branch contents
- **WHEN** the branch is pushed
- **THEN** it differs from `origin/main` only in `lib/scoring-weights.json` and files under `research/composite-backtest/out/refit-gw<NN>/`

#### Scenario: Failure leaves no trace
- **WHEN** any step of branch creation fails
- **THEN** no partial branch is pushed, the temporary worktree is removed, and the failure is alerted

### Requirement: The counterfactual is a rescoring, not a re-decision
The counterfactual report SHALL rescore the latest full-tier pool rows and the latest universe rows under the candidate weights and squash, listing the top-10 per position before and after with rank deltas and the saturation count, and SHALL state that captain and transfer decisions are not rescored because they are ep-denominated.

#### Scenario: Injection does not affect production
- **WHEN** `computeCompositeScore` is called without the optional weights parameter
- **THEN** it uses the shipped JSON values and its output is unchanged

### Requirement: One judgment step drafts the PR body, with a deterministic fallback
The system SHALL invoke the Claude Code CLI non-interactively with a fixed prompt and read-only access to the reports to produce the PR body; on failure, timeout, or malformed output it SHALL use a deterministic body built from the same reports. The agent SHALL NOT be able to run the fit, alter criteria, or push.

#### Scenario: CLI unavailable under the scheduler
- **WHEN** the CLI is missing or unauthenticated
- **THEN** the deterministic body is committed and the notification states `narrative: fallback`

### Requirement: Delivery ends at a human
If `gh` is installed and authenticated the system SHALL open a draft pull request with the body; otherwise it SHALL email the compare URL and the body. Merging SHALL be a human action.

#### Scenario: No gh
- **WHEN** `gh` is not on PATH
- **THEN** an email is sent with the compare URL and the body, and no PR is opened
