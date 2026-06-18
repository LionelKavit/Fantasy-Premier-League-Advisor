## ADDED Requirements

### Requirement: Ask endpoint with agentic tool-use loop
The system SHALL expose `POST /api/ask` that runs an agentic loop on the SDK: send the conversation + tool definitions, execute any requested tools, append results, and continue until a final answer or a round cap.

#### Scenario: Direct answer
- **WHEN** a question needs no tools (e.g. "explain my captain pick")
- **THEN** the Scout answers from the grounding context in one round

#### Scenario: Tool-assisted answer
- **WHEN** a question needs facts or a hypothetical (e.g. "is Saka better than Semenyo?", "what if I bring in Palmer?")
- **THEN** the model calls the relevant tools, their results are fed back, and the final answer reflects them

#### Scenario: Round cap
- **WHEN** the loop reaches ~5 tool rounds without a final answer
- **THEN** it stops and returns the best answer so far (bounded cost/runtime)

### Requirement: Streaming response
#### Scenario: Streamed reply
- **WHEN** the Scout produces its final answer
- **THEN** the endpoint streams the text to the client (token/chunk-wise), not a single blocking payload

### Requirement: Stateless multi-turn
#### Scenario: Client-held history
- **WHEN** the client sends `{ team_id, freeTransfers, messages: [...] }`
- **THEN** the server uses the provided history for context and persists nothing server-side (conversation lives in the browser)

#### Scenario: Grounding context cached
- **WHEN** consecutive turns arrive for the same `team_id`+gameweek
- **THEN** the analysis context is built once and reused from an in-memory cache (no repeated full squad analysis per turn)

### Requirement: FPL-only scope and cost guards
#### Scenario: Off-topic declined
- **WHEN** the user asks something unrelated to FPL/their squad
- **THEN** the Scout politely declines and steers back to FPL (per the system prompt)

#### Scenario: Bounded cost
- **WHEN** a request runs
- **THEN** tool rounds (~5) and tokens are capped

### Requirement: No-key behavior
#### Scenario: Missing API key
- **WHEN** `ANTHROPIC_API_KEY` is not set
- **THEN** `/api/ask` returns a clear "chat unavailable — API key not configured" response (no fabricated answer)
