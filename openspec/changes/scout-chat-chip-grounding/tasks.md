## Tasks

### Task 1: Send the slim chip plan with the request
**Capability:** ask-the-scout-backend
**Files:** `components/panel/AskTheScout.tsx`, `lib/client/ask.ts`

- `AskTheScout`: derive `chipPlan` from `plan.transfers?.chipPlan` as `{ chip, status, triggerGw, reason }[]` (drop `draft`); pass to `streamAsk`.
- `streamAsk`: include `chipPlan` in the POST body.

### Task 2: Forward and ground
**Capability:** ask-the-scout-backend
**Files:** `app/api/ask/route.ts`, `lib/scout/chat.ts`, `lib/scout/system-prompt.ts`

- `/api/ask`: read `chipPlan` from the body; forward to `runScoutConversation`.
- `runScoutConversation`: accept an optional `chipPlan`; pass it to `buildScoutSystemPrompt`.
- `buildScoutSystemPrompt(sc, freeTransfers, chipPlan?)`: when present and non-empty, render an authoritative "Chip plan" section (each chip's decision + reason) plus the explain-and-defend instruction. Omit when absent.

### Task 3: Tests + verify
**File:** `lib/__tests__/scout/ask.test.ts`

- With a supplied chip plan → system prompt contains the chip section, the play-now chip, and the authority instruction.
- Without one → no chip section (existing assertions still pass).
- `npx tsc --noEmit`, `eslint .`, `vitest` green. Manual: "TC or Bench Boost?" → chat backs the panels.

## Verification
Asking the Scout a chip question yields the same verdict as This Week and the Chips tab; the chat no longer re-derives a contradicting chip pick.
