## ADDED Requirements

### Requirement: Player data model
The system SHALL define a TypeScript type for FPL player data that includes all 73+ fields from the bootstrap-static `elements` array, organized into logical groups: identity, status, game data, raw stats, expected stats, per-90 stats, ICT index, set piece duties, and rank fields.

#### Scenario: Raw player from API
- **WHEN** the system receives a player object from the bootstrap-static API
- **THEN** the object conforms to the `FplPlayerRaw` type with all fields organized into logical groups:
  - **Identity**: `id`, `code`, `opta_code`, `first_name`, `second_name`, `web_name`, `known_name`, `photo`, `team`, `team_code`, `element_type`, `squad_number`
  - **Status**: `status`, `chance_of_playing_this_round`, `chance_of_playing_next_round`, `news`, `news_added`, `removed`, `can_transact`, `can_select`, `special`
  - **FPL game data**: `now_cost`, `cost_change_event`, `cost_change_event_fall`, `cost_change_start`, `cost_change_start_fall`, `price_change_percent`, `selected_by_percent`, `transfers_in`, `transfers_out`, `transfers_in_event`, `transfers_out_event`, `total_points`, `event_points`, `points_per_game`, `form`, `value_form`, `value_season`, `ep_next`, `ep_this`, `in_dreamteam`, `dreamteam_count`
  - **Raw season stats**: `minutes`, `starts`, `goals_scored`, `assists`, `clean_sheets`, `goals_conceded`, `own_goals`, `penalties_saved`, `penalties_missed`, `yellow_cards`, `red_cards`, `saves`, `bonus`, `bps`, `defensive_contribution`
  - **Expected stats (season totals)**: `expected_goals`, `expected_assists`, `expected_goal_involvements`, `expected_goals_conceded`
  - **Per-90 stats**: `expected_goals_per_90`, `expected_assists_per_90`, `expected_goal_involvements_per_90`, `expected_goals_conceded_per_90`, `goals_conceded_per_90`, `saves_per_90`, `starts_per_90`, `clean_sheets_per_90`, `defensive_contribution_per_90`
  - **ICT index**: `influence`, `creativity`, `threat`, `ict_index`, `influence_rank`, `influence_rank_type`, `creativity_rank`, `creativity_rank_type`, `threat_rank`, `threat_rank_type`, `ict_index_rank`, `ict_index_rank_type`
  - **Set piece duties**: `penalties_order`, `penalties_text`, `corners_and_indirect_freekicks_order`, `corners_and_indirect_freekicks_text`, `direct_freekicks_order`, `direct_freekicks_text`
  - **Rank fields**: `now_cost_rank`, `now_cost_rank_type`, `form_rank`, `form_rank_type`, `points_per_game_rank`, `points_per_game_rank_type`, `selected_rank`, `selected_rank_type`
  - **Scouting**: `scout_risks`, `scout_news_link`

### Requirement: Normalized player data model
The system SHALL define a `Player` type that normalizes raw API data into usable units. The normalized type SHALL include: `id` (element ID, for element-summary lookups and unique identification), `webName` (display name), `teamId` (raw numeric team ID, required for club rule validation — max 3 players from same team), `teamName` (resolved from team ID via teams array), `teamShortName` (3-letter abbreviation), `position` (mapped from element_type: 1=GK, 2=DEF, 3=MID, 4=FWD), `price` (now_cost ÷ 10, in £m), `form` (parsed to float), and all per-90 stats, raw season stats, ICT fields, market fields, and value fields passed through as numbers. The nested `availability` and `setPieceDuties` objects (defined in separate requirements) SHALL also be included.

#### Scenario: Price normalization
- **WHEN** a raw player has `now_cost: 125`
- **THEN** the normalized player has `price: 12.5`

#### Scenario: Position mapping
- **WHEN** a raw player has `element_type: 3`
- **THEN** the normalized player has `position: "MID"`

#### Scenario: Form parsing
- **WHEN** a raw player has `form: "8.2"` (string from API)
- **THEN** the normalized player has `form: 8.2` (number)

### Requirement: Player availability and news data model
The system SHALL include a structured `availability` object on the normalized `Player` type that groups all injury, news, and availability signals for downstream consumption by the LLM context node. The object SHALL contain: `status` (a/d/i/s/u mapped to "available", "doubtful", "injured", "suspended", "unavailable"), `chanceOfPlayingThis` (number or null, 0–100), `chanceOfPlayingNext` (number or null, 0–100), `news` (string — raw injury/availability text from the API), `newsAdded` (ISO timestamp string or null — when the news was last updated), `scoutRisks` (string or null — scout-flagged risk notes), and `scoutNewsLink` (string or null — link to scout article).

