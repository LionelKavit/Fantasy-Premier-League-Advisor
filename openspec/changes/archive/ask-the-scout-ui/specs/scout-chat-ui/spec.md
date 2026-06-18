## ADDED Requirements

### Requirement: Ask The Scout chat client
The system SHALL provide `lib/client/ask.ts` that streams a chat turn from `/api/ask` and dispatches NDJSON events to callbacks, isolating the transport from React components.

#### Scenario: Stream a turn
- **WHEN** `streamAsk({ teamId, freeTransfers, messages }, handlers)` is called
- **THEN** it POSTs the body, reads the response stream, parses each NDJSON line, and invokes `handlers.onToken(text)` / `handlers.onTool(name)` / `handlers.onError(message)` accordingly
- **AND** it resolves with the full accumulated assistant text when `done` is received

#### Scenario: Partial lines across chunks
- **WHEN** a network chunk ends mid-line
- **THEN** the helper buffers the remainder and only parses a line once its newline arrives (no dropped or malformed events)

### Requirement: Ask The Scout chat panel
The system SHALL provide `components/panel/AskTheScout.tsx` — a chat interface that holds the conversation client-side and renders the streamed reply.

#### Scenario: Send and stream a reply
- **WHEN** the user submits a question
- **THEN** the user message is appended, `streamAsk` is called with the full history, and the assistant bubble fills token-by-token
- **AND** the input is disabled until the stream completes, then the assistant message is committed to history

#### Scenario: Tool-status feedback
- **WHEN** a `tool` event arrives mid-turn
- **THEN** the panel shows a transient status chip (e.g. "Checking your squad…") for the active tool

#### Scenario: Empty state with starters
- **WHEN** there are no messages yet
- **THEN** the panel shows a short intro and 3–4 suggested-prompt chips that populate/submit the input when clicked

#### Scenario: Unavailable / error states
- **WHEN** the stream carries the no-key notice (as a `token`) or an `error` event
- **THEN** the panel renders it inline as the Scout's reply / an error line and re-enables the input

#### Scenario: Legible, accessible messages
- **WHEN** messages are displayed
- **THEN** the user's own bubble is visually distinct from the card and the assistant bubble (manager bubble uses the brighter brand purple, white text clearing WCAG AA), and the message list is an ARIA live region so streamed tokens are announced to assistive tech
- **AND** the composer input carries an accessible label

### Requirement: Chat lens integration
The dashboard SHALL expose an "Ask The Scout" lens alongside "This Week" and "Long Term".

#### Scenario: Activate the chat lens
- **WHEN** the user selects the "Ask The Scout" tab
- **THEN** the right column renders the chat panel while the left column keeps the pitch, Scout's verdict, and alerts as grounding context
- **AND** the conversation persists while switching to other lenses and back within the session
