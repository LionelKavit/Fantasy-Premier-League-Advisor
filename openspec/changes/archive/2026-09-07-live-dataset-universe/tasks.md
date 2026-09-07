## 1. Universe dump

- [x] 1.1 `research/squad-eval/capture.ts`: compute `maxEpNext` as the pipeline does (max `epNext` over `boot.players`, floor 1); score every `boot.players` entry with `scorePlayerLite({ fixtures, teams, currentGw: analysis.currentGw, maxEpNext })`; write rows via `poolRow()` to `plan.universeFile` (`gwNN.universe.csv` or `gwNN.universe.post-deadline.csv`).
- [x] 1.2 `research/squad-eval/live-types.ts`: `planCaptureWrite` returns `universeFile` alongside `poolFile`; `LiveCaptureRecord.pool` gains `universeFile` and `universeRows`. Extend `capture-guard.test.ts` for the new field in every case.
- [x] 1.3 Console summary prints the universe row count and file.

## 2. Builder

- [x] 2.1 `research/squad-eval/score-live.ts`: factor the label join into `buildLabelled(files) → rows`; call it for `^gw\d+\.universe\.csv$` → `live-dataset.csv` and for `^gw\d+\.csv$` → `live-pool-dataset.csv`; both drop `post_deadline=1` and ignore `*.post-deadline.csv`.
- [x] 2.2 Report per-output row counts, complete-label counts, dropped rows, ignored sidecars; state `GWn: universe unavailable — captured before live-dataset-universe` for pool files without a universe sibling.
- [x] 2.3 Assert no duplicate `(element, gw)` in either output; fail loudly if found.

## 3. Parquet

- [x] 3.1 `research/composite-backtest/to_parquet.py`: accept an absolute/relative CSV path; write `.parquet` beside it; default behaviour unchanged.

## 4. Verify

- [x] 4.1 Run `capture.ts` (GW4 window open until 2026-09-12 12:30Z): `pool/gw04.universe.csv` has one row per bootstrap player, all `fidelity=lite`, `post_deadline=0`; spot-check three players' `sm_epNextSignal` against `ep_next / max(ep_next)` from the same bootstrap.
- [x] 4.2 Run `score-live.ts`: `live-dataset.csv` (universe) and `live-pool-dataset.csv` (55 rows) written; no duplicate `(element, gw)`; legacy notice absent for GW4 once the universe file exists.
- [x] 4.3 `python3 research/composite-backtest/to_parquet.py research/squad-eval/live-dataset.csv` → Parquet loads in pandas with numeric `sm_*` columns; `fit.py`'s feature columns all present.
- [x] 4.4 Research harness typechecks (scratch research tsconfig); `vitest` green (guard tests extended); app `tsc`/`eslint` unaffected.
- [x] 4.5 As-built note; archive via `/opsx:archive`.

> **As-built (2026-09-06):** `capture.ts` scores every bootstrap player with `scorePlayerLite` (pool-max `ep_next` normalisation recomputed as `lib/pipeline/index.ts` does) into `plan.universeFile`; `planCaptureWrite` returns `universeFile` (sidecar `gwNN.universe.post-deadline.csv` when late; 7 guard tests extended); the record's `pool` carries `universeFile`/`universeRows`. `score-live.ts` builds `live-dataset.csv` from `gwNN.universe.csv` and `live-pool-dataset.csv` from `gwNN.csv` through one shared label-join, drops `post_deadline=1`, ignores sidecars, throws on a duplicate `(element, gw)`, and names pool files with no universe sibling. `to_parquet.py` takes a path (default behaviour verified on `dataset_2025-26.csv`). Verified on a fresh GW4 capture (2026-09-06, window open to 09-12 12:30Z): **654 universe rows** = bootstrap player count, all `fidelity=lite`, `post_deadline=0`, 15 `in_squad`; six spot-checks of `sm_epNextSignal` vs `ep_next / max(ep_next)` from the same bootstrap: 0 mismatches. Builder: 654 + 55 rows, 0 duplicates, labels pending. Parquet loads; all 15 `fit.py` feature columns present and numeric; eligibility filter applies unchanged. Gate: `tsc` clean (app + research), `eslint` 0 errors, `vitest` 351/351. **Honest number:** at GW4 only 79 universe rows clear the 270-minute gate (DEF 40, GK 18, MID 17, FWD 4) — the ~400/week estimate holds only once regulars pass three full matches (≈ GW6+); the first fit that clears the 200-row floors stays ≈ GW9–10. GW1–GW3 universe rows are `unavailable` (no point-in-time `ep_next` exists for them).
