# Design — captain replay on real 2025-26 squads (FPL API)

## Context
Captaincy is a within-XI decision, so it needs the manager's real squads. The FPL API supplies everything required for 2025-26 **right now** (mid-rollover window): per-GW picks (with the manager's own captain + chips) and per-GW player history rich enough to reconstruct point-in-time signals. We replay the app's real captain code over those squads and score it against realized points. No vaastav, no `xP`.

## Data sources (all FPL API, cached locally)
- `entry/{id}/event/{gw}/picks/` — the 15 picks, `is_captain`/`is_vice_captain`, multiplier, `active_chip`. Available for **GW3-38** for this manager (GW1-2 → "Not found").
- `element-summary/{element}/` → `history[]` — per-GW realized rows for 2025-26: `minutes`, `starts`, `goals_scored`, `assists`, `clean_sheets`, `goals_conceded`, `bonus`, `bps`, `expected_goals`/`_assists`/`_goal_involvements`/`_goals_conceded`, `defensive_contribution` (+ `tackles`/`clearances_blocks_interceptions`/`recoveries`), `value` (price), `ict_index`, `saves`, cards, `opponent_team`, `was_home`, `round`, `total_points`.
- `bootstrap-static/` — element→team/position/name mapping and fixtures/teams reference.
- **Cache to disk** (e.g. `research/squad-eval/cache/`) immediately — the rollover will close access.

## Point-in-time reconstruction (no lookahead)
For the manager's XI at GW `N`, build each player's `Player`/signal state from **only** their `element-summary` rows with `round < N` (season-to-date aggregates: rolling form, minutes reliability, xG/xA-based threat, clean-sheet rate, xGC, price). This mirrors the no-lookahead aggregation `composite-backtest`'s builder used — reuse that approach so signals match the runtime as closely as possible.

## The replay
Run the app's **actual** captain pipeline — `computeCaptainSynthesisInput(ctx, horizon)` + the captain ranker (`lib/captain/*`) — over the reconstructed XI, with:
- **Neutral LLM signals** (rotation/injury context can't be reconstructed historically).
- **`ep_next` absent.** `CAPTAIN_CONFIG.epBlendWeight` blends FPL's ep with the model projection; with ep absent it falls back to the model projection. So the replay evaluates the **deterministic + model-projection** captain core, not the live ep-blended version. **Explicit caveat, reported alongside results.**

## Metrics (per GW, aggregated over GW3-38)
- **Captain hit-rate** — app's #1 captain == the **realized top scorer** in the manager's XI that GW.
- **Points-captured ratio** — app captain's realized points ÷ the XI's max realized points (a softer, partial-credit score).
- **Head-to-head vs the manager** — app captain's realized points vs the manager's **actual** captain's: win/tie/loss rate + **net points delta over the season** (the headline: "would following the app have beaten your own armband?").
- **Baselines** — highest season-to-date PPG in the XI, highest ownership in the XI, random-in-XI. (No `xP` baseline — dropped.)

## Data hygiene
- GW3-38 only; skip any GW with no valid XI / missing picks.
- Record `active_chip`; **flag Triple-Captain GWs** (the pick is the same, but realized captain value differs) and report with/without them.
- Score captaincy on **realized `total_points`** for the GW (clean from the API), with the standard ×2 captain multiplier applied equally to all compared picks (so the comparison is multiplier-invariant — it's really "who scored most").

## Reuse (don't rebuild)
- `lib/captain/*` (the pipeline under test), `lib/fpl-api.ts` fetch helpers, and the no-lookahead aggregation pattern from the archived `composite-backtest` builder.

## Pitfalls
- **ep-blend caveat** (above) — the single biggest fidelity gap; state it prominently.
- **Time-sensitivity** — cache the raw API responses before the 2026-27 reset; all later runs read the cache.
- **Chips** — Free Hit/Wildcard change the squad but still yield a valid XI; Bench Boost doesn't change the captain; Triple Captain changes value not the pick. Flag, don't silently drop.

## Deliverables
1. Fetch + cache layer for the manager's 2025-26 picks + squad `element-summary` history.
2. Point-in-time reconstruction + captain replay harness (offline, `research/squad-eval/`).
3. A committed report: hit-rate, points-captured, head-to-head vs the manager, vs baselines — with the ep-blend/neutral-LLM caveats stated.
