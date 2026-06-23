## ADDED Requirements

### Requirement: FPL transfers handoff

The system SHALL provide a primary action — hosted at the end of the verdict bar — that opens the official FPL transfers screen (`https://fantasy.premierleague.com/transfers`) in a new tab with `rel="noopener noreferrer"`, so the manager lands on the screen where the recommended move is executed. The action SHALL be available whenever a plan is loaded, including before LLM insights arrive and in keyless mode. Because FPL exposes no public write API, the system SHALL hand off only — it SHALL NOT attempt to execute transfers or pre-fill the in/out players.

#### Scenario: Manager opens the transfers screen

- **WHEN** a plan is loaded and the manager activates "Open FPL Transfers"
- **THEN** the FPL transfers screen opens in a new browser tab with `rel="noopener noreferrer"`

#### Scenario: Handoff available before insights

- **WHEN** the deterministic base plan has painted but LLM insights have not yet arrived
- **THEN** the "Open FPL Transfers" action is still present and functional

### Requirement: Player detail dialog

The system SHALL open a player detail dialog when the manager clicks a player on the pitch or a player name in the This-Week transfer recommendation. The dialog SHALL show the player's name, age, nationality, FPL form, minutes and points last week, and expected next points, derived from FPL data, and SHALL provide a "View on Premier League" action linking to that player's premierleague.com profile. The dialog SHALL be dismissable (close button, backdrop click, and Escape).

#### Scenario: Opening the dialog from the pitch

- **WHEN** the manager clicks a player token on the pitch
- **THEN** a dialog opens showing that player's name, age, nationality, form, last-week minutes and points, and expected next points

#### Scenario: Opening the dialog from a transfer recommendation

- **WHEN** the manager clicks a player name in the This-Week transfer recommendation
- **THEN** the dialog opens for that player (squad member or transfer target)

#### Scenario: Minutes-last-week not yet available

- **WHEN** the dialog is opened before the insights phase has warmed the element-summary data
- **THEN** the dialog renders all other fields and shows the minutes-last-week value as a placeholder ("—") without error

### Requirement: View on Premier League link

The dialog SHALL provide a "View on Premier League" action linking to `https://www.premierleague.com/en/players/{optaId}/{slug}/overview`, where `optaId` is derived from the player's FPL `opta_code` and `slug` is derived from the player's full name, opened in a new tab with `rel="noopener noreferrer"`. When the player's Opta id is missing or malformed, the action SHALL be hidden rather than producing a broken link.

#### Scenario: Player with a valid Opta id

- **WHEN** a player whose `opta_code` is `"p223094"` and full name is "Erling Haaland" is shown in the dialog
- **THEN** the "View on Premier League" action links to `https://www.premierleague.com/en/players/223094/erling-haaland/overview`

#### Scenario: Player with a missing Opta id

- **WHEN** a player in the dialog has no usable `opta_code`
- **THEN** the "View on Premier League" action is not shown and no error occurs

### Requirement: Player detail served from warm cache

The system SHALL serve the player detail via a dedicated endpoint that reuses the existing element-summary fetch (cached by player id). For a player already analyzed in the current gameweek (squad member or candidate), the endpoint SHALL NOT make a redundant FPL request; only an unanalyzed player or an expired cache SHALL trigger a single fetch.

#### Scenario: Detail for an analyzed player

- **WHEN** the dialog requests detail for a squad or candidate player whose element-summary is already cached
- **THEN** the endpoint returns the merged detail without issuing a new FPL element-summary request
