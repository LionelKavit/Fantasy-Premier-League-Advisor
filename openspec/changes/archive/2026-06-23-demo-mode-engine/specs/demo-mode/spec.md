## ADDED Requirements

### Requirement: A season-aware dream-team squad is constructed without a manager ID
The system SHALL build a valid 15-man FPL squad from the live player pool, ranked by a season-aware metric, so a visitor without a manager ID can be shown a credible team.

#### Scenario: Valid FPL squad shape and constraints
- **WHEN** the demo squad builder runs over `bootstrap-static`
- **THEN** it returns exactly 15 players in a legal FPL shape (2 GK, 5 DEF, 5 MID, 3 FWD)
- **AND** the total cost is within the £100.0m budget and no more than 3 players come from any single club
- **AND** a starting XI (legal formation: ≥1 GK, ≥3 DEF, ≥1 FWD), a 4-man bench, and a captain + vice are designated

#### Scenario: Season state is derived from the gameweek calendar
- **WHEN** the demo squad's season is determined
- **THEN** it is `"live"` if and only if an unfinished gameweek with a future deadline exists, and `"offseason"` otherwise
- **AND** stale `ep_next` values in a finished-season feed (the summer break) do NOT make it `"live"`

#### Scenario: Live-season ranking uses ep_next
- **WHEN** the season is live and `ep_next` is meaningfully populated
- **THEN** the squad is selected and ranked by `ep_next`

#### Scenario: Off-season ranking falls back to last-season performance
- **WHEN** the season is off-season (or live but `ep_next` is not yet populated, i.e. pre-season)
- **THEN** the squad is selected and ranked by last-season total points (tie-broken by points-per-game) instead of collapsing, and any stale `ep_next` is ignored

#### Scenario: Budget-valid even when the metric favours premiums
- **WHEN** the highest-metric players cannot all fit under budget
- **THEN** the greedy fill still returns a budget-valid, formation-valid 15 (favouring metric-per-£ for non-anchor slots) rather than an invalid or over-budget squad

### Requirement: A demo analysis context is built without manager-specific data
The system SHALL assemble a full `AnalysisContext` from the synthesized squad, with a stubbed manager profile, so the existing pipeline and chat tools run unchanged.

#### Scenario: Context reuses the real scorers
- **WHEN** the demo context is built
- **THEN** the 15 squad players are scored by the same scoring path used for a real squad, producing genuine 0–10 ratings
- **AND** weak spots are identified, but no transfer targets are generated

#### Scenario: Manager profile is stubbed, not fetched
- **WHEN** the demo context is built
- **THEN** no `fetchPicks` or `buildManagerProfile` call is made
- **AND** the manager profile is a placeholder with no overall rank, no held chips, and neutral history/risk

#### Scenario: Demo context is cached independently of real managers
- **WHEN** the demo context is requested repeatedly within the cache TTL
- **THEN** it is served from a demo-specific cache entry and does not collide with or overwrite any real manager's cached context

### Requirement: The demo plan omits personalized transfer and chip strategy
The demo plan SHALL present the pitch, ratings, and captaincy, and SHALL NOT present a transfer recommendation, a long-term transfer horizon, or a chip plan, since there is no real squad to improve and no held-chip state.

#### Scenario: Base phase matches the real pitch
- **WHEN** the demo base plan is produced
- **THEN** it returns the squad with full ratings and a deterministic captain/vice, identical in shape to the ID-based base plan

#### Scenario: Insights are trimmed to captaincy only
- **WHEN** the demo insights phase runs
- **THEN** it produces the captaincy call (deterministic + LLM synthesis) and leaves `transfers` null
- **AND** it does not run the optimizer at all (no transfer recommendation, no long-term transfer horizon, no chip plan)
- **AND** it does not make the transfer-narrative or chip-orchestrator LLM calls

### Requirement: The Scout opens demo mode with a welcome brief
In demo mode the opening brief SHALL be a season-aware welcome that explains the sample squad, not the deadline-and-action brief.

