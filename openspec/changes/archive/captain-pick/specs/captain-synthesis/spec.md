## ADDED Requirements

### Requirement: Synthesize captain recommendation
The system SHALL provide a `synthesizeCaptainPick(inputs: CaptainSynthesisInput): Promise<CaptainResult>` function that calls the Claude API to produce a risk-aware captaincy recommendation with plain-English reasoning.

### Requirement: Prompt structure
The prompt SHALL include: the manager's rank context and risk profile, the ranked captain candidates with scores and reasons, the vice-captain, the differential option, the captain horizon, the triple-captain advice, and the exact `CaptainResult` output schema.

#### Scenario: Risk context included
- **WHEN** the manager's rankTrend is "rising" with few hits taken
- **THEN** the prompt conveys a rank-protecting posture

### Requirement: Template vs differential reasoning
The synthesis SHALL choose captaincy emphasis based on rank strategy.

#### Scenario: Protect rank — template captain
- **WHEN** riskProfile.rankTrend is "rising" or the manager is near a rank milestone
- **THEN** the recommendation favors the template (high effective ownership, safe) captain AND the narrative explains the rank-protection rationale

#### Scenario: Chase rank — differential captain
- **WHEN** riskProfile.rankTrend is "falling" AND gwsRemaining is low
- **THEN** the recommendation is more willing to endorse the differentialOption AND the narrative acknowledges the variance taken on

### Requirement: Fail-safe when API unavailable
#### Scenario: Missing API key
- **WHEN** ANTHROPIC_API_KEY is not set
- **THEN** return a valid CaptainResult built from the ranker output: captain = ranked[0], viceCaptain and differentialOption as selected, confidence "low", narrativeSummary noting automated selection, and an alert that synthesis was unavailable

#### Scenario: API error or malformed response
- **WHEN** the Claude call fails, times out, or returns unparseable/invalid JSON
- **THEN** use the same deterministic fail-safe and append an alert describing the failure

### Requirement: Response validation
#### Scenario: Valid response
- **WHEN** Claude returns JSON matching the CaptainResult schema
- **THEN** parse and return it, with the deterministic node outputs (rankedCandidates, horizon, tripleCaptainAdvice) preserved from inputs rather than trusting the LLM to reproduce them

#### Scenario: Confidence clamped
- **WHEN** the LLM returns a confidence outside the allowed set
- **THEN** default to "medium"

### Requirement: Alerts
The synthesis SHALL surface captaincy-specific alerts.

#### Scenario: Captain doubtful
- **WHEN** the recommended captain's `chanceOfPlayingNext` is 75 or below
- **THEN** alerts includes a warning to monitor the player and confirm the vice-captain before the deadline

#### Scenario: Triple-captain window approaching
- **WHEN** tripleCaptainAdvice.recommended is true and targetGw is within the next 2 gameweeks
- **THEN** alerts includes a prompt to consider the chip for that gameweek
