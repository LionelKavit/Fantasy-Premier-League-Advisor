## ADDED Requirements

### Requirement: Detect current gameweek
The system SHALL determine the current gameweek from the bootstrap-static `events` array by finding the event where `is_current` is true. If no gameweek has `is_current: true` (e.g., between seasons), the system SHALL fall back to the event where `is_next` is true, or the last event where `finished` is true.

#### Scenario: Mid-season detection
- **WHEN** the events array contains an event with `is_current: true` and `id: 28`
- **THEN** the system identifies gameweek 28 as the current gameweek

#### Scenario: Between gameweeks
- **WHEN** no event has `is_current: true` but event 29 has `is_next: true`
- **THEN** the system identifies gameweek 29 as the current gameweek

#### Scenario: Season ended
- **WHEN** all events have `finished: true` and none have `is_current: true` or `is_next: true`
- **THEN** the system identifies gameweek 38 as the current gameweek

### Requirement: Compute per-team fixture counts per gameweek
The system SHALL compute, for each upcoming gameweek and each team, how many fixtures that team plays in that gameweek. A team playing 0 fixtures indicates a blank gameweek for that team. A team playing 2 fixtures indicates a double gameweek for that team.

#### Scenario: Normal gameweek
- **WHEN** team 12 appears in exactly 1 fixture in gameweek 30 (either as `team_h` or `team_a`)
- **THEN** the fixture count for team 12 in gameweek 30 is 1

#### Scenario: Team blanks in a gameweek
- **WHEN** team 5 does not appear in any fixture in gameweek 33
- **THEN** the fixture count for team 5 in gameweek 33 is 0

#### Scenario: Team has double gameweek
- **WHEN** team 1 appears in 2 fixtures in gameweek 31 (as `team_h` in one and `team_a` in another)
- **THEN** the fixture count for team 1 in gameweek 31 is 2

### Requirement: Detect blank gameweeks
The system SHALL flag a gameweek as a BGW (blank gameweek) when 4 or more teams have 0 fixtures in that gameweek. The system SHALL return a list of all BGW gameweek numbers and the affected teams.

#### Scenario: BGW detected
- **WHEN** gameweek 33 has 6 teams with 0 fixtures
- **THEN** the system flags gameweek 33 as a BGW and lists the 6 teams that blank

#### Scenario: Minor blank not flagged as BGW
- **WHEN** gameweek 29 has 2 teams with 0 fixtures
- **THEN** the system does NOT flag gameweek 29 as a BGW (below the 4-team threshold) but still records the individual team blanks

### Requirement: Detect double gameweeks
The system SHALL flag a gameweek as a DGW (double gameweek) when 4 or more teams have 2 fixtures in that gameweek. The system SHALL return a list of all DGW gameweek numbers and the affected teams.

#### Scenario: DGW detected
- **WHEN** gameweek 31 has 8 teams with 2 fixtures
- **THEN** the system flags gameweek 31 as a DGW and lists the 8 teams that double

#### Scenario: Minor double not flagged as DGW
- **WHEN** gameweek 27 has 2 teams with 2 fixtures
- **THEN** the system does NOT flag gameweek 27 as a DGW (below the 4-team threshold) but still records the individual team doubles

### Requirement: Compute FDR run per team
The system SHALL compute, for each team, an array of fixture difficulty ratings (FDR 1–5) for the next N upcoming gameweeks (where N is configurable, default 5). For home fixtures, use `team_h_difficulty`. For away fixtures, use `team_a_difficulty`. For blank gameweeks, the FDR SHALL be represented as `null`. For double gameweeks, both fixtures' FDR values SHALL be included.

#### Scenario: Normal 5-gameweek run
- **WHEN** team 1 has upcoming fixtures with FDR values 2, 4, 3, 2, 5
- **THEN** the system returns the FDR run as `[2, 4, 3, 2, 5]` with an average of 3.2

#### Scenario: FDR run with blank gameweek
- **WHEN** team 1 has FDR values 2, null, 3, 2, 5 (blank in GW+2)
- **THEN** the system returns the FDR run as `[2, null, 3, 2, 5]` and computes the average over non-null values only (3.0)

#### Scenario: FDR run with double gameweek
- **WHEN** team 1 has a DGW in GW+3 with FDR 2 and FDR 3
- **THEN** the system returns the FDR run as `[2, 4, [2, 3], 2, 5]` and includes both FDR values for that gameweek

### Requirement: Compute upcoming fixture details per player
The system SHALL derive, for each player, their next N upcoming fixtures with opponent team name, FDR, and home/away indicator by cross-referencing the player's `team` field with the fixtures array.

#### Scenario: Player fixture list
- **WHEN** player with `team: 12` has upcoming fixtures: GW29 vs team 1 (away, FDR 4), GW30 vs team 5 (home, FDR 2), GW31 vs team 8 (away, FDR 3)
- **THEN** the system returns `[{gw: 29, opponent: 1, fdr: 4, isHome: false}, {gw: 30, opponent: 5, fdr: 2, isHome: true}, {gw: 31, opponent: 8, fdr: 3, isHome: false}]`
