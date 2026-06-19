# Transfer-vs-hold threshold — stop recommending a move almost every week

## Why
`squad-eval-transfer-replay` showed the optimizer recommended a transfer in **34/35** gameweeks and, on the deterministic floor, its recommendations **net-lost** points vs holding (−220 over the season) while the manager's selective transfers gained. The root cause is in `evaluateSingleTransfer`: it recommends the best transfer whenever `gw1Gain > 0`, so *any* positive edge — including projection noise — triggers a move. Real FPL play is selective: you hold (and bank the free transfer) unless the upgrade is clearly worth it.

This change adds a **transfer-vs-hold threshold**: recommend a transfer only when its projected gain clears a bar; otherwise recommend holding/rolling. The bar must be **derived intelligibly**, not hand-picked.

## What changes
- **`transfer-optimization`** — `evaluateSingleTransfer` (and the roll logic) gate the go/hold decision on a **points-denominated** threshold instead of `gain > 0`:
  - The decision is denominated in **projected points** via `ep_next` (FPL's expected points — the native unit and already the composite's dominant signal): `Δep = in.epNext − out.epNext`.
  - **Hit moves** must clear the only hard number FPL gives us — a hit costs **4 points** — so they require `Δep > 4`. Exact, not a guess.
  - **Free moves** must clear `τ`, the opportunity cost of spending the free transfer now instead of banking it. `τ` is **calibrated from data** (see design), bracketed by the intelligible bounds `0 < τ < 4`.
  - When `ep_next` is null for either player, **hold** — calibration showed transfers chosen on the composite alone (ep absent) are negative-EV, so a transfer isn't spent without FPL's projection.
- Ranking is unchanged — the composite still picks *which* transfer is best; this only changes *whether* to make it.

## Impact
- Runtime change in `lib/optimizer/*` (the first behavior change here in a while — calibrate + validate before relying on it).
- `lib/config.ts` gains the derived threshold constant(s).
- Validated by re-running `squad-eval-transfer-replay`: the recommendation rate should fall toward a selective level and net-vs-holding should stop being negative.

## Out of scope
- Multi-transfer / hit-stacking strategy and chip-week logic.
- Position- or horizon-specific thresholds (v1 is one bar; refine later if the data warrants).

## Depends on
`composite-backtest` (its dataset — `epNext` proxy + `next3_points` — is the calibration source) and `squad-eval-transfer-replay` (the validation harness).
