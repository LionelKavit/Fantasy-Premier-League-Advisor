## ADDED Requirements

### Requirement: Player exposes team code
The normalized `Player` SHALL include `teamCode` (number), mapped from the raw FPL API field `team_code`. It is used by the UI to construct club-shirt image URLs.

#### Scenario: Mapped from the raw payload
- **WHEN** a raw FPL player with `team_code: 3` is normalized
- **THEN** the resulting `Player.teamCode` is 3

#### Scenario: Available everywhere Player is
- **WHEN** any pipeline or API surface returns a `Player` (bootstrap, squad analysis, scored players)
- **THEN** `teamCode` is present alongside the existing identity fields (no separate lookup required)
