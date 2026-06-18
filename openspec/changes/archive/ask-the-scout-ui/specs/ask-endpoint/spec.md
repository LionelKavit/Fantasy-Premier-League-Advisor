## MODIFIED Requirements

### Requirement: Agentic ask endpoint
`POST /api/ask` SHALL accept `{ team_id, freeTransfers?, messages }`, run the capped FPL-only tool-use loop against the cached grounding context, and stream the assistant's reply. The loop's behavior contract is unchanged (≤5 tool rounds + forced final, structured tool errors, stateless client-held history, no-key fail-safe); **only the emission format changes to per-token NDJSON events.**

#### Scenario: Per-token NDJSON event stream
- **WHEN** the loop produces text
- **THEN** the endpoint responds `Content-Type: application/x-ndjson` and emits one JSON object per line as tokens arrive: `{"type":"token","text":"…"}`
- **AND** before executing each tool it emits `{"type":"tool","name":"…"}`
- **AND** it terminates the stream with `{"type":"done"}`

#### Scenario: Always-stream loop preserves tool use
- **WHEN** a streamed round's completed message contains `tool_use` blocks
- **THEN** the loop executes the tools, appends `tool_result`, and continues — the streamed text of the final (no-tool) round is the answer

#### Scenario: Recoverable error mid-stream
- **WHEN** the loop throws after streaming has begun
- **THEN** the endpoint emits `{"type":"error","message":"…"}` followed by `{"type":"done"}` (it does not drop the connection silently)

#### Scenario: No API key
- **WHEN** `ANTHROPIC_API_KEY` is not configured
- **THEN** the endpoint emits a single `token` event carrying the "Ask The Scout is unavailable" notice, then `done` — the same transport as a normal reply (no separate error path for the client)

#### Scenario: Invalid request
- **WHEN** `team_id` is missing or `messages` does not end with a user turn
- **THEN** the endpoint returns a `400` JSON error (before any streaming begins)