#### Scenario: Welcome brief instead of action brief
- **WHEN** the demo opening brief is generated
- **THEN** it greets the visitor, states the basis for the squad ("last season's returns" off-season, "this week's projections" in-season), names the captain, and invites a question
- **AND** it does not reference a deadline action, held chips, or "your squad"

#### Scenario: Keyless fallback brief
- **WHEN** no LLM key is configured
- **THEN** a deterministic demo welcome brief of the same shape is returned

### Requirement: The demo chat gives general advice about a sample squad
In demo mode the Scout SHALL frame its answers as general FPL guidance about a sample squad, grounded in real numbers via its tools, and SHALL NOT issue personalized transfer or chip verdicts.

#### Scenario: Chat is grounded in the demo context
- **WHEN** a demo chat turn runs
- **THEN** the Scout tools (`score_player`, `simulate_captain`, `simulate_transfer`, `get_plan`) operate against the demo context and return real numbers

#### Scenario: No "your squad" framing
- **WHEN** the Scout answers in demo mode
- **THEN** it speaks of the sample squad and general principles, and does not reference the user's own team, rank, or held chips

#### Scenario: simulate_transfer is hypothetical, not a recommendation
- **WHEN** the Scout uses `simulate_transfer` in demo mode
- **THEN** it explains the expected-points effect of the hypothetical swap as a teaching aid
- **AND** it does not tell the visitor they "should" make a transfer

### Requirement: Routes accept a demo signal without a manager ID
The plan, ask, and brief routes SHALL accept an explicit demo signal that bypasses the `team_id` requirement and serves the demo plan/brief/chat.

#### Scenario: Demo plan without team_id
- **WHEN** `GET /api/plan/base` or `GET /api/plan/insights` is called with `demo=1` and no `team_id`
- **THEN** it returns the demo base/insights plan with a 200 status (no "team_id is required" error)

#### Scenario: Demo chat and brief without team_id
- **WHEN** `POST /api/ask` or `POST /api/brief` is called with `demo: true` and no `team_id`
- **THEN** it streams the demo chat / demo brief grounded in the demo context

#### Scenario: Response shape parity
- **WHEN** any demo route responds
- **THEN** it uses the same `GameweekPlan` / `PlanInsights` / streaming types as the ID-based routes, differing only in that `transfers` is null (no transfer recommendation, long-term horizon, or chip plan)

### Requirement: Demo degrades gracefully without the LLM
Because the demo is a first-impression showcase, an unavailable LLM (no API key or a runtime failure) SHALL leave the demo functional on its deterministic spine, and SHALL NOT surface a raw error in place of the opening brief.

#### Scenario: Deterministic spine survives an LLM outage
- **WHEN** the LLM is unavailable (no key, or a 401/429/network/timeout failure) during a demo session
- **THEN** the pitch, the 0–10 ratings, and the captain pick are all still produced (they are deterministic and need no LLM)

#### Scenario: Opening brief falls back to a deterministic brief on any LLM failure
- **WHEN** the demo opening brief cannot be produced by the LLM (no key OR a runtime failure)
- **THEN** the deterministic demo welcome brief (`composeDeterministicDemoBrief`) is returned in its place
- **AND** a raw error string is never shown as the Scout's opening line

#### Scenario: Captain prose falls back to a de-personalized template
- **WHEN** the captain synthesis LLM call fails or returns unparseable output in demo mode
- **THEN** the captaincy still resolves with the deterministic captain pick and a de-personalized fallback narrative (e.g. "Top projected captain this gameweek: {player}") that does not instruct the visitor to "review manually" or otherwise imply they own the team

#### Scenario: The chat is the only surface allowed to show an unavailable notice
- **WHEN** the LLM is unavailable for a demo chat turn (the chat has no deterministic equivalent)
- **THEN** the Scout returns a friendly unavailable notice (conveying that the squad and ratings are still live)
- **AND** every other demo surface remains present and functional
