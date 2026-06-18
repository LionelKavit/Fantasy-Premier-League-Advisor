## Tasks

> Per-token streaming is in scope (chosen over per-round). The loop's behavior contract (capped tool rounds, FPL-only prompt, recoverable tool errors, no-key fail-safe) must be preserved — only emission changes. Live token streaming needs a valid `ANTHROPIC_API_KEY`; tests run on a fake stream.

### Task 1: Streaming wrapper + always-stream loop — ✅ Done
**Capability:** sdk-adoption / ask-endpoint
**Files:** `lib/llm/client.ts`, `lib/scout/chat.ts`

- Add `llm.stream(params): { textStream: AsyncIterable<string>; finalMessage(): Promise<Message> }` adapting `messages.stream`.
- Rework `runScoutConversation` to stream every round: forward text deltas via `onToken`, fire `onTool(name)` before executing each tool, then use `finalMessage()` to detect `tool_use` and continue/stop. Keep the round cap + forced-final (also streamed). Preserve `toolCalls` / `toolRounds` return shape.

### Task 2: NDJSON event endpoint — ✅ Done
**Capability:** ask-endpoint
**File:** `app/api/ask/route.ts`

- Respond `application/x-ndjson`, emitting `token` / `tool` / `done` / `error` events from the loop callbacks. No-key + validation emit a single `token` (notice) then `done`. Errors mid-stream emit `error` then `done`.

### Task 3: Client stream helper — ✅ Done
**Capability:** scout-chat-ui
**File:** `lib/client/ask.ts`

- `streamAsk({ teamId, freeTransfers, messages }, handlers)` — POST, read `response.body`, buffer partial lines, `JSON.parse` each NDJSON line, dispatch to `onToken/onTool/onError`; resolve with accumulated assistant text.

### Task 4: Chat panel — ✅ Done
**Capability:** scout-chat-ui
**File:** `components/panel/AskTheScout.tsx`

- Message list (user/assistant bubbles), token-filling assistant bubble, tool-status chip, input + send, suggested-prompt starter chips, and empty / loading / no-key / error states. Holds `messages` in state; calls `streamAsk`.

### Task 5: Page integration (third lens) — ✅ Done
**Capability:** scout-chat-ui
**File:** `app/page.tsx` (+ `components/ui/tabs.tsx` if a trigger is needed)

- Add the "Ask The Scout" lens; render `AskTheScout` in the right column when active; keep pitch + verdict + alerts on the left. Own the conversation state at the page (or panel) level.

### Task 6: Tests + verify — ✅ Done (live-key step pending)
- [x] `lib/__tests__/scout/ask.test.ts` (extended): drives the loop on a **fake stream** (`mockScoutStream`: async-generator deltas + resolved `finalMessage`) → token forwarding, `onTool` events, round cap → forced answer, tool_use → tool_result → final-text. Plus endpoint NDJSON shape for happy / tool / no-key / validation / mid-stream-error paths.
- [x] `lib/__tests__/client/ask.test.ts`: NDJSON dispatch + **partial-line buffering** across chunk boundaries; error + HTTP + network failure handling.
- [x] `npx tsc --noEmit`, `eslint .` (0 errors), `next build`, `vitest` (177 tests) clean.
- [x] Browser verification: chat lens activates, empty-state + 4 suggestion chips render, a sent question round-trips, and (key being 401) the failure surfaces as a **friendly** Scout reply — confirmed via preview snapshot + screenshot.
- [ ] Manual with a **valid** key: tokens stream live, tool chips appear, answer is grounded. **Pending `ANTHROPIC_API_KEY`** (user will add after this change).

#### As-built notes
- Always-stream loop in `lib/scout/chat.ts` via a `streamRound` helper; `onText` replaced by `onToken` (deltas) + `onTool` (status). Wrapper exposes `llm.stream → { textStream, finalMessage }`; tests fake that shape (no SDK event plumbing).
- Endpoint emits `application/x-ndjson` (`token`/`tool`/`error`/`done`). Errors are mapped to a **friendly** user message (`friendlyError`) with the raw detail logged server-side, not shown in the bubble.
- Conversation state is lifted to `app/page.tsx` (`chat`/`setChat`) so it survives lens switches; cleared on (re)analyze since the grounding context changes.

#### Design-review fixes (post-implementation pass)
- **User bubble contrast:** switched the manager's bubble from `bg-fpl-purple` (`#37003c`, too close to the card `#2d0032`) to `bg-fpl-light-purple` (`#963cff`) so it reads distinctly; white text clears WCAG AA. Assistant stays `bg-muted`.
- **Accessibility:** the message list is an ARIA live region (`role="log"`, `aria-live="polite"`) so streamed tokens are announced; the composer input gained an `aria-label`.
- **Deferred (P3, cosmetic):** the fixed-height panel leaves whitespace below it next to the taller pitch column; the in-panel `ASK THE SCOUT` header is mildly redundant with the active tab. Both left for a later pass once real streaming is in use.
