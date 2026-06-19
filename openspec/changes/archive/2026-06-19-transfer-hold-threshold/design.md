# Design — intelligibly-derived transfer-vs-hold threshold

## The core problem: gain is in composite units, but "worth it" is a points question
`gw1Gain` today is a difference of composite scores (0–1, squashed) — there is no natural "is this worth a transfer?" line on that scale, so the code uses `> 0`, which fires on noise. The fix is to denominate the *decision* in the one unit where "worth it" is meaningful: **points**. We keep the composite for *ranking* candidates; we add a points bar for the *go/hold* call.

## Why `ep_next` is the right unit
`ep_next` is FPL's expected points for the next gameweek — literally the quantity a transfer is trying to increase, and already the composite's dominant signal. So the projected gain of a swap is simply `Δep = candidate.epNext − weakPlayer.epNext`, available at the decision point (both are `ScoredPlayer.player.epNext`). This makes the threshold human-readable: "only transfer if it projects to add more than N points."

## Deriving the threshold intelligibly (not hand-picked)
FPL hands us exactly **one** hard, non-arbitrary number about transfer value: **a hit costs 4 points.** Everything else is bracketed by it.

- **Hit moves:** worth it only if `Δep > 4` — the move must out-project the points it costs. Exact, by definition.
- **Free moves:** worth it only if `Δep > τ`, where `τ` is the *opportunity cost of using the free transfer now* rather than banking/rolling it. Two intelligible bounds bracket τ:
  - `τ > 0` — a sliver of projected edge isn't worth burning the FT (and the price/ownership churn).
  - `τ < 4` — else you'd refuse free transfers you'd happily take as hits, which is incoherent.
- **Pinning τ within (0, 4) with evidence:** calibrate on the `composite-backtest` dataset (which carries the `epNext` proxy + realized `next3_points`). Simulate one-for-one **same-position** swaps across the pool and plot realized next-3 gain as a function of `Δep`; τ is the smallest `Δep` at which realized gain reliably crosses and stays above zero — i.e., the projected edge below which "upgrades" are indistinguishable from noise. Report the curve so the chosen τ is auditable. Sanity check: the FPL-community heuristic for a worthwhile free transfer is ~1.5–2 projected points; the calibrated τ should land near there.

## `ep_next`-null → hold (data-backed, replaces the planned composite fallback)
When either player's `ep_next` is null (early GW, new signing), **hold**. We planned a composite-units fallback bar `τ_c`, but calibrating it on the ep-absent floor composite (the distribution it would actually gate) showed the composite has **no positive predictive value** there: realized next-3 gain was negative at *every* `gw1Gain` level (−2 to −4 pts, P(gain>0) 0.33–0.42). So no `τ_c` produces good transfers — the correct, honest fallback is to not spend a transfer without FPL's projection. This also makes `squad-eval-transfer-replay` (ep-absent) a clean validator: it should now hold every week, eliminating the negative-EV bleed.

## Where it plugs in
- `lib/optimizer/single-transfer.ts` — replace the `allNegative = gw1Gain <= 0` go/hold test with a `clearsThreshold(bestSingle)` test (Δep > τ for free, > 4 for hit; `τ_c` fallback). When it fails, return the existing roll/savings path with a reason like "best available upgrade projects +X.X pts — below the Y.Y-pt bar to spend a free transfer; rolling."
- `lib/config.ts` — `TRANSFER_THRESHOLDS = { freeTransferEp: τ, hitCostEp: 4, compositeFallback: τ_c }`.
- Hit detection: a move is a "hit" when it would exceed available free transfers (the optimizer already knows `freeTransfers`).

## Validation
1. **Calibration report** (offline, `research/`): the `Δep` → realized-next-3 curve and the chosen τ / τ_c, with the FPL-heuristic sanity check.
2. **Re-run `squad-eval-transfer-replay`:** confirm the recommendation rate drops from 34/35 toward a selective level and net-vs-holding is no longer negative (validates via the `τ_c` fallback, since that replay is ep-absent).
3. App gate: `tsc` / `eslint` / `next build` / `vitest` clean; update any optimizer tests asserting the old `>0` behavior.

## Pitfalls
- **Don't gate the ranking** — only the go/hold decision; the composite still orders candidates.
- **Floor vs runtime** — the floor replay validates the `τ_c` fallback; the points gate's full effect needs the forward eval (it depends on live `ep_next`). State this.
- **Too high a τ → never transfer.** Keep τ in (0, 4) and report the recommendation-rate change so the effect is visible.