#### Scenario: Injured player with news
- **WHEN** a raw player has `status: "i"`, `news: "Hamstring injury - expected back in 3 weeks"`, `news_added: "2025-12-10T14:30:00Z"`, `chance_of_playing_next_round: 0`
- **THEN** the normalized player's `availability` object contains `status: "injured"`, `chanceOfPlayingNext: 0`, `news: "Hamstring injury - expected back in 3 weeks"`, `newsAdded: "2025-12-10T14:30:00Z"`

#### Scenario: Doubtful player with partial chance
- **WHEN** a raw player has `status: "d"`, `news: "Knock - 75% chance of playing"`, `chance_of_playing_next_round: 75`
- **THEN** the normalized player's `availability` object contains `status: "doubtful"`, `chanceOfPlayingNext: 75`, `news: "Knock - 75% chance of playing"`

#### Scenario: Fully available player
- **WHEN** a raw player has `status: "a"`, `news: ""`, `chance_of_playing_next_round: null`
- **THEN** the normalized player's `availability` object contains `status: "available"`, `chanceOfPlayingNext: null`, `news: ""`

#### Scenario: Suspended player
- **WHEN** a raw player has `status: "s"`, `news: "Suspended for 3 matches"`
- **THEN** the normalized player's `availability` object contains `status: "suspended"`, `news: "Suspended for 3 matches"`

### Requirement: Player set piece duties data model
The system SHALL include a structured `setPieceDuties` object on the normalized `Player` type that groups penalty, corner, and direct free kick responsibilities. Each duty SHALL contain `order` (number or null — 1 = first choice, null = not assigned) and `text` (string or null — descriptive text from the API such as "First choice" or "If [other player] unavailable").

#### Scenario: First-choice penalty taker
- **WHEN** a raw player has `penalties_order: 1`, `penalties_text: "First choice"`
- **THEN** the normalized player's `setPieceDuties.penalties` contains `order: 1`, `text: "First choice"`

#### Scenario: No set piece duties
- **WHEN** a raw player has `penalties_order: null`, `corners_and_indirect_freekicks_order: null`, `direct_freekicks_order: null`
- **THEN** the normalized player's `setPieceDuties` contains all null orders

#### Scenario: Corner taker
- **WHEN** a raw player has `corners_and_indirect_freekicks_order: 1`, `corners_and_indirect_freekicks_text: "Takes corners from both sides"`
- **THEN** the normalized player's `setPieceDuties.corners` contains `order: 1`, `text: "Takes corners from both sides"`

### Requirement: Team set piece notes data model
The system SHALL define a `TeamSetPieceNotes` type containing `teamId` (number) and `notes` (array of `info_message` strings from the `/team/set-piece-notes/` endpoint). This data provides free-text context about penalty hierarchies and set piece responsibilities that the LLM context node SHALL use for reasoning about set piece value.

#### Scenario: Team with penalty hierarchy note
- **WHEN** the set-piece-notes API returns `{"id": 12, "notes": [{"info_message": "Mohamed Salah took 12 Liverpool penalties in all competitions in 2024/25, scoring all but one of them."}]}`
- **THEN** the `TeamSetPieceNotes` object contains `teamId: 12` and `notes: ["Mohamed Salah took 12 Liverpool penalties in all competitions in 2024/25, scoring all but one of them."]`

#### Scenario: Team with no notes
- **WHEN** the set-piece-notes API returns `{"id": 5, "notes": []}`
- **THEN** the `TeamSetPieceNotes` object contains `teamId: 5` and `notes: []`

### Requirement: Team data model
The system SHALL define a TypeScript type for FPL team data including `id`, `name`, `short_name`, `strength`, `strength_overall_home`, `strength_overall_away`, `strength_attack_home`, `strength_attack_away`, `strength_defence_home`, `strength_defence_away`, `played`, `win`, `draw`, `loss`, `points`, `position`, and `form`.

#### Scenario: Team lookup by ID
- **WHEN** a player has `team: 12`
- **THEN** the system resolves this to the team object with `name: "Liverpool"` (or whichever team has ID 12)

