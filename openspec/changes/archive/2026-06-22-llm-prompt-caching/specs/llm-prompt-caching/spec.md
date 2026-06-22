## ADDED Requirements

### Requirement: Cached stable prefix on LLM calls
The system SHALL attach `cache_control: { type: "ephemeral" }` to the stable prefix of its Claude requests so repeated prefixes are billed at the cache-read rate rather than re-billed in full. The render order `tools → system → messages` SHALL be respected: a breakpoint placed on the last system block caches both `tools` and `system`.

#### Scenario: System prefix is marked for caching
- **WHEN** a single-shot completion is issued with a `system` prompt
- **THEN** the request sends `system` as a content block carrying `cache_control: { type: "ephemeral" }`

#### Scenario: No system, no marker
- **WHEN** a completion is issued without a `system` prompt
- **THEN** no system cache block is added and the request is otherwise unchanged

### Requirement: Agentic chat loop caches tools, system, and history
The Scout chat loop SHALL cache the prefix that is reused across its multiple model calls for a single question: one breakpoint on the system block (covering `tools` + `system`) and one on the last block of the most recent message (covering the conversation history).

#### Scenario: Prefix cached across tool rounds
- **WHEN** a chat question triggers more than one model call (tool rounds and/or the forced final answer)
- **THEN** every call carries a cache breakpoint on the system block and on the latest message's last block, so each call after the first re-reads the prior prefix from cache

#### Scenario: Tail breakpoint tracks the growing history
- **WHEN** a tool round appends an assistant message and its tool results
- **THEN** the message-tail cache breakpoint moves to the new last block, kept within the 20-block lookback window

### Requirement: Caching is behaviour-preserving and key-gated
Enabling caching SHALL NOT change model output or any graceful-degradation path; it changes only token accounting. When no API key is present, no request is made and nothing is cached.

#### Scenario: Output unchanged
- **WHEN** the same request is made with caching enabled
- **THEN** the parsed result is identical to the uncached behaviour; only `usage` reflects cache reads/writes

#### Scenario: Keyless path untouched
- **WHEN** `ANTHROPIC_API_KEY` is not set
- **THEN** the existing deterministic fallback runs with no Claude request and no cache interaction
