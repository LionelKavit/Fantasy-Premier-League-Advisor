## Tasks

> Relax the composite's hard `[0,1]` clamp to a monotonic logistic squash so signed,
> epNext-dominant weights rank without clamp-ties. Validated by the `composite-backtest`
> benchmark. **As-built outcome: composite 0.42 → ~0.53 Spearman within position.**

### Task 1: Emit full-magnitude signed weights + squash calibration — DONE
**Capability:** composite-scoring
- `fit.py` emits the **full-magnitude** signed per-position ridge coefficients (epNext dominant ~10–13; others small signed incl. negative `value`; `ppg` dropped) and the **logistic calibration** (`center`, `scale`) from the training raw-score distribution → `out/weights.json`.

### Task 2: Make offline epNextSignal match the runtime — DONE
**Capability:** composite-scoring
- `build-dataset.ts`: normalize `xP` by the **per-round pool max** (`roundMaxXp`), the offline analog of the runtime's `epNext / maxEpNext`. (Was the season's single best-ever GW xP → offline signal ~20× smaller than runtime → every squad rating saturated at 1.0.)

### Task 3: Apply the squash + weights — DONE
**Capability:** composite-scoring
- `lib/config.ts`: full-magnitude signed `SCORING_WEIGHTS` + `COMPOSITE_SQUASH = { center: 3.0965, scale: 1.8508 }`.
- `lib/pipeline/composite-scorer.ts`: replaced `clamp01(total)` with the logistic `1/(1+exp(−(raw−center)/scale))`; injects `epNext` into the signal map.

### Task 4: Validate + downstream audit + fix tests — DONE
**Capability:** composite-scoring
- Rebuild dataset + benchmark → composite **0.528 / 0.553 / 0.531** (2022/2023/2024), up from 0.42; output in (0,1), <0.1% near 1.0, 0% at 0.
- Downstream audit: `gw1Gain > 0.05` (chip) and `insufficientDataFallbackScore 0.3` remain valid on the (0,1) distribution; `minutesCertainty < 0.7` is an unaffected sub-signal; `scoreDiffPct` is computed but unused (no display risk).
- Updated `horizon.test.ts`: a "clearly stronger" candidate is now defined by high `epNext` (the dominant data-fit signal) + low price, since raw goalThreat/bonus/value carry negative per-point-overvaluation weights.

### Verify
- [x] Backtest composite ~0.53 (up from 0.42); distribution in (0,1), no saturation at the bounds.
- [x] Logistic squash is strictly monotonic (ranking == raw signed-sum ranking).
- [x] Pitch "/10" ratings well-spread (browser: real squad 2.9–9.9, monotonic with epNext); optimizer recommendations still sane.
- [x] `tsc` / `eslint` / `next build` / `vitest` (184) clean.
