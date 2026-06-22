## ADDED Requirements

### Requirement: Wildcard window keys off a fixture swing or DGW setup
A Wildcard window SHALL be opened on a detected fixture swing (a team's FDR run improving materially) or to set up a near-term Double Gameweek — not merely because several upgrades are available.

#### Scenario: Fixture swing opens a window
- **WHEN** several of the manager's teams have a materially improving FDR run from a given gameweek
- **THEN** a Wildcard `window` is emitted at that gameweek

#### Scenario: Upgrade count alone does not
- **WHEN** there are several beneficial transfers but no fixture swing or DGW setup
- **THEN** no Wildcard window is opened on that basis

### Requirement: Expiry / half awareness and don't-hoard pressure
The generator SHALL encode the season chip calendar (two sets; first expires GW19, second unlocks GW20 and expires GW38; one chip per gameweek) and SHALL raise the urgency of the best remaining window as a half's deadline nears with an unused chip.

#### Scenario: Deadline pressure
- **WHEN** a first-half chip is unused and the GW19 deadline is approaching
- **THEN** the best remaining first-half window is surfaced with raised urgency ("use-it-or-lose-it")

### Requirement: Season-wide, confirmed-fixture detection
Double/Blank windows SHALL be detected across the remaining half (not only the next ~3 gameweeks), and only for confirmed (scheduled) fixtures.

#### Scenario: Window beyond the near term
- **WHEN** a Double Gameweek exists several gameweeks ahead
- **THEN** the corresponding chip window is detected, not missed by a short look-ahead

#### Scenario: Unscheduled gameweeks
- **WHEN** a future gameweek has no scheduled fixtures yet
- **THEN** no chip window is emitted for it (no invented Doubles/Blanks)
