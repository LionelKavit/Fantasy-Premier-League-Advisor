## ADDED Requirements

### Requirement: Transfer decisions are replayed on the manager's real squad
The system SHALL replay the app's transfer optimizer against the manager's actual 2025-26 squad and transfer history (sourced from the FPL API), and score its recommendations by realized FPL points against holding and against the manager's own transfers.

#### Scenario: Transfer + budget data is sourced from the API and cached
- **WHEN** the harness is run
- **THEN** it fetches the manager's transfers (`entry/{id}/transfers/`) and per-GW bank/transfer counts (`entry_history.bank`, `event_transfers`, `event_transfers_cost` from the cached picks), reusing `squad-eval-captain-replay`'s player-history cache
- **AND** it uses the FPL API only — no vaastav, no `xP`/`ep_next` — and caches raw responses (the 2025-26 window closes at the 2026-27 reset)

#### Scenario: Budget and free-transfer state are reconstructed
- **WHEN** evaluating gameweek `N`
- **THEN** bank is read exactly from `entry_history.bank`, and the free-transfer count is **inferred** from the manager's `event_transfers` history under standard FPL rules
- **AND** the free-transfer inference is documented as an approximation, and the headline metric SHALL NOT depend on its exactness

#### Scenario: The app's actual optimizer is replayed point-in-time
- **WHEN** a transfer is recommended for GW `N`
- **THEN** the harness runs the app's real optimizer (`lib/optimizer/*`) on the manager's reconstructed real 15, with player state built from `element-summary` rows with `round < N` (no lookahead), neutral LLM, and `ep_next` absent — the same deterministic + model-projection caveat as `squad-eval-captain-replay`

#### Scenario: Counterfactual gain vs holding
- **WHEN** a recommended transfer is scored
- **THEN** the harness reports the recommended `in − out` realized points over the next **1** and **3** gameweeks versus holding (zero), net of a −4 point hit when the recommendation would require one

#### Scenario: Head-to-head against the manager's actual transfers
- **WHEN** results are aggregated over the season
- **THEN** the harness reports the app recommendation's realized gain vs the manager's **actual** transfer(s) each GW (win/tie/loss + net season points delta), plus a "no-op accuracy" rate (how often the app correctly recommends holding when the manager's actual transfer lost points)

#### Scenario: Offline-only, app build unaffected
- **WHEN** the harness and its cache live under `research/`
- **THEN** they are excluded from the app build, and `tsc`/`eslint`/`next build`/`vitest` remain clean
