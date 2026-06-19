# Design (Phase 2 — weight fitting)

## Context
`composite-backtest` is archived and ran end-to-end. It produced the labeled, point-in-time dataset at **`research/composite-backtest/out/dataset.parquet`** (long-format, one row per season×GW×player, next-3-GW label) and the benchmark. Its **headline result is the mandate for this change**: the current hand-tuned composite scores **Spearman 0.31 / top-5 0.18** versus FPL's own **xP 0.62 / 0.32** (and ppg 0.34) — the composite **does not beat xP**, even on gate-clean seasons. So Phase 2's primary lever is to **incorporate `xP`/`ep_next`** and refit. Runtime is unchanged apart from the weight constants.

## Key decisions

### 0. Prerequisite — emit the *normalized signal-map* features (the weights' actual inputs)
The composite is `Σ weightᵢ × normSignalᵢ`, where `normSignalᵢ` are the **position-specific, normalized [0,1] values** built in `composite-scorer.buildSignalMap` (e.g. `goalThreat` normalized against `NORMALIZATION_BOUNDS`, plus position-only keys like `goalAssistSetPiece`, `xgcRate`, `suspensionPenalty`). **The Phase 1 dataset emits the composite *total* + a subset of *raw* components + baselines — NOT the full normalized signal map.** Fitting on raw components would not yield coefficients that map to `SCORING_WEIGHTS`.
- **Therefore Task 0:** extend the Phase 1 dataset builder (`research/composite-backtest/build-dataset.ts`) to emit, per row, the **exact per-position `signalMap` values** the weights multiply (one column per `SCORING_WEIGHTS` key), tagged Tier-1. Then the regression coefficients map 1:1 to the weights.

### 1. Model
- **Unconstrained ridge (L2), per position** (GK/DEF/MID/FWD) on the signal-map features → coefficients = `SCORING_WEIGHTS[position]`. Ridge for collinearity; tune λ on the held-out split. Python (`scikit-learn`).

### 2. Label, features & data hygiene
- Label = **next-3-GW realized points** (`next3_points`, rows with `label_gws==3`).
- Features = the normalized **Tier-1** signal map **+ `epNextSignal` (from xP) + `ppg`**. LLM-context signals are absent (the `llmAdj` term stays untouched).
- **Respect the availability flags** (from the Phase 1 audit): fit each feature only on rows where its flag is set — **`has_fixture==1`** for the fixture weight, `has_xg==1` for xG-derived signals, **`has_xP==1` AND gate-clean season** for the `xP`/`epNext` feature (exclude contaminated 2025-26 xP). Exclude `low_minute==1` rows.
- **Tier-2 candidate features** are assessed (feature-importance) but **do not ship** as weights — a winner needs a follow-up runtime change first.

### 3. Validation
- **Time-aware split** — train on earlier seasons/GWs, hold out a later season (or walk-forward CV). No random shuffle. Report train vs held-out; pick λ by held-out.

### 4. Ship criteria
- Re-run the Phase 1 benchmark (**Spearman rank-corr within position + top-K precision** — captain hit-rate / transfer gain live in `squad-eval`, not here) with the fitted weights.
- **Ship only if** fitted beats both the hand-tuned composite **and** the baselines (`xP`/`ppg`) on **held-out** data. Else keep current weights; ship findings/report only. (Given Phase 1, beating raw xP is a high bar — folding xP in is expected to be the deciding factor.)

### 5. Runtime integration (only if it wins)
- Update `SCORING_WEIGHTS` in `lib/config.ts`; **fold `market.epNextSignal` into the weighted base sum** in `composite-scorer.ts` (give `epNext` a weight per position — it's computed today but excluded from the total).
- `computeCompositeScore` still does `Σ signal × weight` — no model artifact, no inference, no latency.

## Pitfalls
- **Signal-map parity** — Task 0 must emit the *exact* normalized inputs, or coefficients won't map to runtime weights.
- **Overfitting** — ridge + time-aware hold-out + report train vs test.
- **Coefficient → weight mapping** — be explicit about re-scaling and whether the pitch "rating /10" display needs a display-only rescale once weights/`epNext` change the range.
- **Only as good as the dataset** — inherits Phase 1's no-lookahead + availability-flag guarantees; fitting must honor the flags.

## Deliverables
1. Dataset-builder extension emitting the normalized signal-map columns (Task 0).
2. Ridge fit (Python, per position) → coefficients + train/held-out metrics + ablation (incl. Tier-2 feature-importance).
3. Re-benchmark report (fitted vs hand-tuned vs `xP`/`ppg`, held-out).
4. **If it wins:** updated `SCORING_WEIGHTS` (+ `epNextSignal` folded in). Else: report only.
5. Runtime regression test: shipped weights produce sane rankings; existing pipeline/`composite-scorer` tests stay green.
