## MODIFIED Requirements

### Requirement: LLM client wrapper
The system SHALL provide `lib/llm/client.ts` exposing the LLM operations the app needs, built from `ANTHROPIC_API_KEY`, so call-sites and tests depend on one seam (`llm.*`) rather than the SDK directly.

In addition to single-shot completion (`complete`), tool-use message creation (`createMessage`), and `hasApiKey`, the wrapper SHALL expose a **streaming** operation.

#### Scenario: Streaming completion
- **WHEN** a caller invokes `llm.stream(params)`
- **THEN** it returns a normalized handle `{ textStream: AsyncIterable<string>; finalMessage(): Promise<Message> }` adapting the SDK's `messages.stream`
- **AND** iterating `textStream` yields text deltas as they arrive
- **AND** `finalMessage()` resolves to the completed message (including any `tool_use` blocks) once the stream ends

#### Scenario: Streaming is mockable without SDK internals
- **WHEN** a test needs to drive the streaming loop
- **THEN** it can supply a fake `{ textStream, finalMessage }` (e.g. an async generator + a resolved message) — no reconstruction of the SDK's event stream is required
