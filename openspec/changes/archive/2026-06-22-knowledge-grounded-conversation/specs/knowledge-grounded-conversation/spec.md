## ADDED Requirements

### Requirement: Brief is grounded in the play-now chip

The proactive opening brief SHALL be grounded in the committed chip plan: when a chip is recommended to be played this gameweek (play-now), the brief's grounding SHALL include that chip (its label and reason) and the brief SHALL name it as a top-tier lever for the week, consistent with the verdict bar and This Week panel. This SHALL apply to both the LLM brief and the keyless deterministic brief. When no chip is play-now, the brief SHALL behave as before (no chip call).

#### Scenario: A chip is play-now this gameweek

- **WHEN** the committed plan recommends playing a chip this gameweek (e.g. Bench Boost) and the brief is generated
- **THEN** the brief names that chip as a lead/top-tier decision for the week, rather than describing chips only as "available"

#### Scenario: Keyless deterministic brief with a play-now chip

- **WHEN** the brief is produced by the keyless deterministic path and a chip is play-now
- **THEN** the brief text includes a sentence recommending that chip this gameweek

#### Scenario: No chip recommended this gameweek

- **WHEN** no chip is play-now for the current gameweek
- **THEN** the brief makes no play-now chip call and reads as it does today

### Requirement: Brief does not contradict the panels on chips

The brief SHALL NOT describe chips in a way that contradicts the committed chip plan shown in the panels. In particular, when the plan plays a chip this gameweek, the brief SHALL NOT imply all chips are merely being held.

#### Scenario: Panel plays a chip, brief agrees

- **WHEN** the This Week panel / verdict bar show a play-now chip
- **THEN** the brief reflects the same play-now decision and does not state or imply the chip is being held

### Requirement: Chat is grounded in the curated knowledge base

The chat agentic loop SHALL be grounded in the repo's curated expert knowledge — at minimum the chip-strategy knowledge (`chips.md`), and the rank-strategy knowledge (`rank-strategy.md`) — loaded through the existing `loadKnowledge` mechanism and included in the chat system prompt, so the Scout reasons with the same expert principles the panels are built on. The knowledge SHALL be additive grounding alongside the committed-plan grounding (which remains authoritative), and a missing knowledge file SHALL degrade to no extra context without error.

#### Scenario: Knowledge present in the chat prompt

- **WHEN** the chat system prompt is built
- **THEN** it includes the curated chip-strategy (and rank-strategy) knowledge content

#### Scenario: One-chip-per-gameweek comes from the knowledge

- **WHEN** the manager asks whether to play two chips (e.g. Bench Boost and Triple Captain) in the same gameweek
- **THEN** the Scout, grounded in the chip knowledge, explains that only one chip may be played per gameweek and does not endorse playing both that week

#### Scenario: Missing knowledge file

- **WHEN** a curated knowledge file is unavailable
- **THEN** the chat system prompt renders without that knowledge and the chat still functions
