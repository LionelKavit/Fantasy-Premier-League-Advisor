## Tasks

> Depends on `scout-opening-brief` (the `/api/brief` endpoint) and `conversation-first-shell` (chat is the hero). Frontend only.

### Task 1: Brief client transport
**Capability:** scout-chat-ui
**Files:** `lib/client/brief.ts` (new), optionally `lib/client/ask.ts` (extract shared NDJSON reader)

`streamBrief({ teamId, freeTransfers }, handlers)` mirrors `streamAsk`: POST `/api/brief`, stream the NDJSON, dispatch `onToken` / `onError`, resolve with the accumulated text. If the reader/buffer logic is identical to `ask.ts`, factor it into a shared helper and have both call it (keep it DRY).

### Task 2: Contextual starters
**Capability:** scout-chat-ui
**File:** `lib/client/scoutStarters.ts` (new)

`buildScoutStarters(plan): string[]` — derive 3–4 prompts from the plan: captain vs vice, the recommended `out → in` move (or "should I transfer at all?" when held), a hit question, and a risk question. Fall back to the existing generic four when `transfers`/`captaincy` are null.

### Task 3: Proactive open + starters in the panel
**Capability:** scout-chat-ui
**Files:** `components/panel/AskTheScout.tsx`, `app/page.tsx`

- Pass the `plan` (or the derived bits + a "ready" signal) into `AskTheScout`.
- On a fresh analysis, auto-fire `streamBrief` **once**, streaming into a first assistant bubble via the existing `streamingText`/`Bubble` path; commit it to history when done. Guard so it fires exactly once per analysis and re-fires when the analysis changes (Re-analyze / manager switch — chat already resets at `app/page.tsx`).
- Swap the static `SUGGESTIONS` for `buildScoutStarters(plan)`.
- Follow-ups continue through `streamAsk` unchanged.

### Task 4: Tests + verify
**Files:** `lib/__tests__/client/scoutStarters.test.ts` (new), update `AskTheScout` tests if present

- `buildScoutStarters`: contextual prompts when a rec exists (names captain/vice + out→in); generic fallback when null.
- `streamBrief`: mocked stream dispatches tokens and resolves; partial-line buffering (mirror the `ask.ts` test).
- Panel: brief fires once per analysis, re-fires on analysis change, renders the streamed opener, then accepts a normal follow-up.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.

### Task 5: End-to-end verify (the whole bet)
- `npm run dev` → enter a manager ID: pitch paints, the conversation **opens itself** with a streamed brief naming the deadline + the real transfer/captain (cross-check the "Full breakdown" drawer — no invented numbers).
- Contextual starters reflect the actual captain/vice + out→in; clicking one runs a tool-grounded answer.
- Re-analyze re-fires the brief; switching manager resets the conversation; no-API-key still greets via the deterministic fallback.
- Capture a screenshot of the conversation-first landing via the preview MCP tools.
