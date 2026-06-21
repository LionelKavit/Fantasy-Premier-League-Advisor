## Tasks

> Depends on `scout-opening-brief` (the `/api/brief` endpoint) and `conversation-first-shell` (chat is the hero). Frontend only.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 233 passed (+10: starters + brief client). The shared NDJSON reader was extracted to `lib/client/ndjson.ts` and `streamAsk` refactored onto it (its `ask.test.ts` still passes unchanged). Auto-fire is driven by a `briefNonce` the page bumps when insights finish (so the brief grounds on the ready analysis and re-fires on Re-analyze / manager switch). End-to-end in-app check pending the user's browser pass (key is now configured in the worktree).

### Task 1 — ✅ Done: Brief client transport
**Capability:** scout-chat-ui
**Files:** `lib/client/ndjson.ts` (new — shared `postNdjsonStream`), `lib/client/brief.ts` (new), `lib/client/ask.ts` (refactored onto the shared reader)

`streamBrief({ teamId, freeTransfers }, handlers)` mirrors `streamAsk`: POST `/api/brief`, stream NDJSON, dispatch `onToken` / `onError`, resolve with the accumulated text. The reader/buffer logic was factored into `postNdjsonStream`; both `streamAsk` and `streamBrief` call it (DRY). Brief has no tools, so every token accumulates.

### Task 2 — ✅ Done: Contextual starters
**Capability:** scout-chat-ui
**File:** `lib/client/scoutStarters.ts` (new)

`buildScoutStarters(plan): string[]` — derive 3–4 prompts from the plan: captain vs vice, the recommended `out → in` move (or "should I transfer at all?" when held), a hit question, and a risk question. Fall back to the existing generic four when `transfers`/`captaincy` are null.

### Task 3 — ✅ Done: Proactive open + starters in the panel
**Capability:** scout-chat-ui
**Files:** `components/panel/AskTheScout.tsx`, `app/page.tsx`

- `AskTheScout` gains `plan` + `briefNonce` props. The page bumps `briefNonce` in the insights `finally` (so it fires once insights are ready, and again on Re-analyze / manager switch — chat already resets on load).
- An effect fires `streamBrief` **once per nonce** (a `firedNonceRef` guard), streaming into the first assistant bubble via the existing `streamingText`/`Bubble` path; commits it to history on done; skips if the user already started chatting.
- Static `SUGGESTIONS` replaced by `buildScoutStarters(plan)`, rendered as chips until the manager's first question (before the brief and as follow-ups beneath it).
- Follow-ups continue through `streamAsk` unchanged.

### Task 4 — ✅ Done: Tests + verify
**Files:** `lib/__tests__/client/scoutStarters.test.ts` (new), `lib/__tests__/client/brief.test.ts` (new)

- [x] `buildScoutStarters`: contextual prompts when a rec exists (captain vs vice, out→in, hold case, mixed/one-side); generic fallback when null.
- [x] `streamBrief`: token accumulation (no preamble drop), partial-line buffering, error event, HTTP + network failure — also covers the shared `postNdjsonStream`.
- [x] `ask.test.ts` still green after the refactor onto the shared reader.
- [x] `npx tsc --noEmit` clean, `eslint` 0 errors, `vitest` 233 passed.
- Note: no React component-test harness in this repo (node env) — panel behaviour (fires once, re-fires, renders opener, accepts follow-up) is verified in-app rather than unit-tested.

### Task 5 — ⏳ In-app verify (the whole bet) — pending user's browser pass
- `npm run dev` (key now configured in the worktree `.env.local`) → load a manager: pitch paints, the conversation **opens itself** with a streamed brief naming the deadline + the real transfer/captain (cross-check the "This week & long-term plan" drawer — no invented numbers).
- Contextual starters reflect the actual captain/vice + out→in; clicking one runs a tool-grounded answer.
- Re-analyze re-fires the brief; switching manager resets the conversation; no-key path still greets via the deterministic fallback.
