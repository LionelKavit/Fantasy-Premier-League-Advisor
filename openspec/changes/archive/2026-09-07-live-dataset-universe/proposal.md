# Live dataset — dump the full player universe at lite tier every capture

## Why

The composite refit needs point-in-time rows with **real `ep_next`**, which the historical archive never had. Today each capture dumps 55 rows (15 squad + 40 candidates) at full tier. After the 270-minute eligibility gate and the three-gameweek label lag, that yields roughly 14 rows per position per gameweek, so the fit's own 200-row-per-position floor is not reached until about GW22. The fit consumes only the deterministic signal-map columns plus `ep_next` and PPG — never trend or LLM signals — so scoring the whole bootstrap universe (~650 players) with the lite scorer costs no LLM calls, produces ~400 eligible rows a week, brings the first admissible refit forward to about GW9, and is the faithful continuation of the backtest dataset, which was itself built with neutral trend and LLM.

## What Changes

- **Universe dump per capture.** `capture.ts` scores every bootstrap player with `scorePlayerLite` (fidelity `lite`, pool-max `ep_next` normalisation identical to the runtime) and writes `pool/gwNN.universe.csv` in the same schema as the existing pool file. The 55-row full-tier `pool/gwNN.csv` is kept as the decision-layer sample.
- **Two datasets from the builder.** `score-live.ts` joins realized labels into `live-dataset.csv` (universe, lite — the fit's input, one row per player per gameweek) and `live-pool-dataset.csv` (full tier, 55/GW — for decision-layer analysis). No element appears twice in either file for a gameweek.
- **Deadline guard extends to the universe file.** A post-deadline capture writes `gwNN.universe.post-deadline.csv`; the builder never ingests it and drops any `post_deadline=1` row.
- **Parquet derivation.** `research/composite-backtest/to_parquet.py` accepts a path so the tick (live-eval-automation) can derive `live-dataset.parquet` for the Python fit.
- **Schema parity.** Column set and semantics match `research/composite-backtest/build-dataset.ts` (`sm_*`, `sm_epNextSignal`, `xP`, `ppg`, `low_minute`, flags) plus the live extras already added (`fidelity`, `post_deadline`, availability, ownership, price).

## Capabilities

### New Capabilities
- `live-dataset-universe`: every capture persists a lite-tier, point-in-time, label-joinable row for every player in the bootstrap, quarantined by the deadline guard, in the backtest schema.

### Modified Capabilities
<!-- None under openspec/specs/. Builds on the archived pool-dump-deadline-guard and scoring-path-consolidation changes. -->

## Impact

- `research/squad-eval/capture.ts`, `score-live.ts`, `live-types.ts` (pool record gains universe file/row counts), `research/composite-backtest/to_parquet.py`.
- Storage: ~650 rows × ~63 columns ≈ 200 KB per gameweek, ≈ 7 MB per season. Committed to the data branch defined in `live-eval-automation`, not to the code branches.
- No app code. Depends on `scoredCandidatePool` staying exposed (it is unused here — the universe is scored directly from `bootstrap.players`).
