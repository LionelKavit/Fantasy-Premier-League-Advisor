# Captain replay — does the app's captain pick beat the manager's own, on real squads?

## Why
`composite-backtest` benchmarks predictors on **rank metrics** over the whole player universe. But captaincy is **squad-relative**: pick the best of *your XI*. That can't be measured on a player-universe dataset — it needs the manager's real squads.

This is now feasible from the **FPL API alone**: the just-finished **2025-26** season is still served (it's mid-rollover into 2026-27 — a **time-sensitive** window). The API exposes the manager's per-GW picks (incl. their actual captain) and full per-GW player history (minutes, xG/xA/xGC, defensive_contribution, price, realized points). So we can replay the app's **actual captain pipeline** against history and score it against what really happened — and against the human's own armband.

## What changes
- **`squad-eval`** — a new offline harness (under `research/`, **no runtime change**) that, for the manager's real 2025-26 squad each gameweek:
  - Reconstructs each player's **point-in-time** state from the FPL API (`element-summary` history, aggregating rounds `< N`, no lookahead).
  - Runs the app's **real captain pipeline** (`computeCaptainSynthesisInput` + the captain ranker) over the manager's XI.
  - Scores the pick against (a) the **realized top scorer** in that XI, (b) the manager's **actual captain**, and (c) baselines.

## Scope decisions (settled)
- **FPL API end-to-end. No vaastav.** 2025-26 only (the API serves per-GW history only for the currently-accessible season; older seasons give season-summary rows only).
- **Drop `xP`/`ep_next` entirely.** Point-in-time `ep_next` is not in the API and is not proxied here. The replay therefore tests the **deterministic + model-projection** captain core (the pipeline runs with `ep_next` absent, so its `epBlendWeight` blend falls back to the model projection). This is stated as an explicit caveat, not a hidden gap.

## Impact
- Offline tooling only. App `tsc`/`eslint`/`next build`/`vitest` stay clean.
- **Time-sensitive prerequisite:** fetch + cache the manager's GW3-38 picks and the squad players' `element-summary` history **now**, before the 2026-27 reset closes access. (GW1-2 are not available for this manager.)

## Out of scope
- **Transfer-decision replay** → separate follow-up change `squad-eval-transfer-replay` (depends on this one).
- Weight fitting (`composite-weight-training`, archived) and player-universe rank metrics (`composite-backtest`, archived).
- Multi-season / pre-2025-26 evaluation (would require vaastav) and LLM-context signals (not reconstructable historically → replay uses neutral LLM).

## Depends on
The app's captain pipeline (`lib/captain/*`) and FPL fetch helpers (`lib/fpl-api.ts`).
