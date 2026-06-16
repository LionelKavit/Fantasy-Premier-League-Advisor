## ADDED Requirements

### Requirement: Compute horizon projections
The system SHALL provide a `computeHorizon(validTransfers: ValidTransfer[], fixtures: Fixture[], teams: Team[], currentGw: number): HorizonEntry[]` function that projects transfer value across GW+1 through GW+5 by rescoring with future fixture data. Each ValidTransfer already carries its `weakPlayer`, so no separate weak-spot list is required.

#### Scenario: Per-GW rescoring
- **WHEN** computing a horizon entry for a candidate
- **THEN** for each GW from currentGw+1 to currentGw+5, call `computeFixtureSignals(candidate.player, fixtures, teams, gw)` with the shifted gameweek
- **AND** call `computeCompositeScore` with the new fixture signals and the candidate's original statistical, trend, market, and LLM signals
- **AND** do the same for the weak player being replaced

#### Scenario: Per-GW gain
- **WHEN** candidate scores 0.70 and weak player scores 0.45 in GW+1
- **THEN** the GW+1 gain is 0.25

#### Scenario: Cumulative gain
- **WHEN** per-GW gains are [0.15, 0.10, -0.05, 0.20, 0.08]
- **THEN** cumulativeGain is [0.15, 0.25, 0.20, 0.40, 0.48]

#### Scenario: Fixture swing detected
- **WHEN** per-GW gain changes from positive to negative (or vice versa) within the 5-GW window
- **THEN** fixtureSwing is true

#### Scenario: No fixture swing
- **WHEN** all per-GW gains are positive (or all negative)
- **THEN** fixtureSwing is false

### Requirement: Timing classification
The system SHALL classify each horizon entry's timing based on cumulative gain patterns.

#### Scenario: BUY_NOW
- **WHEN** cumulativeGain[0] > 0 (gain in GW+1) AND cumulativeGain[4] > 0 (still ahead after 5 GWs)
- **THEN** timing is "BUY_NOW"

#### Scenario: WAIT
- **WHEN** cumulativeGain[0] ≤ 0 (no immediate gain) AND cumulativeGain[4] > 0 (gains materialize later)
- **THEN** timing is "WAIT"

#### Scenario: BUY_NOW_SELL_LATER
- **WHEN** cumulativeGain[0] > 0 (immediate gain) AND cumulativeGain[4] ≤ 0 (advantage fades due to fixture swing)
- **THEN** timing is "BUY_NOW_SELL_LATER"

#### Scenario: End of season
- **WHEN** currentGw is 36 or later and fewer than 5 GWs remain
- **THEN** compute only for the remaining GWs and pad cumulativeGain with the last value

#### Scenario: Limit horizon entries
- **WHEN** there are many valid transfers
- **THEN** compute horizon only for the top 5 valid transfers by gw1Gain (to limit computation)
