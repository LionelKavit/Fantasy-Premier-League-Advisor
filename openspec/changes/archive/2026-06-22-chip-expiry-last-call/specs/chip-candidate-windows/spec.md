## ADDED Requirements

### Requirement: Last-call windows on the chip deadline gameweek
When the current gameweek is the half's chip deadline (the last gameweek a held chip can be played), the deterministic layer SHALL emit a candidate `window` at the current gameweek for each held chip that has real last-gameweek value and does not already have a window. These entries SHALL be `status: "window"` (never auto-activated), so the orchestrator may promote one to `play-now` and, keyless, the Chips tab shows them with the expiry reason while This Week stays inactive.

#### Scenario: Bench Boost surfaced on the final gameweek
- **WHEN** the current gameweek is the chip deadline, the manager holds Bench Boost with no fixture window, and the bench has positive projected value
- **THEN** a Bench Boost `window` is emitted at the current gameweek, carrying the expiry urgency

#### Scenario: Triple Captain surfaced on the final gameweek
- **WHEN** the current gameweek is the chip deadline and the manager holds Triple Captain with no window
- **THEN** a Triple Captain `window` is emitted at the current gameweek

#### Scenario: Free Hit / Wildcard only when they salvage points
- **WHEN** the current gameweek is the chip deadline and the manager holds Free Hit or Wildcard
- **THEN** a window is emitted only if the starting XI has an availability hole to patch; with a fully fit XI no Free Hit / Wildcard window is emitted

#### Scenario: Not the deadline gameweek
- **WHEN** the current gameweek is not the chip deadline
- **THEN** no last-call windows are emitted and existing forward-looking behaviour is unchanged

#### Scenario: Does not duplicate an existing window
- **WHEN** a chip already has a fixture-driven window
- **THEN** last-call does not add a second window for that chip
