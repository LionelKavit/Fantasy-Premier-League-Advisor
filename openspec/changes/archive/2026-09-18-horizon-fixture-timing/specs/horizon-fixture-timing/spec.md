## ADDED Requirements

### Requirement: Timing is decided by the per-gameweek fixture edge
For each horizon entry the system SHALL compute `fixtureEdge[k] = effective(weakFdr_k) − effective(candidateFdr_k)` for the target gameweek and the four after it, where `effective` is the difficulty for a single fixture, the mean difficulty minus `dgwBonusSteps` for a double, and `blankPenaltyFdr` for a blank. With `nearEdge` the mean over the first `nearGws` gameweeks and `farEdge` the mean over the rest, timing SHALL be `WAIT` when `nearEdge < farEdge − thresholdSteps` or the candidate blanks in the target gameweek, `SHORT_TERM` when `nearEdge > farEdge + thresholdSteps`, and `BUY_NOW` otherwise. The constants SHALL live in `lib/config.ts` as `HORIZON_TIMING` and SHALL NOT be adjustable at runtime.

#### Scenario: Candidate's hard weeks come first
- **WHEN** the candidate's difficulties are 2,5,3,2,3 and the weak player's are 3,3,3,4,3
- **THEN** `fixtureEdge` is 1,−2,0,2,0, `nearEdge` −0.5, `farEdge` 0.67, and timing is `WAIT`

#### Scenario: Candidate's edge fades
- **WHEN** the candidate's difficulties are 3,3,4,5,3 and the weak player's are 3,3,4,2,4
- **THEN** `fixtureEdge` is 0,0,0,−3,1 and timing is `SHORT_TERM`

#### Scenario: Steady edge
- **WHEN** both sides have identical difficulties in every gameweek
- **THEN** every edge is 0 and timing is `BUY_NOW`

#### Scenario: Blank and double
- **WHEN** the candidate blanks in the target gameweek
- **THEN** timing is `WAIT` regardless of later edges
- **WHEN** the candidate has a double in a gameweek (difficulties 3 and 3) and the weak player a single of 3
- **THEN** that gameweek's edge equals `dgwBonusSteps`

### Requirement: Swaps that never gain are dropped
An entry whose cumulative composite gain over the window is not positive SHALL be omitted from the horizon rather than labelled.

#### Scenario: Negative gain
- **WHEN** a valid transfer's five-gameweek cumulative gain is ≤ 0
- **THEN** it does not appear in the horizon

### Requirement: One entry per candidate, one per position first
After ranking by composite `gw1Gain` (unchanged), the horizon SHALL keep only the highest-ranked entry for each candidate, SHALL select the best entry per position first, and SHALL backfill from the remaining ranked entries up to five.

#### Scenario: Duplicate candidate
- **WHEN** the same candidate is a valid transfer for two weak players
- **THEN** only the pairing with the higher `gw1Gain` appears

#### Scenario: Positional spread with backfill
- **WHEN** the ranked, deduped list is GK, GK, GK, DEF, MID, FWD, DEF (by gain)
- **THEN** the board is GK, DEF, MID, FWD, then GK (backfill) — five entries, no position repeated until every qualifying position has one

#### Scenario: Fewer than five qualify
- **WHEN** only three entries survive the level gate and dedupe
- **THEN** the board has three entries

### Requirement: The sparkline shows the fixture edge
`HorizonSparkline` SHALL plot `fixtureEdge` with a zero baseline, colour by timing, and use glosses that describe fixtures; the `fixture swing` badge SHALL be removed.

#### Scenario: Rendering
- **WHEN** an entry with `fixtureEdge` 1,−2,0,2,0 is rendered
- **THEN** the sparkline has five points crossing the zero line and the label reads `Wait` with its fixture gloss

### Requirement: Entry shape and prompt
`HorizonEntry` SHALL carry `fixtureEdge`, `nearEdge`, `farEdge`, `timing ∈ {BUY_NOW, WAIT, SHORT_TERM}`, `gwScores` and `cumulativeGain`, and SHALL NOT carry `fixtureSwing`; the optimizer synthesis prompt SHALL serialise `timing`, `nearEdge`, `farEdge`, `fixtureEdge` and `cumulativeGain`.

#### Scenario: Type and prompt
- **WHEN** `tsc` runs and the synthesis prompt is built
- **THEN** no reference to `fixtureSwing` or `BUY_NOW_SELL_LATER` remains and the prompt's horizon block contains the edge fields

### Requirement: Nothing else changes
The change SHALL NOT alter the transfer recommendation, captaincy, the captain horizon, scoring, or the replays.

#### Scenario: Invariance
- **WHEN** `vitest` runs and both research replays are re-run
- **THEN** all tests pass and `report.md` / `transfer-report.md` are byte-identical
