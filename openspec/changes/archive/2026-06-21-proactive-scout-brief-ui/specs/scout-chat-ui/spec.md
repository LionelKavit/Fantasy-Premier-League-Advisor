## ADDED Requirements

### Requirement: Opening-brief client
The system SHALL provide `lib/client/brief.ts` that streams the opening brief from `/api/brief` and dispatches NDJSON events to callbacks, isolating the transport from React components (sibling to `lib/client/ask.ts`).

#### Scenario: Stream the brief
- **WHEN** `streamBrief({ teamId, freeTransfers }, handlers)` is called
- **THEN** it POSTs the body, reads the response stream, parses each NDJSON line, invokes `handlers.onToken(text)` / `handlers.onError(message)`, and resolves with the full accumulated brief text on `done`

#### Scenario: Partial lines across chunks
- **WHEN** a network chunk ends mid-line
- **THEN** the helper buffers the remainder and only parses a line once its newline arrives (no dropped or malformed events)

### Requirement: Contextual starters
The system SHALL derive the chat's suggested prompts from the loaded `GameweekPlan` via `buildScoutStarters(plan)`, replacing the static suggestion list.

#### Scenario: Grounded prompts
- **WHEN** the plan has a transfer recommendation and a captain pick
- **THEN** the starters reference the actual decisions (e.g. "Why {captain} over {vice}?", "Walk me through {out} → {in}", "Should I take a hit instead?", "Which of my players are at risk?")

#### Scenario: Fallback prompts
- **WHEN** the plan lacks a recommendation (sub-pipeline failed / pre-insights)
- **THEN** the starters fall back to the existing generic four

## MODIFIED Requirements

### Requirement: Ask The Scout chat panel
The system SHALL provide `components/panel/AskTheScout.tsx` — a chat interface that holds the conversation client-side, **opens proactively with the Scout's streamed brief**, and renders streamed replies.

#### Scenario: Proactive opening brief
- **WHEN** a fresh analysis is ready
- **THEN** the panel auto-fires `streamBrief` exactly once, streaming the brief into a first assistant bubble (reusing the existing streaming/bubble rendering), then commits it to history
- **AND** it re-fires when the analysis changes (Re-analyze or manager switch), but not on ordinary re-renders

#### Scenario: Send and stream a reply
- **WHEN** the user submits a question (typed or via a starter)
- **THEN** the user message is appended, `streamAsk` is called with the full history, and the assistant bubble fills token-by-token
- **AND** the input is disabled until the stream completes, then the assistant message is committed to history

#### Scenario: Tool-status feedback
- **WHEN** a `tool` event arrives mid-turn
- **THEN** the panel shows a transient status chip for the active tool

#### Scenario: Contextual starters before/with the brief
- **WHEN** the panel offers suggested prompts
- **THEN** they are the contextual starters from `buildScoutStarters(plan)` (not the static list), and clicking one populates/submits the input

#### Scenario: Unavailable / error states
- **WHEN** the brief or a reply stream carries the no-key notice (as a `token`) or an `error` event
- **THEN** the panel renders it inline as the Scout's message / an error line and keeps the input usable

#### Scenario: Legible, accessible messages
- **WHEN** messages are displayed
- **THEN** the user's own bubble stays visually distinct (brand purple, white text clearing WCAG AA), the message list is an ARIA live region, and the composer carries an accessible label

### Requirement: Chat lens integration
The dashboard SHALL render the Scout conversation as the always-visible hero surface (per `conversation-first-shell`), not as a selectable tab.

#### Scenario: Conversation is the hero
- **WHEN** a plan loads
- **THEN** the conversation renders as the prominent surface without selecting a tab, opens with the brief, and persists across opening/closing the "Full breakdown" drawer within the session
