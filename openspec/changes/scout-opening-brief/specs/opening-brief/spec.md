## ADDED Requirements

### Requirement: Opening-brief endpoint
The system SHALL expose `POST /api/brief` accepting `{ team_id, freeTransfers }` that returns a proactive, single-turn opening brief in the Pocket Scout voice, streamed as NDJSON events (`{type:"token"|"error"|"done"}`) — the same event shape as `/api/ask`.

#### Scenario: Brief for a valid manager
- **WHEN** a request arrives with a valid `team_id`
- **THEN** the endpoint grounds on that manager's plan and streams a brief that leads with the week's highest-leverage decision and names the deadline

#### Scenario: Missing team id
- **WHEN** `team_id` is absent or unparseable
- **THEN** the endpoint responds 400 with a clear error (no stream)

#### Scenario: Grounding failure mid-flight
- **WHEN** building the grounding fails after the stream has opened
- **THEN** the endpoint emits a `{type:"error"}` event followed by `done` (it does not crash the stream)

### Requirement: Grounded, never invented
The brief SHALL reference only figures present in the grounding summary distilled from the plan (transfer recommendation, captain/vice, top alert, chips, deadline). It SHALL NOT invent prices, scores, or projections.

#### Scenario: Cites the real recommendation
- **WHEN** the plan recommends a specific transfer and captain
- **THEN** the brief names those same players and the same headline action (e.g. "make one free transfer", "roll it"), consistent with the structured detail

#### Scenario: Thin plan
- **WHEN** the optimizer or captain result is null (a sub-pipeline failed)
- **THEN** the brief still greets and leads with whatever decision is available, without fabricating the missing side

### Requirement: Dedicated streamed synthesis, no tools
The brief SHALL be produced by a dedicated synthesis (`streamOpeningBrief`) using the Scout persona and `llm.stream()`, distinct from the agentic chat, and SHALL NOT call tools.

#### Scenario: Spoken-aloud greeting
- **WHEN** the brief streams
- **THEN** it is ≤4 sentences of plain spoken prose (no markdown headings, tables, or bullet lists) and arrives token-by-token

### Requirement: Grounding reuses cached work
The endpoint SHALL build its grounding from the cached `runGameweekPlanInsights` (and base meta), not a fresh optimizer/captain run.

#### Scenario: No double-spend
- **WHEN** a brief is requested shortly after the plan's insights were computed
- **THEN** the grounding is served from the insights cache (no repeated full optimizer/captain computation)

### Requirement: No-key fallback still greets
When `ANTHROPIC_API_KEY` is not set, the endpoint SHALL stream a deterministic composed brief from the same grounding summary.

#### Scenario: Missing API key
- **WHEN** no key is configured
- **THEN** `/api/brief` streams a non-empty plain-English greeting naming the recommended move, captain, and deadline (emitted as a single token), so the Scout still opens the conversation
