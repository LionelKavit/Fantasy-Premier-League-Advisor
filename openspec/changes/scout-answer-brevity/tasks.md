## Tasks

### Task 1: Tighten the answer-formatting guidance
**Capability:** ask-the-scout-backend
**File:** `lib/scout/system-prompt.ts`

Rewrite the "How to format your answer" block: answer/verdict in the first sentence; default 2–4 sentences (~90-word ceiling) unless the user asks to go deeper; one short list max; no stacked paragraphs. Keep the no-tables / no-headings / sparing-bold / "add reasoning, don't restate the panels" rules and the phrases the ask-loop test checks (`only`, `fantasy premier league`, `markdown tables`, `restate`).

### Task 2: Verify
- Keep `lib/__tests__/scout/ask.test.ts` green (system-prompt phrase assertions); optionally assert the new answer-first/length guidance is present.
- `npx tsc --noEmit`, `eslint .`, `vitest` green. Browser check: replies lead with the verdict and stay tight.

## Verification
Chat replies open with the answer and read as a few tight sentences (plus at most one short list), not multi-paragraph essays — while "walk me through it" still yields detail.
