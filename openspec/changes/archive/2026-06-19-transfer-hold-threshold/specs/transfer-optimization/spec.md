## MODIFIED Requirements

### Requirement: A transfer is recommended only when its projected gain clears an intelligible threshold
The single-transfer optimizer SHALL recommend holding/rolling unless the best available transfer's projected gain clears a points-denominated threshold anchored to FPL's hit cost. It SHALL NOT recommend a transfer merely because the composite gain is positive.

#### Scenario: Decision is denominated in projected points
- **WHEN** `evaluateSingleTransfer` decides go-vs-hold for the top-ranked candidate
- **THEN** it computes the projected points gain `Δep = candidate.epNext − weakPlayer.epNext`
- **AND** the composite still determines *which* candidate ranks first (ranking is unchanged); the threshold only gates *whether* to recommend it

#### Scenario: Hit moves must out-project the hit cost
- **WHEN** the recommended move would require a points hit (exceeds available free transfers)
- **THEN** it is recommended only if `Δep > 4` (the exact cost of a hit); otherwise the optimizer recommends holding

#### Scenario: Free moves must clear the free-transfer opportunity cost
- **WHEN** the recommended move is free
- **THEN** it is recommended only if `Δep > τ`, where `τ` is the calibrated free-transfer opportunity cost with `0 < τ < 4`
- **AND** `τ` is derived from data, not hand-picked: calibrated on the `composite-backtest` dataset as the smallest `Δep` at which realized next-3-GW gain reliably exceeds zero, reported with its supporting curve and sanity-checked against the ~1.5–2 pt FPL heuristic

#### Scenario: ep_next unavailable → hold
- **WHEN** either player's `ep_next` is null
- **THEN** the optimizer recommends holding (no transfer), because the squad-eval calibration showed transfers chosen on the composite alone (ep absent) are negative-EV at every gain level — so a transfer is not spent without FPL's projection to justify it
- **AND** the thresholds live in `lib/config.ts` (`TRANSFER_THRESHOLDS`)

#### Scenario: Holding is explained in points
- **WHEN** the optimizer recommends holding because the bar is not cleared
- **THEN** the roll reason states the best upgrade's projected gain and the bar it failed (e.g., "best upgrade projects +0.8 pts — below the ~1.5-pt bar to spend a free transfer; rolling")

#### Scenario: The threshold reduces over-transferring (validation)
- **WHEN** `squad-eval-transfer-replay` is re-run with the threshold in place
- **THEN** the transfer-recommendation rate falls from the pre-change 34/35 toward a selective level, and net realized gain vs holding is no longer negative
- **AND** the app gate (`tsc` / `eslint` / `next build` / `vitest`) stays clean, with optimizer tests updated off the old `gain > 0` behavior
