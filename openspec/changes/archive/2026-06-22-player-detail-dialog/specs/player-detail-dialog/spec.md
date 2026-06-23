## ADDED Requirements

### Requirement: Player detail dialog

The system SHALL open a player detail dialog when the manager clicks a player on the pitch or a player name in the This-Week transfer recommendation. The dialog SHALL show the player's name, age, nationality, FPL form, minutes and points last week, and expected next points, derived from FPL data, and SHALL be dismissable via a close button, backdrop click, and Escape.

#### Scenario: Opening the dialog from the pitch

- **WHEN** the manager clicks a player token on the pitch
- **THEN** a dialog opens showing that player's name, age, nationality, form, last-week minutes and points, and expected next points

#### Scenario: Opening the dialog from a transfer recommendation

- **WHEN** the manager clicks a player name in the This-Week transfer recommendation
- **THEN** the dialog opens for that player (squad member or transfer target)

#### Scenario: Minutes-last-week not yet available

- **WHEN** the dialog is opened before the insights phase has warmed the element-summary data
- **THEN** the dialog renders all other fields and shows the minutes-last-week value as a placeholder ("—") without error

#### Scenario: Unmapped nationality

- **WHEN** the player's `region` id is not mapped to a country
- **THEN** the dialog omits the nationality row rather than showing a wrong or broken value

### Requirement: View on Premier League link

The dialog SHALL provide a "View on Premier League" action linking to `https://www.premierleague.com/en/players/{optaId}/{slug}/overview`, where `optaId` is derived from the player's FPL `opta_code` and `slug` is derived from the player's full name, opened in a new tab with `rel="noopener noreferrer"`. When the player's Opta id is missing or malformed, the action SHALL be hidden rather than producing a broken link.

#### Scenario: Player with a valid Opta id

- **WHEN** a player whose `opta_code` is `"p223094"` and full name is "Erling Haaland" is shown in the dialog
- **THEN** the "View on Premier League" action links to `https://www.premierleague.com/en/players/223094/erling-haaland/overview`

#### Scenario: Player with a missing Opta id

- **WHEN** a player in the dialog has no usable `opta_code`
- **THEN** the "View on Premier League" action is not shown and no error occurs

### Requirement: FPL-aligned visual presentation

The dialog SHALL present its stats in the data-forward FPL style: stat values rendered as large, extrabold, tabular figures with small uppercase labels, the player's position/team/price subtitle accented, and the forward-looking projection (expected next points) visually emphasised. The "View on Premier League" action SHALL be a pill-shaped button with an external-link affordance. (Outcome of the design review.)

#### Scenario: Stats read as a premium sports dashboard

- **WHEN** the dialog shows a player's stats
- **THEN** the values are large extrabold tabular numbers with small uppercase labels, and the expected-next-points value is accented to stand out as the headline metric

### Requirement: Player detail served from warm cache

The system SHALL serve the player detail via a dedicated endpoint that reuses the existing element-summary fetch (cached by player id). For a player already analyzed in the current gameweek (squad member or candidate), the endpoint SHALL NOT make a redundant FPL request; only an unanalyzed player or an expired cache SHALL trigger a single fetch. The dialog SHALL cache the returned detail client-side per id so re-opening is instant.

#### Scenario: Detail for an analyzed player

- **WHEN** the dialog requests detail for a squad or candidate player whose element-summary is already cached
- **THEN** the endpoint returns the merged detail without issuing a new FPL element-summary request

#### Scenario: Re-opening the dialog for the same player

- **WHEN** the manager re-opens the dialog for a player whose detail was already fetched in this session
- **THEN** the dialog renders from the client-side cache without a new request
