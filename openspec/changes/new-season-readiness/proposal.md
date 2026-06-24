# New-season readiness — what unlocks (and needs fixing) when 2026-27 starts

## Why
Several items in the recent arc were gated on the season being live — `ep_next` is only a genuine pre-deadline projection during a season, and the forward evaluations and Tier-2/calibration work can't run on the finished 2025-26 data. Collecting them into one **start-of-2026-27** change so nothing is forgotten at rollover. One item is a concrete **bug** that only bites at season start.

## What changes
- **`new-season-readiness`** — four season-gated items:
  1. **Cold-start composite fix (runtime, the bug).** `computeCompositeScore` early-returns a flat `insufficientDataFallbackScore` (0.3) for any player under `minMinutes` (270) — **bypassing the epNext anchor**. At GW1–3 every player is sub-270, so the whole composite collapses to 0.3 and ranking dies. Fix: under low minutes, still anchor on `ep_next` (FPL's preseason/early projection) rather than returning a flat score, so early-GW ranking is meaningful.
  2. **Forward full-pipeline evaluation (captain + transfer).** Implement `squad-eval-captain-live` (already specced, parked) **and** add a transfer analog, capturing live recommendations from GW1. This is the only way to validate the full pipeline — the ep-anchored composite, the captain ep-blend, and the transfer-hold gate (`Δep > 1.5`) — which the ep-absent historical replays could not exercise.
  3. **Tier-2 defensive-contribution evaluation (offline).** Once 2026-27 accrues `defensive_contribution` data (~GW8+), evaluate folding it into the composite — the one signal genuinely *outside* FPL's `ep_next` model (untestable historically; only 2025-26 had it).
  4. **Calibration freshness check (offline).** Revalidate the composite weights (fit on 2022-24) and the `τ=1.5` transfer bar against 2026-27 — FPL tweaks scoring rules between seasons (e.g. the DC rule), which can shift what the weights/threshold should be; refit only if the data moved.
  5. **Restructure ↔ long-term coherence (runtime).** The This Week *Restructure* section and the *Long Term* (transfer-horizon) tab are computed independently and can tell different stories — restructure pitches a downgrade-to-fund-a-dream maneuver the horizon never mentions, or even contradicts (e.g. the horizon says WAIT on that premium). A restructure is inherently a **multi-week investment** (you accept a short-term downgrade loss to land a premium that pays off over several GWs), so once the season is live and the horizon is meaningful, judge the restructure's dream over the **planning horizon** (not just next-GW `ep_next`) and share that context with the Long Term view, so the two tabs read as one plan.

## Impact
- Item 1 is a runtime change (`lib/pipeline/composite-scorer.ts`, `lib/config.ts`). Items 2–4 are offline/eval under `research/`. Item 5 is a runtime change in the optimizer/display (`lib/optimizer/restructure.ts`, `lib/optimizer/horizon.ts`, `components/panel/{ThisWeekDetail,LongTermDetail}.tsx`), gated on a live season so the horizon is meaningful.
- **Trigger: 2026-27 season start (~mid-August 2026).** Item 1 should land *before* GW1 (it's the demo-facing bug); items 2–5 run during the season as data accrues / the horizon becomes meaningful.

## Out of scope
- The detailed forward-capture mechanics for captaincy (those live in `squad-eval-captain-live`; this change coordinates it and adds the transfer sibling).
- Any change to the scoring methodology beyond the cold-start anchor and a data-driven refit.

## Depends on
`squad-eval-captain-live` (implement at the same rollover), and the archived composite + transfer-hold-threshold work (whose calibrations this revalidates).
