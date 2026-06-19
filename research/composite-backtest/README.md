# composite-backtest (Phase 1)

Offline tooling that benchmarks the app's composite score against realized FPL
points and FPL's own `xP`/`ppg`. **Not part of the deployed app** (excluded from
the Next build / tsc / eslint). Reads the cloned `historical_data/` archive.

## Run
```bash
# 1. Build the point-in-time labeled dataset (all 10 seasons → out/dataset.csv)
npx tsx research/composite-backtest/build-dataset.ts
#    (or a single season: npx tsx research/composite-backtest/build-dataset.ts 2024-25)

# 2. Per-season xP integrity gate (Task 2) → out/xp_gate.json
python3 research/composite-backtest/xp_gate.py

# 3. Benchmark (rank-corr within position + top-K precision) → out/benchmark.{md,json}
python3 research/composite-backtest/benchmark.py

# 4. (Phase 2 — composite-weight-training) per-position ridge fit → out/fit.{md,json}
python3 research/composite-backtest/fit.py
```

## Phase 2 fit result (composite-weight-training, 2026-06-18)
Held-out 2024-25: **fitted 0.567** Spearman vs hand-tuned composite **0.33**, ppg 0.35, **xP 0.613**.
The data-driven refit ~doubles the hand-tuned composite but **doesn't beat raw xP**; `epNextSignal`
dominates the fit (~40× other signals). Report-only (no weight ship) — see the change's tasks.

## Files
- `csv.ts` / `load.ts` — CSV + vaastav season loader.
- `build-dataset.ts` — point-in-time rebuild (rolls up prior GWs), runs the app's
  real signal code (`computeStatisticalSignals/Fixture/Trend` + `computeCompositeScore`),
  emits one long-format CSV. Market signals are neutral (they don't feed the composite).
- `xp_gate.py` — surprise-blank diagnostic; flags per-season xP as pre-deadline vs contaminated.
- `benchmark.py` — scores `composite` vs `xP`/`ppg`; xP credited only on gate-clean seasons.
- `out/` — generated dataset + reports (gitignored).

## Headline finding (run 2026-06-18, all seasons)
| predictor | Spearman (within position) | top-5 precision |
|---|---|---|
| **composite (current)** | **0.31** | 0.18 |
| **xP (FPL's own, gate-clean seasons)** | **0.62** | 0.32 |
| ppg | 0.34 | 0.20 |

**The hand-tuned composite does not beat FPL's own `xP` — it's ~2× worse at
ranking and barely matches raw `ppg`.** This holds even after restricting xP to
gate-clean seasons (so it's not a contamination artifact). ⇒ strongly motivates
folding `ep_next` into the composite (Phase 2, `composite-weight-training`).

## xP integrity gate verdicts
- **Clean (pre-deadline):** 2020-21 … 2024-25 (mean surprise-blank xP 1.0–1.6).
- **Contaminated:** **2025-26** (mean 0.46, 76% of surprise-blanks zeroed) — the
  in-progress season's archived xP is post-match; excluded from the xP benchmark.
- 2016-17 … 2019-20: no `xP` column.

## Faithfulness & availability (audit, 2026-06-18)
- **Fixture signals are only reconstructable for 2020-21 → 2025-26.** Pre-2020-21 gw
  files have **no `team` column** (it was added in 2020-21), so `teamId` can't resolve
  and `fdrScore`/`opponentStrength` are 0 for 2016-17…2019-20. These rows are tagged
  **`has_fixture=0`** — Phase 2 must filter on it before fitting the fixture weight, and
  the benchmark headline uses fixture-complete (and gate-clean) seasons only.
- **Availability convention:** features are emitted as **0 (not NaN) where the source is
  absent**, gated by `has_fixture` / `has_xP` / `has_xg` / `has_dc` flags. Consumers
  (benchmark, Phase 2 fit) must filter on those flags rather than treat 0 as real.
- Set-piece duties + `chance_of_playing` are approximate/absent historically (tracked
  Tier-2 gaps). Market (ownership/transfer) signals are neutral — excluded from the
  composite total anyway. Tier-2 candidate features (`tier2.ts`) are emitted for
  evaluation only (not shippable weights).
