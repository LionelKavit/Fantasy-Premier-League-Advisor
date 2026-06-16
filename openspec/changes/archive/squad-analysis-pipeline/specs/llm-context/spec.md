## ADDED Requirements

### Requirement: LlmContextSignals type
The system SHALL define a `LlmContextSignals` interface with fields: `rotationRisk` (number, 0-1), `oopBonus` (number, 0-0.10), `injurySeverity` (number, 0-1), `tacticalBoost` (number, -0.05 to 0.10), `opponentKeyAbsence` (number, 0-0.05), `setPieceHierarchy` (object with `penaltyTaker: string | null`, `cornerTaker: string | null`, `freeKickTaker: string | null`).

### Requirement: Batch compute LLM context signals
The system SHALL provide a `batchComputeLlmContext(players: Player[], teamSetPieceNotes: TeamSetPieceNotes[], opponentPlayers: Player[]): Promise<Map<number, LlmContextSignals>>` function that calls the Claude API with a structured prompt containing all players' context and returns a map of player ID to signals.

#### Scenario: Batch prompt structure
- **WHEN** the system calls Claude with 15 squad players
- **THEN** the prompt includes per-player: name, position, starts, minutes, form, news text, team set piece notes for their team, and opponent injury status for their next fixture
- **AND** the prompt requests a JSON response with an array of 15 signal objects

#### Scenario: Rotation risk assessment
- **WHEN** a MID player has `starts: 15` out of `30` possible GWs and plays for a team with deep squad depth
- **THEN** `rotationRisk` is approximately 0.5-0.7

#### Scenario: OOP bonus detection
- **WHEN** a MID player has a threat/creativity ratio and goal output consistent with playing as a striker
- **THEN** `oopBonus` is approximately 0.05-0.10

#### Scenario: Injury severity — minor knock
- **WHEN** a player has news "Knock - 75% chance of playing"
- **THEN** `injurySeverity` is approximately 0.2

#### Scenario: Injury severity — serious
- **WHEN** a player has news "Hamstring - Expected back in 4 weeks"
- **THEN** `injurySeverity` is approximately 0.7

#### Scenario: Injury severity — no news
- **WHEN** a player has no injury news and status "available"
- **THEN** `injurySeverity` is 0

#### Scenario: Tactical boost — new manager bounce
- **WHEN** a team recently changed managers and form is improving
- **THEN** `tacticalBoost` is approximately 0.05-0.10

#### Scenario: Opponent key absence
- **WHEN** 2 of the opponent's top 5 players (by total points) have status "injured"
- **THEN** `opponentKeyAbsence` is approximately 0.03

#### Scenario: Set piece hierarchy parsing
- **WHEN** team set piece notes include "Saka and Odegaard share penalty duties"
- **THEN** `setPieceHierarchy.penaltyTaker` includes the relevant player names

### Requirement: Fail-safe when API key is absent
The system SHALL return default neutral signals when `ANTHROPIC_API_KEY` is not set, without throwing an error.

#### Scenario: Missing API key
- **WHEN** `ANTHROPIC_API_KEY` environment variable is not set
- **THEN** the function returns default signals for all players: `rotationRisk: 0`, `oopBonus: 0`, `injurySeverity: 0`, `tacticalBoost: 0`, `opponentKeyAbsence: 0`, `setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null }`
- **AND** a warning is logged

### Requirement: Fail-safe on API error
The system SHALL return default neutral signals when the Claude API call fails or times out.

#### Scenario: API timeout
- **WHEN** the Claude API call exceeds the timeout
- **THEN** the function returns default neutral signals and logs the error

#### Scenario: Malformed response
- **WHEN** the Claude API returns a response that does not match the expected JSON schema
- **THEN** the function returns default neutral signals and logs a parsing error

### Requirement: Signal range clamping
The system SHALL clamp all LLM-returned signal values to their defined ranges from `LLM_SIGNAL_RANGES` before returning.

#### Scenario: Out-of-range rotation risk
- **WHEN** the LLM returns `rotationRisk: 1.3`
- **THEN** the value is clamped to `1.0`

#### Scenario: Negative OOP bonus
- **WHEN** the LLM returns `oopBonus: -0.05`
- **THEN** the value is clamped to `0`
