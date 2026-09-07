# Design — live dataset universe

## Context

`capture.ts` already writes `pool/gwNN.csv` (55 full-tier rows) via `poolRow()`, and `score-live.ts` joins labels into `live-dataset.csv`. `scorePlayerLite` is the single lite-tier scorer; `fidelity` labels every row; the deadline guard routes post-deadline artefacts to sidecars. `fit.py` reads `sm_*` + `sm_epNextSignal` + `ppg` and filters on `low_minute == 0`, `label_gws == 3`, `has_fixture == 1`, `has_xg == 1`.

The runtime normalises `epNextSignal` as `epNext / maxEpNext` where `maxEpNext` is the max over **all** bootstrap players (`lib/pipeline/index.ts`). The universe dump must use the same denominator so `sm_epNextSignal` is on the runtime's scale.

## Goals / Non-Goals

**Goals:**
- One lite-tier row per bootstrap player per capture, with the runtime's normalisation, in the backtest schema.
- Labels joined by the same code path as the pool rows; the fit reads one file.
- The guard's quarantine applies unchanged.
- Zero extra network or LLM cost (bootstrap and fixtures are already fetched; the scorer is pure).

**Non-Goals:**
- Full-tier scoring of the universe (LLM cost for 650 players; the fit does not use those signals).
- Changing the fit's eligibility rules (Change C owns the fit).
- Back-filling GW1–GW4 universe rows (no point-in-time `ep_next` exists for them — `unavailable`).

## Decisions

**D1 — Separate file per tier, not a merged file.** `gwNN.csv` (full, 55) and `gwNN.universe.csv` (lite, ~650) overlap on the 55 players; merging would put two rows per element per gameweek into one file and force every consumer to filter on `fidelity`. Two files, two datasets, each with one row per element per gameweek. *Alternative rejected:* universe-only with a `full` overlay column — loses the full-tier composite for the 55 rows the decision-layer analysis wants.

**D2 — Score from `bootstrap.players` with `scorePlayerLite`, inputs `{fixtures, teams, currentGw: analysis.currentGw, maxEpNext}`.** `maxEpNext` is recomputed exactly as the pipeline does (max `epNext` over all players, floor 1). Trend and LLM neutral by construction — the same construction as the backtest.

**D3 — Keep every player, flag rather than filter.** Unavailable/injured players and zero-minute players stay in the file with their `availability` and `low_minute` values; the fit filters. This keeps the dataset honest about the pool the model saw and lets later analyses (e.g. availability leakage) use the rows.

**D4 — `in_squad` stays manager-relative.** The column marks the 15 squad players in the universe file too; it is descriptive, not a feature.

**D5 — The builder writes two outputs.** `live-dataset.csv` ← `gwNN.universe.csv` files; `live-pool-dataset.csv` ← `gwNN.csv` files. Label-join logic is shared (one function, two inputs). The pool dataset keeps its name in the log record; the record's `pool` field gains `universeFile` and `universeRows`.

**D6 — Parquet is derived by the tick, not by TS.** `to_parquet.py <path>` (path argument, default unchanged) writes `<path>.parquet` next to the CSV; the Python fit reads Parquet as it does for the archive. Keeps the TS side dependency-free.

## Risks / Trade-offs

- [The 55 full-tier rows and the universe lite rows disagree on `composite` for the same player] → expected (trend + LLM adjustments); they live in different datasets and the `fidelity` column says why. Documented in the file headers' generating code.
- [File growth] → ≈ 7 MB/season; committed to the data branch (Change B), never to code branches.
- [A future change scores the universe at full tier "for consistency"] → the proposal states the cost and that the fit does not consume those signals; the `fidelity` column makes any such change visible in the data.

## Migration Plan

Additive. Existing `gw04.csv` and `live-dataset.csv` semantics change only in that `live-dataset.csv` becomes universe-sourced; the current 55-row content moves to `live-pool-dataset.csv` on the next builder run. Rollback is a revert.

## Open Questions

- None blocking.
