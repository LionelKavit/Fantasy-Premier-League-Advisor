## ADDED Requirements

### Requirement: Captain decisions are replayed on the manager's real squad
The system SHALL evaluate the app's captain pipeline against realized FPL points within the manager's actual 2025-26 squad context, sourced entirely from the FPL API, and report it against the manager's own captain choices and baselines.

#### Scenario: Data is sourced from the FPL API and cached (time-sensitive)
- **WHEN** the harness is run
- **THEN** it fetches the manager's per-GW picks (`entry/{id}/event/{gw}/picks/`, incl. `is_captain` and `active_chip`) for the available gameweeks (GW3-38; GW1-2 are absent for this manager) **and** each squad player's per-GW history (`element-summary/{element}/history/`) for 2025-26
- **AND** it caches the raw API responses to disk on first fetch, because the 2025-26 window closes at the 2026-27 reset; later runs read the cache
- **AND** it does NOT use the vaastav dataset or `xP`/`ep_next` (dropped from this evaluation)

#### Scenario: Player state is reconstructed point-in-time (no lookahead)
- **WHEN** evaluating gameweek `N`
- **THEN** each player's signals are built from ONLY their `element-summary` rows with `round < N` (season-to-date aggregates), so no post-GW information leaks into the decision

#### Scenario: The app's actual captain pipeline is replayed
- **WHEN** a captain is chosen for the manager's XI at GW `N`
- **THEN** the harness runs the app's real captain code (`computeCaptainSynthesisInput` + the captain ranker in `lib/captain/*`) — not a simplified proxy
- **AND** it runs with **neutral LLM signals** and with **`ep_next` absent** (so the pipeline's `epBlendWeight` falls back to the model projection); the result is therefore the **deterministic + model-projection** captain core, and this caveat SHALL be stated alongside the reported metrics

#### Scenario: Captain hit-rate and points-captured
- **WHEN** captaincy is scored for a GW
- **THEN** the harness reports whether the app's #1 captain is the **realized top scorer** in the manager's XI (hit-rate), plus a **points-captured ratio** (app captain's realized points ÷ the XI's max realized points)

#### Scenario: Head-to-head against the manager's own captain
- **WHEN** results are aggregated over GW3-38
- **THEN** the harness reports the app captain's realized points vs the manager's **actual** captain's: win/tie/loss rate and the **net points delta over the season**

#### Scenario: Baselines and chip handling
- **WHEN** results are reported
- **THEN** the app pipeline is compared against baselines computed within the same XI — highest season-to-date PPG, highest ownership, and random (no `xP` baseline)
- **AND** Triple-Captain gameweeks are flagged and results reported both including and excluding them; captaincy is scored on realized `total_points` with the captain multiplier applied equally across all compared picks (multiplier-invariant)

#### Scenario: Offline-only, app build unaffected
- **WHEN** the harness and its cache live under `research/`
- **THEN** they are excluded from the app build, and `tsc`/`eslint`/`next build`/`vitest` remain clean
