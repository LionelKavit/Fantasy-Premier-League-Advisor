## Tasks (Phase 1 — dataset + benchmark)

> Offline tooling; nothing in the deployed runtime changes. Phase 2 (ridge fit) is the separate `composite-weight-training` change, which depends on the dataset built here.
>
> **Data is already cloned** at `historical_data/` (gitignored). **Seasons (decided): all of them — `historical_data/data/2016-17` … `2025-26`** (all files in each season subfolder).

### Task 1: Vaastav data ingest (all 10 seasons)
**Capability:** backtest-dataset
- Read from the local clone `historical_data/data/{2016-17 … 2025-26}` — `gws/gw{N}.csv` (per-GW stats), `fixtures.csv`, `teams.csv`, `players_raw.csv` (set-piece order / season reference), `understat/` (optional enrichment). Establish player-id (`element`) continuity per season.
- `xP` lives as the `xP` column in `gws/gw{N}.csv` (identical to `gws/xP{N}.csv`) — use the gw column.
- **Feature availability varies by era** (`value`/`selected` 2019-20+, `xP` 2021-22+, per-GW `expected_*` ~2022-23+, `starts` 2024-25+, DC fields 2025-26 only). Include **all** seasons: older seasons still contribute the always-available core signals (goals/assists/minutes/bonus/ICT) as extra training volume; richer features are simply **NaN-tagged where unavailable** (never fabricated), with a per-feature × per-season availability map recorded.

### Task 2: Per-season xP integrity gate
**Capability:** backtest-dataset
- Run the surprise-blank diagnostic across all GWs of each season (nailed GW N−1 starters who blanked GW N → is their `xP` still positive on average?). Record a per-season pre-deadline/contaminated verdict in the report.
- Clean seasons → use raw `xP` untouched. Failing seasons → exclude `xP` (never shift clean data; `shift(1)` only as a flagged salvage experiment). Pooled use includes only clean-`xP` seasons for the `xP` feature.

### Task 3: Point-in-time dataset builder (TS, real signal code)
**Capability:** backtest-dataset
- For each (player, GW, season): reconstruct pre-GW inputs (**roll up prior GWs** — gw rows are realized/post-match, so features come from gw1…gw(N−1), not GW N's own row), plus join **target-GW fixture/opponent context** (FDR, home/away, opponent strength, n_fixtures) from `fixtures`/`teams`.
- **Tier-1 (core/parity):** run the app's own `computeStatisticalSignals` / `computeFixtureSignals` / `computeMarketSignals` / `computeTrendSignals` (incl. `epNextSignal` from gated `xP`, and `ppg`).
- **Tier-2 (candidate, tagged distinctly):** the four tracked gaps + other candidates — DC threshold probability (2025-26), own-team attacking strength, fixture congestion/rest-days from `kickoff_time`, deterministic set-piece (`penalties_order`) + availability (`chance_of_playing_next_round`); plus rolling xG90/xA90, finishing over/under-performance, rolling bps90, transfer momentum, understat metrics. **Not shippable as weights** (evaluated only).
- Attach the **next-3-GW realized points** label (+ raw next-GW pts). Apply low-minute filter; flag DGW/BGW. **Guarantee no lookahead.**
- **Output: one long-format file** (Parquet preferred) — one row per (season × GW × player); identifier cols (season, GW, element, position, name) carried but not features; features tagged Tier-1/Tier-2 + season-availability. Per-position fitting filters on `position` at fit time (not separate files). This file is the Phase 2 input.

### Task 4: Benchmark harness + report (Python)
**Capability:** composite-evaluation
- Metrics: Spearman rank-corr (**within position**) + top-K precision within position. (Captain hit-rate / transfer realized gain → `squad-eval` change; not feasible on this player-universe dataset.)
- Benchmark the **current** composite vs `xP`/`ep_next` and `ppg`; per-signal ablation (incl. Tier-2 candidates' feature-importance).
- Write the committed report (markdown + JSON): per position, model vs baselines, per-season `xP` gate verdicts, coverage / low-minute / DGW notes.

### Verify
- [x] Offline code (`research/`, `historical_data/`) excluded from `tsconfig`/`eslint`; app gate clean — `tsc` ok, `eslint` 0 errors, `next build` ok, `vitest` **181** pass (runtime untouched).
- [x] **Availability honesty** — features NaN/0 where the season lacks the source column; per-season availability flags (`has_xP`/`has_xg`/`has_dc`) emitted.
- [x] **No-lookahead** — `build-dataset.test.ts` asserts `season_minutes` uses only rounds < N and the label sums exactly N…N+2 (in vitest).
- [x] **Metric-computation unit tests** — `test_benchmark.py` asserts Spearman/top-K on perfect/reversed/too-small toy inputs.

#### As-built (run 2026-06-18, all 10 seasons → 215,543 rows; 96,531 eligible)
- **Implemented:** `csv.ts`, `load.ts`, `build-dataset.ts` (TS, reuses real signal code), `tier2.ts`, `xp_gate.py`, `benchmark.py`, `to_parquet.py`, `README.md` + tests. Generated `out/` is gitignored.
- **Headline:** current composite **Spearman 0.31 / top-5 0.18** vs **xP 0.62 / 0.32** and ppg 0.34 — the hand-tuned composite **does not beat FPL's own xP** (holds on gate-clean seasons). Strong mandate for Phase 2 (fold `ep_next` in).
- **xP gate:** 2020-21…2024-25 = pre-deadline (clean); **2025-26 = contaminated** (mean surprise-blank xP 0.46, 76% zeroed) → excluded from the xP benchmark.
- **Tier-2 features emitted** (`tier2.ts`, 8 columns, verified sane): DC threshold prob (2025-26), own-team attack strength, congestion (days-since-last / matches-in-7d), penalty-taker, rolling xG90 / finishing / bps90 — tagged distinct, evaluated-only (not shippable weights).
- **Parquet:** `to_parquet.py` (CSV is canonical/inspectable; Parquet derived); benchmark prefers Parquet.
- **Tests:** `build-dataset.test.ts` (3 no-lookahead/label assertions, in vitest → 184 app tests pass) + `test_benchmark.py` (3 metric assertions). App gate clean: tsc / eslint 0 errors / next build (`research/` + `historical_data/` excluded).
- **Moved out → `squad-eval` change:** captain hit-rate / transfer realized gain (need a manager-squad simulation, not this player-universe dataset).
- **Audit finding (fixed):** pre-2020-21 gw files have no `team` column → `teamId` unresolved → fixture signals were silently 0 for 2016-17…2019-20. Added a **`has_fixture`** flag (0 for those seasons, 1 for 2020-21+); the headline uses fixture-complete + gate-clean seasons, so it's unaffected. Phase 2 must filter `has_fixture==1` before fitting the fixture weight. Known limitation: deriving `teamId` from `opponent_team` to recover old-season fixtures is a possible future improvement (those seasons also lack xP/xg).
