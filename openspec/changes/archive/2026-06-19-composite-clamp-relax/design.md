# Design

## Context
The composite ends in `total = clamp01(baseScore + trendAdj + llmAdj − suspensionPenalty)`. With signed, epNext-dominant weights the raw sum ranges ~[−0.3, 1.1]; the hard clamp ties the bottom ~37% at 0 and any top at 1, collapsing ranking to 0.38. We want the signed weights' full ranking (~0.57) **without** breaking the (0,1) range that the display and downstream rely on.

## Key decisions

### 1. Logistic squash instead of hard clamp
Replace `clamp01(x)` with a **strictly-monotonic logistic**: `total = 1 / (1 + exp(−(x − center) / scale))`.
- Strictly increasing → **ranking is identical to the raw signed sum** (no ties) → recovers the fit's ranking.
- Range `(0,1)` → the pitch "/10" (`total × 10`) and every `[0,1]` consumer keep working.
- `center` / `scale` are calibrated from the **training** raw-score distribution (e.g. `center` = median, `scale` ≈ IQR/2) so typical scores spread across ~(0.2, 0.8) and don't saturate. Emitted by `fit.py` into `config` constants (`COMPOSITE_SQUASH`).

### 2. Signed, epNext-dominant weights
Use the per-position weights scaled so `epNext` has unit weight and the others are small **signed** fractions (incl. negative price/`value`) — the version that ranks ~0.57 unclamped. (`fit.py` already computed these; re-emit + place in `SCORING_WEIGHTS`.)

### 3. Downstream audit (the risk)
Composite magnitudes change (logistic-compressed), though rankings improve. Check consumers that assume the old ~weighted-average scale:
- **`insufficientDataFallbackScore` (0.3)** — returned directly (bypasses the squash); 0.3 is still a sensible low-mid (0,1) placeholder. Keep, or set to the squash of a neutral raw score.
- **Optimizer gains** (`gw1Gain`/`gw5Gain` = composite diffs) — ranking-consistent, but any *absolute* gain threshold tuned to the old scale may need revisiting; audit `lib/optimizer/*`.
- **Pitch display** — `total × 10` still in [0,10]; confirm spread is sensible (not bunched).
- Squad-ranker/weakest3 use ordering → unaffected.

## Files
- `lib/pipeline/composite-scorer.ts` — replace the clamp with the logistic squash (using `COMPOSITE_SQUASH`).
- `lib/config.ts` — signed `SCORING_WEIGHTS` + `COMPOSITE_SQUASH = { center, scale }`.
- `research/composite-backtest/fit.py` — emit signed weights + the squash calibration.
- Tests: update `composite-scorer`/pipeline tests asserting specific values; keep ranking/threshold assertions.

## Verification
- Backtest: re-weighted+squashed composite ranks **~0.55–0.57** (up from 0.42), output strictly in (0,1), **no clamp-ties** (≈0% at the exact bounds).
- App gate: `tsc` / `eslint` / `next build` / `vitest` green.
- Browser: pitch "/10" ratings well-spread and sensible; Scout verdict/optimizer still coherent.

## Pitfalls
- **Calibration** — bad center/scale → saturation near 0/1 (loses spread). Calibrate from data; verify the distribution.
- **Optimizer thresholds** — the one place an absolute-magnitude assumption could bite; audit + adjust.

## Outcome (as-built) — diverged from the plan in two ways
1. **Full-magnitude weights, not epNext=1.** Scaling to epNext=1 compressed the base onto the small epNextSignal scale, so the additive `trendAdj`/`suspensionPenalty` (±0.05) overwhelmed it and ranking collapsed to **0.39**. Keeping the **full-magnitude** ridge coefficients (epNext ~10–13) makes the base dominate those terms → ranking preserved.
2. **epNextSignal scale mismatch (the real blocker).** The offline dataset normalized `xP` by the season's single best-ever GW, making the offline signal ~20× smaller than the runtime's `epNext / maxEpNext`. The fitted coef + squash, calibrated on that tiny signal, **saturated every real squad rating near 1.0** at runtime. Fix: normalize offline by the **per-round pool max**, matching the runtime exactly. After this, the fit re-emitted epNext ~10–13 and squash `{center: 3.0965, scale: 1.8508}`.
- **Result:** composite **0.528 / 0.553 / 0.531** (2022/2023/2024) — short of the hoped ~0.57 (the residual is the dropped `ppg` + the added `trendAdj`, not the clamp) but a clear win over 0.42, approaching xP (~0.59). Real-squad pitch ratings span **2.9–9.9**, monotonic with epNext within position, no saturation.
