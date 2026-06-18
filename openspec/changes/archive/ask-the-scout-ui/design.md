# Design

## Context
The endpoint and tools exist; this change makes them usable and upgrades the transport to per-token. The agentic loop must keep working exactly as today (capped tool rounds, FPL-only, structured tool errors, no-key fail-safe) — only how text leaves the loop changes.

## Key Decisions

### 1. Always-stream agentic loop
We can't know up front whether a round will call tools or produce the final answer, so every round uses streaming. `lib/scout/chat.ts` consumes `llm.stream(...)`: it forwards text deltas to an `onToken` callback as they arrive, then awaits the **completed message** and checks for `tool_use` blocks. Tool round → run tools, append `tool_result`, loop. No tool calls → that round's streamed text *was* the final answer. The round-cap forced-final call also streams. This streams interim *and* final text token-by-token with one code path.

### 2. Normalized streaming seam on the wrapper
`lib/llm/client.ts` adds `stream(params): { textStream: AsyncIterable<string>; finalMessage: () => Promise<Anthropic.Messages.Message> }`, adapting the SDK's `messages.stream`. The loop and tests depend on this **small normalized shape**, not the SDK's `MessageStream` internals — so tests provide a trivial fake (an async generator + a resolved final message) without reconstructing SDK event plumbing.

### 3. NDJSON event protocol (not opaque text)
`/api/ask` responds `application/x-ndjson` — one JSON object per line:
- `{"type":"token","text":"…"}` — a text delta to append to the current assistant bubble.
- `{"type":"tool","name":"get_plan"}` — a tool the loop is about to run (drives a "Scout is checking your squad…" status chip).
- `{"type":"done"}` — stream complete.
- `{"type":"error","message":"…"}` — a recoverable failure; render inline, end the turn.

This gives the UI token rendering *and* the tool-status events the backend design flagged, with a format trivial to parse (`split("\n")` → `JSON.parse`). No-key and validation paths emit a single `token` (the notice) + `done`, so the client has one uniform code path.

### 4. Client helper isolates the transport
`lib/client/ask.ts` → `streamAsk({ teamId, freeTransfers, messages }, handlers)` POSTs the body, reads `response.body` with a stream reader, buffers partial lines, and dispatches each parsed event to `handlers.onToken / onTool / onError`. Resolves with the accumulated assistant text. The React component never touches the reader.

### 5. Chat as the third lens; left column stays grounding
The dashboard is prose-left / data-right with a tab-as-lens. Add a third lens, **"Ask The Scout"**: when active, the right column renders `AskTheScout`; the left column (pitch + `ScoutVerdict` + `AlertsCard`) stays put so the user keeps their squad in view while chatting. The page owns the conversation state (the message array) alongside the existing `lens` state.

### 6. Stateless, client-held history
`AskTheScout` keeps `messages: { role, content }[]` in React state. Each send posts the **whole array** (+ `teamId`, `freeTransfers`) and appends the streamed assistant reply. In-memory only for v1 (cleared on reload) — matches the stateless server. Persistence is a noted future enhancement.

### 7. UX states + suggested starters
- **Empty:** a short intro + 3–4 suggested-prompt chips ("Who should I captain?", "Best transfer this week?", "Should I take a hit?", "Is <top target> worth buying?") that fill/submit the input.
- **Streaming:** assistant bubble fills token-by-token; a tool-status chip shows the active tool; input disabled until `done`.
- **No-key / error:** rendered as the Scout's reply (no-key) or an inline error line (stream error), with the input re-enabled.

## Files (indicative)
```
lib/llm/client.ts            // + stream() normalized adapter
lib/scout/chat.ts            // always-stream loop; onToken / onTool callbacks
app/api/ask/route.ts         // NDJSON event stream
lib/client/ask.ts            // streamAsk() — POST + NDJSON reader
components/panel/AskTheScout.tsx   // chat panel + states
app/page.tsx                 // third lens wiring
lib/__tests__/scout/chat.test.ts (or extend ask.test.ts)  // streamed loop on a fake stream
lib/__tests__/client/ask.test.ts // NDJSON parsing / partial-line buffering
```

## Reused
- `runScoutTool` + `getScoutContext` (unchanged); the tab framework (`components/ui/tabs.tsx`); existing panel styling tokens.
- The agentic loop's behavior contract (round cap, FPL-only prompt, recoverable tool errors) is preserved — only emission changes.

## Risks
- **Streaming with no live key:** can't end-to-end verify token streaming until `ANTHROPIC_API_KEY` is valid; tests cover the loop and parser on fakes, and the no-key path is exercised for real.
- **Partial NDJSON lines:** the reader must buffer across chunk boundaries — covered explicitly in `ask.test.ts`.
