# Ask The Scout — chat UI (with per-token streaming)

## Why
`ask-the-scout-backend` shipped the agentic `/api/ask` endpoint, but nothing consumes it — the "Ask The Scout" tab is inert. This change adds the chat interface so a manager can actually ask the Scout free-form questions ("who should I captain?", "is X a better buy than Y?", "what if I captain Haaland?") and get grounded, tool-assisted answers.

It also upgrades streaming from **per-round** (a chunk per loop iteration) to **per-token**, which the backend deliberately deferred to this change because the wire format is a backend↔frontend contract that shouldn't be designed without its consumer.

## What changes
- **Backend (streaming upgrade):**
  - `lib/llm/client.ts` gains a `stream(...)` method adapting the SDK's `messages.stream` to a small normalized interface (`{ textStream, finalMessage }`).
  - `lib/scout/chat.ts` runs an **always-stream** agentic loop: forward text deltas as they arrive, then inspect the completed message for `tool_use`.
  - `app/api/ask/route.ts` emits a structured **NDJSON event stream** (`token` / `tool` / `done` / `error`) instead of opaque text, enabling token rendering and tool-status chips.
- **Frontend (new):**
  - `lib/client/ask.ts` — a client helper that POSTs the conversation and dispatches stream events to callbacks.
  - `components/panel/AskTheScout.tsx` — the chat panel: message list, streaming assistant bubble, tool-status chips, input, suggested-prompt starters, and empty / loading / no-key / error states.
  - `app/page.tsx` — wire the third lens ("Ask The Scout"): when active, the right column shows the chat panel; the left column (pitch + verdict + alerts) stays as grounding context.

## Impact
- Modifies the `sdk-adoption` and `ask-endpoint` capabilities (streaming); adds the `scout-chat-ui` capability.
- The conversation is **client-held** (React state) and posted whole each turn — the server stays stateless, consistent with the backend design.
- Live answers require a valid `ANTHROPIC_API_KEY`; without one the endpoint streams an "unavailable" notice the UI renders as the Scout's reply.

## Out of scope
- Persisting chat history across reloads (in-memory session only for v1).
- Voice / multi-modal input; saved/blessed conversations; analytics.