### Requirement: Fixture data model
The system SHALL define a TypeScript type for fixtures including `id`, `event` (gameweek number), `team_h`, `team_a`, `team_h_difficulty`, `team_a_difficulty`, `team_h_score`, `team_a_score`, `kickoff_time`, `finished`, and `stats`.

#### Scenario: FDR extraction
- **WHEN** a fixture has `team_h: 12`, `team_a: 1`, `team_h_difficulty: 3`, `team_a_difficulty: 4`
- **THEN** the home team faces FDR 3 and the away team faces FDR 4

### Requirement: Gameweek data model
The system SHALL define a TypeScript type for gameweek data including `id`, `name`, `deadline_time`, `finished`, `is_previous`, `is_current`, `is_next`, `most_captained`, `most_selected`, `most_transferred_in`, `top_element`, `average_entry_score`, and `highest_score`.

#### Scenario: Current gameweek identification
- **WHEN** the events array contains a gameweek with `is_current: true`
- **THEN** that gameweek's `id` is the current gameweek number

### Requirement: Manager entry data model
The system SHALL define a TypeScript type for manager data including `id`, `player_first_name`, `player_last_name`, `name` (team name), `summary_overall_points`, `summary_overall_rank`, `current_event`, `last_deadline_bank`, and `last_deadline_value`.

#### Scenario: Bank normalization
- **WHEN** a manager entry has `last_deadline_bank: 15`
- **THEN** the normalized value is `bank: 1.5` (£m)

#### Scenario: Squad value normalization
- **WHEN** a manager entry has `last_deadline_value: 1023`
- **THEN** the normalized value is `squadValue: 102.3` (£m)

### Requirement: Picks data model
The system SHALL define a TypeScript type for the picks response including `picks` (array of 15 objects with `element`, `position`, `multiplier`, `is_captain`, `is_vice_captain`, `element_type`), `entry_history` (with `bank`, `value`, `event_transfers`, `event_transfers_cost`, `points_on_bench`), and `active_chip`.

#### Scenario: Captain identification
- **WHEN** a pick has `is_captain: true` and `multiplier: 2`
- **THEN** that player is the current captain

#### Scenario: Bench identification
- **WHEN** a pick has `position: 12`, `13`, `14`, or `15`
- **THEN** that player is on the bench (not in starting 11)

### Requirement: Player gameweek history data model
The system SHALL define a TypeScript type for per-gameweek player history entries from the element-summary endpoint, including `round`, `total_points`, `minutes`, `goals_scored`, `assists`, `expected_goals`, `expected_assists`, `expected_goal_involvements`, `expected_goals_conceded`, `clean_sheets`, `goals_conceded`, `saves`, `bonus`, `bps`, `influence`, `creativity`, `threat`, `starts`, `was_home`, `opponent_team`, `value`, `yellow_cards`, `red_cards`, `own_goals`, `penalties_saved`, `penalties_missed`, `defensive_contribution`, `transfers_balance`, `selected`, `transfers_in`, and `transfers_out`.

#### Scenario: Rolling calculation support
- **WHEN** the system has 5 or more gameweek history entries for a player
- **THEN** rolling averages and slopes can be computed over the last 5 entries for `expected_goals`, `goals_scored`, `expected_assists`, `assists`, `expected_goals_conceded`, `clean_sheets`, `saves`, `bps`, `starts`, and `defensive_contribution`

#### Scenario: Per-GW regression analysis support
- **WHEN** the system has per-GW `expected_goals` and `goals_scored` for a player
- **THEN** the per-GW gap (`goals_scored - expected_goals`) can be computed for each gameweek to determine if the overperformance gap is widening, stable, or narrowing

#### Scenario: Suspension risk tracking
- **WHEN** the system has per-GW `yellow_cards` for a player
- **THEN** cumulative yellow cards can be tracked to flag players approaching the 5-card (first threshold) or 10-card suspension thresholds

### Requirement: Player past season data model
The system SHALL define a TypeScript type for per-season historical data from the element-summary `history_past` array, including `season_name`, `total_points`, `minutes`, `goals_scored`, `expected_goals`, `assists`, `expected_assists`, `starts`, and `start_cost` / `end_cost`.

#### Scenario: Finisher premium detection
- **WHEN** a player's `history_past` shows `goals_scored > expected_goals` for 3 or more seasons
- **THEN** the player qualifies for the elite finisher premium flag
