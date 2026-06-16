## ADDED Requirements

### Requirement: Fetch bootstrap-static data
The system SHALL fetch all player, team, and gameweek data from `https://fantasy.premierleague.com/api/bootstrap-static/` and return the parsed JSON response containing `elements` (players), `teams`, `events` (gameweeks), and `element_types` (positions).

#### Scenario: Successful bootstrap fetch
- **WHEN** the fetch node requests bootstrap data
- **THEN** the system returns an object containing `elements` (array of 500+ player objects with 73+ fields each), `teams` (array of 20 team objects), `events` (array of 38 gameweek objects), and `element_types` (array of 4 position type objects)

#### Scenario: Bootstrap data is cached
- **WHEN** the bootstrap endpoint was fetched less than 1 hour ago
- **THEN** the system returns the cached response without making a new HTTP request

### Requirement: Fetch manager entry data
The system SHALL fetch manager profile data from `https://fantasy.premierleague.com/api/entry/{team_id}/` given a numeric FPL team ID, returning the manager's name, overall points, rank, last deadline bank, and last deadline value.

#### Scenario: Valid team ID
- **WHEN** the system fetches entry data for a valid team ID
- **THEN** the system returns an object containing `player_first_name`, `player_last_name`, `name` (team name), `summary_overall_points`, `summary_overall_rank`, `last_deadline_bank`, `last_deadline_value`, `current_event`, and `entered_events`

#### Scenario: Invalid team ID
- **WHEN** the system fetches entry data for a non-existent team ID
- **THEN** the system returns an error indicating the team was not found

### Requirement: Fetch manager picks for a gameweek
The system SHALL fetch the manager's squad for a specific gameweek from `https://fantasy.premierleague.com/api/entry/{team_id}/event/{gw}/picks/` returning the 15 selected players, captain choice, active chip, and entry history for that gameweek.

#### Scenario: Successful picks fetch
- **WHEN** the system fetches picks for a valid team ID and gameweek
- **THEN** the system returns `picks` (array of 15 objects each with `element`, `position`, `multiplier`, `is_captain`, `is_vice_captain`, `element_type`), `entry_history` (with `bank`, `value`, `event_transfers`, `event_transfers_cost`), `active_chip` (null or chip name), and `automatic_subs`

#### Scenario: Gameweek not yet played
- **WHEN** the system fetches picks for a gameweek that has not started
- **THEN** the system returns an error or empty response

### Requirement: Fetch manager season history
The system SHALL fetch the manager's full season history from `https://fantasy.premierleague.com/api/entry/{team_id}/history/` returning per-gameweek performance, chips used, and past season records.

#### Scenario: Successful history fetch
- **WHEN** the system fetches history for a valid team ID
- **THEN** the system returns `current` (array of per-GW objects with `event`, `points`, `total_points`, `rank`, `overall_rank`, `bank`, `value`, `event_transfers`, `event_transfers_cost`, `points_on_bench`), `chips` (array of chip usage objects), and `past` (array of prior season summaries)

#### Scenario: Derive chips remaining
- **WHEN** the system processes the history response
- **THEN** the chips used can be determined from the `chips` array, and remaining chips derived by subtracting from the full set: wildcard (×2), free_hit, bench_boost, triple_captain

### Requirement: Fetch all fixtures
The system SHALL fetch all Premier League fixtures from `https://fantasy.premierleague.com/api/fixtures/` returning match schedule, results, fixture difficulty ratings, and per-match stats.

#### Scenario: Successful fixtures fetch
- **WHEN** the system fetches fixtures
- **THEN** the system returns an array of fixture objects each containing `event` (gameweek), `team_h`, `team_a`, `team_h_score`, `team_a_score`, `team_h_difficulty`, `team_a_difficulty`, `kickoff_time`, `finished`, and `stats` (array of per-match stat breakdowns including goals_scored, assists, bonus, saves, cards)

#### Scenario: Fixtures for a specific gameweek
- **WHEN** the system fetches fixtures with `?event={gw}` parameter
- **THEN** the system returns only fixtures for that gameweek

### Requirement: Fetch player element summary
The system SHALL fetch per-gameweek history and past seasons for a specific player from `https://fantasy.premierleague.com/api/element-summary/{element_id}/` given a player's element ID.

#### Scenario: Successful element summary fetch
- **WHEN** the system fetches element summary for a valid player ID
- **THEN** the system returns `history` (array of per-GW objects with `total_points`, `minutes`, `goals_scored`, `assists`, `expected_goals`, `expected_assists`, `expected_goal_involvements`, `bonus`, `bps`, `influence`, `creativity`, `threat`, `starts`, `value`, `was_home`, `opponent_team`, `round`), `history_past` (array of season summaries with `season_name`, `total_points`, `expected_goals`, `goals_scored`), and `fixtures` (upcoming fixtures)

### Requirement: Fetch live gameweek data
The system SHALL fetch live stats for all players in a specific gameweek from `https://fantasy.premierleague.com/api/event/{gw}/live/` returning real-time points and stats.

#### Scenario: Successful live data fetch
- **WHEN** the system fetches live data for a finished or in-progress gameweek
- **THEN** the system returns `elements` (array of objects each with `id`, `stats` containing `total_points`, `minutes`, `goals_scored`, `assists`, `expected_goals`, `expected_assists`, `bonus`, `bps`, and `explain` array with per-fixture point breakdowns)

### Requirement: Fetch set piece notes
The system SHALL fetch team-level set piece and penalty information from `https://fantasy.premierleague.com/api/team/set-piece-notes/` returning free-text notes per team about penalty taker hierarchies.

#### Scenario: Successful set piece notes fetch
- **WHEN** the system fetches set piece notes
- **THEN** the system returns `teams` (array of objects each with `id` and `notes` array containing `info_message` free-text strings describing penalty and set piece hierarchies) and `last_updated` timestamp

### Requirement: Cache all API responses
The system SHALL cache every FPL API response for 1 hour (3600 seconds) to minimize redundant network requests. The cache key SHALL be the full request URL.

#### Scenario: Cache hit within TTL
- **WHEN** the same endpoint is requested within 1 hour of a previous successful fetch
- **THEN** the system returns the cached data without making a network request

#### Scenario: Cache miss after TTL expiry
- **WHEN** the same endpoint is requested after 1 hour since the last fetch
- **THEN** the system makes a fresh network request, caches the new response, and returns it

#### Scenario: Cache is per-URL
- **WHEN** `/api/element-summary/1/` is cached but `/api/element-summary/2/` is not
- **THEN** fetching element summary for player 2 makes a network request while player 1 returns cached data

### Requirement: All requests are server-side only
The system SHALL make all FPL API requests from the server (Next.js API routes or server components), never from client-side browser JavaScript, due to the FPL API's CORS policy that blocks cross-origin browser requests.

#### Scenario: Client requests data
- **WHEN** the frontend React component needs FPL data
- **THEN** the component calls an internal Next.js API route (e.g., `/api/bootstrap`), which fetches from `fantasy.premierleague.com` server-side and returns the data

#### Scenario: Direct browser fetch blocked
- **WHEN** browser JavaScript attempts to fetch `fantasy.premierleague.com` directly
- **THEN** the request is blocked by CORS and no data is returned
