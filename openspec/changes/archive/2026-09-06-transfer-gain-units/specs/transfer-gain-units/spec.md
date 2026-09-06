## ADDED Requirements

### Requirement: A transfer gain shown as points is the ep delta
Wherever the system presents a recommended transfer's projected gain to a manager in points ("ep", "pts", "expected points"), the value SHALL be `epNext(in) − epNext(out)` for that move (or the sum over the action's moves), computed from the same bootstrap data the gate used. The composite-score delta SHALL NOT be presented as points.

#### Scenario: Brief per-move line
- **WHEN** the deadline brief renders a recommended move whose in and out players both have a non-null `epNext`
- **THEN** the move line shows `+<epNext(in) − epNext(out)> ep next GW` to one decimal place, and no composite delta appears in the email

#### Scenario: Brief net line
- **WHEN** the deadline brief renders a primary action with one or more moves all of whose players have non-null `epNext`
- **THEN** the net line shows the sum of the per-move ep deltas, labelled `ep`

#### Scenario: Missing projection is stated, not substituted
- **WHEN** either player of a move has a null `epNext`
- **THEN** the move line shows `(ep unavailable)` and the net line is omitted; the composite delta is not printed in its place

### Requirement: The live-eval record carries the gate's projection
Each move recorded by the live-eval capture SHALL include `epOut`, `epIn`, and `epDelta` (each `number | null`), taken from the two players' `epNext` at capture time, in addition to the composite `gw1Gain`.

#### Scenario: Capture stores ep per move
- **WHEN** `capture.ts` records a primary or secondary action with moves
- **THEN** every move has `epOut`, `epIn`, and `epDelta = epIn − epOut` (null if either side is null), and the console summary prints the ep delta labelled `ep` and the composite delta labelled `composite`

#### Scenario: Older records degrade honestly
- **WHEN** `score-live.ts` reads a record whose moves lack `epDelta` (captured before this change)
- **THEN** the report shows `unavailable — captured before transfer-gain-units` for that gameweek's projected ep and excludes it from the projected-vs-realized comparison; it SHALL NOT back-compute the delta from a later bootstrap

### Requirement: Projected ep is reported next to realized points
The live transfer report SHALL show, per scored gameweek, the recommendation's projected ep delta and the realized `in − out` points over the next gameweek, and a mean of each over the scored rows, without rendering a verdict.

#### Scenario: Calibration columns
- **WHEN** `score-live.ts` writes `live-transfer-report.md` with at least one scored gameweek that has `epDelta`
- **THEN** the captured-recommendations table includes `projected Δep` and `realized next-1` columns, and a line states `mean projected Δep` and `mean realized next-1` with the count `n` of rows contributing

### Requirement: Composite gain fields state their unit
`ValidTransfer.gw1Gain`, `ValidTransfer.gw5Gain`, and `TransferAction.netGain` SHALL carry a doc comment stating they are composite-score deltas on a 0–1 scale used for display ordering, and that the transfer decision is ep-denominated in `allocate.ts` / `single-transfer.ts`.

#### Scenario: Reader sees the unit at the definition
- **WHEN** a developer reads the `ValidTransfer` or `TransferAction` definition in `lib/optimizer/types.ts`
- **THEN** each of those fields has a comment naming the unit and pointing to the ep-denominated gate

### Requirement: No decision changes
The change SHALL NOT alter which transfers are recommended, their order, the bar, or the synthesis JSON contract.

#### Scenario: Recommendations unchanged
- **WHEN** the transfer replay (`research/squad-eval/transfer-replay.ts`) is re-run after the change and `vitest` runs
- **THEN** `transfer-report.md` is byte-identical to the committed file and all tests pass, with the `netGain` field name unchanged in `synthesis.ts`
