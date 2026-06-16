## ADDED Requirements

### Requirement: Bootstrap proxy route
The system SHALL expose a `GET /api/bootstrap` route that fetches bootstrap-static data from the FPL API, normalizes player and team data, and returns the result. This route serves as the primary data source for the frontend.

#### Scenario: Successful bootstrap request
- **WHEN** the frontend calls `GET /api/bootstrap`
- **THEN** the route returns JSON containing `players` (normalized player array), `teams` (team array), `currentGw` (current gameweek number), and `totalPlayers` (count)

#### Scenario: FPL API unavailable
- **WHEN** the FPL API returns a non-200 status or times out
- **THEN** the route returns HTTP 502 with an error message indicating the upstream API is unavailable

### Requirement: Squad analysis route
The system SHALL expose a `GET /api/squad` route that accepts `team_id` (required), `gw` (optional, defaults to current), and `free_transfers` (required, 1 or 2) as query parameters. The route fetches the manager's picks, enriches each player with bootstrap data, and returns the full squad with metadata.

#### Scenario: Successful squad fetch
- **WHEN** the frontend calls `GET /api/squad?team_id=123&free_transfers=1`
- **THEN** the route returns JSON containing `squad` (array of 15 enriched player objects), `bank` (in £m), `squadValue` (in £m), `freeTransfers`, `chipsRemaining` (array of unused chip names), `currentGw`, and `managerName`

#### Scenario: Missing team_id parameter
- **WHEN** the frontend calls `GET /api/squad` without a `team_id`
- **THEN** the route returns HTTP 400 with an error message

#### Scenario: Invalid team_id
- **WHEN** the frontend calls `GET /api/squad?team_id=999999999&free_transfers=1` with a non-existent team ID
- **THEN** the route returns HTTP 404 with an error message

### Requirement: Fixtures route
The system SHALL expose a `GET /api/fixtures` route that returns all fixtures with difficulty ratings, organized for frontend consumption (fixture heatmap and per-team fixture runs).

#### Scenario: Successful fixtures request
- **WHEN** the frontend calls `GET /api/fixtures`
- **THEN** the route returns JSON containing `fixtures` (full fixture array), `teams` (team array for mapping IDs to names), `currentGw`, `upcomingGws` (next 6 gameweeks), and `specialGws` (object mapping gameweek numbers to "BGW" or "DGW")

### Requirement: Transfers route
The system SHALL expose a `POST /api/transfers` route that accepts the squad analysis output and user context, runs the optimizer pipeline, and returns transfer recommendations.

#### Scenario: Successful transfer analysis
- **WHEN** the frontend calls `POST /api/transfers` with `team_id`, `free_transfers`, and the current squad data
- **THEN** the route returns JSON containing transfer recommendations from the optimizer pipeline (single transfer, hit options, restructure options, horizon comparisons, and chip interaction results)

### Requirement: Advice route
The system SHALL expose a `POST /api/advice` route that accepts the optimizer pipeline output and sends it to the Claude API for synthesis, returning the final plain-English recommendations.

#### Scenario: Successful advice generation
- **WHEN** the frontend calls `POST /api/advice` with the optimizer output payload
- **THEN** the route calls the Claude API with a structured prompt and returns JSON containing `primary_recommendation`, `secondary_recommendation`, `hit_verdict`, `chip_plan`, and `alerts`

#### Scenario: Claude API key missing
- **WHEN** the `ANTHROPIC_API_KEY` environment variable is not set
- **THEN** the route returns HTTP 500 with an error indicating the API key is not configured

### Requirement: All routes return consistent error format
The system SHALL return errors in a consistent JSON format: `{ error: string, status: number }` for all API routes.

#### Scenario: Consistent error shape
- **WHEN** any API route encounters an error (400, 404, 500, 502)
- **THEN** the response body contains `error` (human-readable message) and `status` (HTTP status code)
