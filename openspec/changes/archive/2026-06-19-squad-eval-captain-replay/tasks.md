## Tasks — captain replay on real 2025-26 squads (FPL API)

> Offline tooling under `research/squad-eval/`. FPL API end-to-end; no vaastav, no `xP`. No runtime change.

### Task 0: Fetch + cache the 2025-26 data (TIME-SENSITIVE — do first)
**Capability:** squad-eval
- Fetch the manager's picks `entry/{id}/event/{gw}/picks/` for GW3-38 (capture `picks`, `is_captain`, `active_chip`).
- Fetch `element-summary/{element}/history/` for every player who appears in any of those squads.
- Fetch `bootstrap-static/` for element→team/position/name + fixtures/teams.
- Cache all raw responses to `research/squad-eval/cache/` (the 2025-26 window closes at the 2026-27 reset).

### Task 1: Point-in-time reconstruction
**Capability:** squad-eval
- For each GW `N`, build each XI player's `Player`/signal state from their `element-summary` rows with `round < N` (no lookahead), reusing the aggregation approach from the archived `composite-backtest` builder.

### Task 2: Captain replay
**Capability:** squad-eval
- Run the app's real captain pipeline (`computeCaptainSynthesisInput` + captain ranker) over the reconstructed XI, with neutral LLM and `ep_next` absent. Capture the app's #1 captain per GW.

### Task 3: Metrics + report
**Capability:** squad-eval
- Per GW + aggregated over GW3-38: hit-rate (app pick == realized top scorer in XI), points-captured ratio, head-to-head vs the manager's actual captain (win/tie/loss + net season delta), vs baselines (PPG, ownership, random).
- Flag Triple-Captain GWs; report with/without. State the ep-absent + neutral-LLM caveats in the report.

### Task 4: Verify
- Committed report under `research/squad-eval/report.md`.
- App gate stays clean (`tsc` / `eslint` 0 errors / `vitest` 184) — `research/` excluded from the build.

### Decide
- [x] Manager id: **10815578**.
- [x] Captaincy is single-GW: the replay scores the immediate-GW pick directly (`batchComputeCaptainScores` with `immediate=true` → `rankCaptains` → `selectCaptaincy`); no multi-GW horizon needed.

---

## As-built outcome (run 2026-06-19)

**Implemented** (FPL API end-to-end; no vaastav, no `xP`):
- `research/squad-eval/fetch-cache.ts` — cached the full 2025-26 dataset while the rollover window is open: 36 GWs of picks (GW3-38; GW1-2 absent), 56 players' `element-summary` histories, bootstrap, fixtures. The whole season is still served and internally consistent (38 finished events, real FDR), so **fixture difficulty is real, not neutralized** — one fewer approximation than the spec assumed.
- `research/squad-eval/replay.ts` — point-in-time `Player` reconstruction (rounds `< N`, mirroring the archived backtest builder) → `scorePlayerLite` → the app's real captain pipeline; metrics + `report.md`.

**Result (GW3-38, 36 gameweeks):**
- Captain **hit-rate 28%** (10/36 app pick = realized top scorer in XI); **points-captured 57%** of the perfect-captain ceiling.
- **Head-to-head vs the manager's own armband: 6W / 26T / 4L, net +9 captain-pts (+18 squad pts over the season)** — the app's deterministic core modestly beat the human (26 ties because both captained Haaland most weeks).
- Mean captain pts/GW: **App 7.06** > actual 6.81 > PPG 6.47 > ownership 5.67 > random 4.49; perfect ceiling 12.22. The app beats the manager and every baseline.

**Caveats (in the report):** `ep_next` absent (epBlend → model projection), neutral LLM, availability assumed available, penalty order + ownership-total from the season-end bootstrap. No Triple-Captain GWs this season, so the with/without-TC split was a no-op.
