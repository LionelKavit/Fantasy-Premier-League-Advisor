## Tasks (Phase 2 — weight fitting)

> Depends on `composite-backtest` (archived): dataset at `research/composite-backtest/out/dataset.parquet` + the benchmark. The only runtime artifact is the fitted `SCORING_WEIGHTS`.
>
> **Mandate (from Phase 1):** the current composite (Spearman 0.31) loses to FPL's `xP` (0.62) — fold `ep_next` in and refit.

### Task 0: Emit the normalized signal-map features (prerequisite)
**Capability:** weight-training
- Extend `research/composite-backtest/build-dataset.ts` to emit, per row, the **exact per-position `signalMap` values** the weights multiply (one column per `SCORING_WEIGHTS` key, normalized via `NORMALIZATION_BOUNDS` / `buildSignalMap`), tagged Tier-1 — so ridge coefficients map 1:1 to `SCORING_WEIGHTS`. Rebuild the dataset/Parquet.

### Task 1: Per-position ridge fit
**Capability:** weight-training
- Fit **unconstrained ridge** per position (GK/DEF/MID/FWD) on the signal-map features + `epNextSignal` + `ppg` (label = `next3_points`, `label_gws==3`). Tune λ on the validation split.
- **Honor availability flags:** `has_fixture==1` for the fixture weight, `has_xg==1` for xG-derived signals, `has_xP==1` AND gate-clean season for the `xP`/`epNext` feature; exclude `low_minute==1`.
- Time-aware train/held-out split (later season held out, or walk-forward). Report train vs held-out.

### Task 2: Ablation + re-benchmark
**Capability:** weight-training
- Per-signal ablation (marginal-value table) + Tier-2 feature-importance.
- Re-run the Phase 1 harness with the fitted weights; compare fitted vs hand-tuned vs `xP`/`ppg` on **held-out** data using **rank-corr within position + top-K** (captain/transfer metrics → `squad-eval`).

### Task 3: Ship (conditional)
**Capability:** weight-training
- **If fitted wins on held-out data:** update `SCORING_WEIGHTS` in `lib/config.ts` and fold `epNextSignal` into the weighted base sum in `composite-scorer.ts` (give `epNext` a weight per position). Decide any coefficient→weight re-scaling and whether the pitch "rating /10" display needs a display-only rescale.
- **Else:** keep current weights; ship the report/findings only.

### Verify
- [x] Signal-map columns emitted (`sm_*` via exported `buildSignalMap`) and map 1:1 to `SCORING_WEIGHTS` keys.
- [x] Per-feature availability flags + gate-clean xP honored (fit on 2022-23/2023-24, held-out 2024-25; `has_fixture`/`has_xg`/`low_minute` filtered).
- [x] Train vs held-out metrics reported; time-aware split (no shuffle).
- [x] **Ship gate evaluated → NOT shipped** (see outcome): fitted didn't beat the `xP` baseline. Runtime weights unchanged.
- [x] `tsc` / `eslint` (0 errors) / `vitest` (184) clean — the only lib change is exporting `buildSignalMap` (behavior-neutral).

#### As-built outcome (run 2026-06-18)
- **Implemented:** `buildSignalMap` exported; builder emits 14 `sm_*` columns; `fit.py` (per-position ridge, time-aware hold-out) → `out/fit.{json,md}`.
- **Result (held-out 2024-25):** fitted **0.567** Spearman / 0.26 top-5 vs hand-tuned composite **0.33** / 0.18, ppg 0.35, **xP 0.613** / 0.275. The refit **~doubles the hand-tuned composite** but **does not beat raw xP**.
- **Why:** `epNextSignal` coefficient dominates (~37–44 vs single digits for every other signal) across all positions — the data says "anchor on FPL's epNext." But the linear blend still trails pure xP because the other signals add ranking noise → **xP ≈ the linear ceiling for next-3 ranking.**
- **Decision: report-only (no weight ship).** Per the spec gate it doesn't beat all baselines; and the raw coefficients (epNext≈44 on a [0,1] signal) would saturate the runtime `clamp01` and destroy ranking, so they're not shippable without rescaling.
- **Recommended follow-up (separate runtime change):** anchor the composite on `epNext` — add `epNext` to the pipeline + `SCORING_WEIGHTS` with dominant (rescaled) weight, and handle the clamp/range. Expected to lift the live composite from ~0.33 toward ~0.57–0.61. The deterministic signals add little ranking value over epNext for this horizon (a candidate for simplification).

#### Follow-up shipped (2026-06-19)
This change stayed **report-only**, but its `fit.py` pipeline and coefficients were operationalized by two subsequent runtime changes (both archived 2026-06-19):
- **`composite-epnext-anchor`** — folded `epNext` into the pipeline + `SCORING_WEIGHTS` (composite **0.33 → 0.42**), using positive-normalized weights under the existing `clamp01`.
- **`composite-clamp-relax`** — replaced the clamp with a monotonic logistic squash, shipped the **full-magnitude signed** coefficients, and fixed the `epNextSignal` scale mismatch (offline now normalizes by the per-round pool max, matching the runtime's `epNext / maxEpNext`). Live composite **0.42 → ~0.53**; pitch ratings span 2.9–9.9, no saturation.

Net: the methodology this change established now drives the live composite. The "not shipped" decision above reflects this change in isolation and is superseded by the two follow-ups.
