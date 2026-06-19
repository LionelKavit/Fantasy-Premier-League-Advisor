# Design

## Context
`composite-weight-training` fitted per-position ridge weights on the point-in-time dataset. The fit's verdict: `epNextSignal` should dominate (coef ~37–44 vs single digits), lifting held-out ranking from 0.33 (hand-tuned) to 0.57. But the raw coefficients can't ship into the runtime composite, which **clamps the total to [0,1]** and is built for weights that keep the output in that range. This change adapts the finding into range-safe runtime weights.

## Key decisions

### 1. Fold `epNextSignal` into the base sum
In `composite-scorer.computeCompositeScore`, `market.epNextSignal` is computed and stored in `breakdown` but **not added to `baseScore`**. Add it: include an `epNext` weight per position in `SCORING_WEIGHTS`, and add `market.epNextSignal * weight.epNext` to the base sum (alongside the existing `signalMap` categories). `epNextSignal` already handles null `ep_next` → `0.5` (neutral), so a player without a projection gets a mid score rather than collapsing.

### 2. Range-safe rescaled weights (preserve ranking, keep [0,1])
The fitted coefficients rank well but are unbounded (epNext≈44). Convert them to runtime weights that **keep the weighted sum in ~[0,1]** so `clamp01` rarely binds and discrimination is preserved:
- Derive each position's weights by **rescaling the fitted coefficients to the [0,1] convention** — epNext dominant (~0.5–0.7), the other normalized signals sharing the remainder, dropping/zeroing signals whose fitted coefficient is negligible or perverse (e.g. large-negative `value` artifacts of collinearity).
- The exact mapping is a fitting/judgment step done in `composite-weight-training`'s `fit.py` (emit a **rescaled, [0,1]-safe weight set**), validated by re-running the backtest: the re-weighted runtime composite should score ≈ the fitted (~0.57), not collapse under the clamp.

### 3. Keep deterministic signals for explainability
The fit shows the non-epNext signals add little *ranking* value, but the composite `breakdown` (goalThreat, fixture, form, …) is what the Scout's prose explains ("captain him: threat into an easy fixture"). So retain them at small weight rather than stripping to epNext-only. (A later change may simplify.)

## Files
- `lib/config.ts` — new per-position `SCORING_WEIGHTS` incl. an `epNext` key (rescaled from the fit).
- `lib/pipeline/composite-scorer.ts` — add `market.epNextSignal * weight.epNext` to `baseScore`.
- `research/composite-backtest/fit.py` — emit the rescaled [0,1]-safe weight set + verify the re-weighted composite via the backtest.
- Tests: update any `composite-scorer`/pipeline tests asserting specific composite values/orderings; the runtime regression must stay green.

## Pitfalls
- **Clamp saturation** — the whole reason for rescaling; verify the re-weighted composite's distribution isn't pinned at 1.0.
- **Null `epNext`** — neutral 0.5 fallback; confirm it doesn't distort early-season.
- **Display** — the pitch "rating /10" is `composite × 10`; confirm it still reads sensibly with the new range.
- **Test churn** — composite values change; update assertions to ranking/threshold checks rather than magic numbers where possible.

## Verification
- Re-run `composite-backtest` benchmark on the re-weighted composite → expect ~0.57 (up from ~0.33), beating ppg; near xP.
- App gate: `tsc` / `eslint` / `next build` / `vitest` green (runtime change = `config` weights + one line in `composite-scorer`).
- Browser: pitch ratings still sensible; the Scout's verdict/breakdown still coherent.
