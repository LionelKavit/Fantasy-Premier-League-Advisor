## ADDED Requirements

The "Long Term Strategy" lens also splits across columns: **left = a deterministic prose summary**, **right = the structured horizon + chip detail**. All from existing `GameweekPlan` data (`transfers.horizon`, `transfers.chipPlan`, `captaincy.tripleCaptainAdvice`, `chipsRemaining`, `currentGw`) — **no backend**.

### Requirement: Deterministic long-term summary (left column)
The left prose zone SHALL present a readable summary composed client-side from the structured long-term data (no LLM call).

#### Scenario: Composed from data
- **WHEN** the Long Term lens is active and there is content to summarize
- **THEN** the left zone shows a short paragraph stitched from the data — e.g. the strongest upcoming transfer target and its timing, and the recommended chip window(s) with the held chips — reading naturally and working offline

#### Scenario: Reasoned empty prose
- **WHEN** there is nothing to plan (no horizon and no chip recommendations)
- **THEN** the left summary degrades to a reasoned sentence explaining why (e.g. final gameweek, or squad well set with chips spent)

> A genuine LLM-written long-term narrative is deferred to a later backend change (a `longTermNarrative` synthesis field); this deterministic summary remains the offline fallback.

### Requirement: Horizon detail (right column)
#### Scenario: Sparkline per target
- **WHEN** a horizon entry exists
- **THEN** the right column renders an inline-SVG sparkline of its `cumulativeGain` across GW+1..+5 with a zero baseline, labelled candidate (in) and replaced player (out)

#### Scenario: Timing badge and fixture swing
- **WHEN** rendering a horizon entry
- **THEN** it shows the `timing` as a badge (BUY_NOW / WAIT / BUY_NOW_SELL_LATER) and flags `fixtureSwing` when true

### Requirement: Chip timeline (right column)
#### Scenario: Recommended windows
- **WHEN** `chipPlan` (and/or `tripleCaptainAdvice`) recommends a chip
- **THEN** a gameweek axis marks each recommended chip at its `triggerGw` with name + reason

#### Scenario: Chips-remaining status
- **WHEN** the timeline renders
- **THEN** a status row shows which chips remain from `chipsRemaining`

### Requirement: Reasoned empty states (right column)
When a right-column section is empty it SHALL explain **why**, inferred from the data.

#### Scenario: Horizon empty at the final gameweek
- **WHEN** `horizon` is empty AND it is the final gameweek
- **THEN** the horizon section explains there are no upcoming gameweeks left to plan transfers around

#### Scenario: Horizon empty mid-season
- **WHEN** `horizon` is empty AND gameweeks remain
- **THEN** it explains no transfer target projects a gain over the next 5 gameweeks

#### Scenario: No chips remaining
- **WHEN** all `chipsRemaining` counts are 0
- **THEN** the chip section explains all chips have been used this season

#### Scenario: Chips remain but no window
- **WHEN** chips remain but `chipPlan` recommends none
- **THEN** it names the chips held and explains no upcoming gameweek clears the bar yet

### Requirement: Rendering constraints
#### Scenario: No charting library
- **WHEN** sparklines and the chip axis render
- **THEN** they use inline SVG / CSS only

#### Scenario: Accessibility
- **WHEN** a sparkline or chip marker is shown
- **THEN** its meaning is available as text (timing label, gain values, chip name), not colour/shape alone
