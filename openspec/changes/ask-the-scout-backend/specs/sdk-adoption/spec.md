## ADDED Requirements

### Requirement: Anthropic SDK client wrapper
The system SHALL provide a small `lib/llm/client.ts` wrapper around `@anthropic-ai/sdk` that constructs a client from `ANTHROPIC_API_KEY` and exposes message creation and streaming, so all LLM calls share one configured client.

#### Scenario: Constructed from env
- **WHEN** the wrapper is used and `ANTHROPIC_API_KEY` is set
- **THEN** it issues requests via the SDK; **AND WHEN** the key is missing, callers take their existing fail-safe path (no crash)

### Requirement: Migrate existing call-sites
The existing LLM call-sites SHALL use the SDK wrapper instead of raw `fetch`, with no behavior change.

#### Scenario: Synthesis still works
- **WHEN** the optimizer synthesis, captain synthesis, long-term synthesis, and llm-context run via the SDK
- **THEN** they produce the same outputs/fail-safes as before (parsing, confidence clamping, null long-term, neutral llm defaults)

### Requirement: Test mock targets the SDK
The test harness SHALL mock the SDK client (not global `fetch`).

#### Scenario: Existing tests pass on the SDK mock
- **WHEN** the suite runs with the SDK mocked (success / error / malformed modes)
- **THEN** all existing synthesis and long-term tests pass unchanged in intent
