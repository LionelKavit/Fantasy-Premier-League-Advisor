## Tasks

> Runtime change applying the `composite-weight-training` finding: anchor the composite on `epNext`. Validated by the `composite-backtest` benchmark.

### Task 1: Emit range-safe rescaled weights
**Capability:** composite-scoring
- In `research/composite-backtest/fit.py`, convert the fitted per-position coefficients into a **[0,1]-safe `SCORING_WEIGHTS`** set (epNext dominant ~0.5–0.7; other normalized signals share the remainder; drop negligible/perverse-negative coefficients). Emit them (e.g. `out/weights.json` / a config snippet).

### Task 2: Fold epNext into the composite
**Capability:** composite-scoring
- `lib/pipeline/composite-scorer.ts`: add `market.epNextSignal * weights.epNext` to `baseScore` (it's computed today but excluded). Confirm null-`ep_next` → 0.5 neutral path is sane.
- `lib/config.ts`: replace `SCORING_WEIGHTS` with the rescaled set (incl. the `epNext` key per position).

### Task 3: Validate + fix tests
**Capability:** composite-scoring
- Re-run the backtest benchmark on the re-weighted composite → expect ≈0.57 (up from ~0.33), not clamp-collapsed.
- Update any `composite-scorer`/pipeline tests asserting specific composite values/orderings (prefer ranking/threshold assertions over magic numbers).

### Verify
- [x] Re-weighted composite **~0.33 → ~0.42** Spearman (within-position, 2022-25), beats `ppg` (~0.31); distribution clean (**0% at 1.0, 9% at 0**).
- [x] `epNext` injected into the signal map + weighted into the base sum; null-`ep_next` → 0.5 neutral path intact.
- [x] Pitch "/10" ratings sensible + well-distributed (0.7–8.6), no saturation; base renders, captain logic intact (browser-checked).
- [x] `tsc` / `eslint` (0 errors) / `next build` / `vitest` (184) clean.

#### As-built outcome (run 2026-06-18)
- **Shipped:** `epNext` injected into the composite signal map (`composite-scorer.ts`); `SCORING_WEIGHTS` replaced with data-fit, **non-negative, sum-1, epNext-anchored** weights (epNext share 0.62–0.83 by position). `fit.py` emits them (`out/weights.json`).
- **Result:** composite ranking lifts from **0.33 → ~0.42** (beats ppg), validated by the backtest. A clear, honest improvement; runtime change = config weights + one scorer line.
- **Key finding (the [0,1] clamp caps the gain):** the raw fit ranks ~0.57 and pure xP ~0.62, but those need *signed* weights (negative price/`value` corrections). In the runtime's **`clamp01`** composite, keeping the negatives pushes ~37% of players below 0 → mass clamp-at-0 ties that *hurt* ranking (0.38). A non-negative weighted average never clamps and ranks best achievable here (~0.42). **To capture the remaining 0.42→0.57+, a follow-up would relax/remove the [0,1] clamp** (and rescale the "/10" display) so signed, epNext-dominant weights can be used — out of scope for this change.
