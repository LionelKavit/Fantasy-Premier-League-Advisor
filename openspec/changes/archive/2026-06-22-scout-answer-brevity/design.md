# Design

## Context

`buildScoutSystemPrompt(sc, freeTransfers)` assembles the chat assistant's system prompt: persona + scope + grounding + current situation + a "How to format your answer" block + a "What to say" block ([lib/scout/system-prompt.ts](lib/scout/system-prompt.ts)). The current formatting block asks for "concise, plain-English prose" and "a few tight sentences plus an optional short list" but sets no ordering (answer-first) and no length ceiling, so the model produces well-reasoned but long, multi-paragraph replies.

## Key decisions

### 1. Answer-first, with a concrete length target
The single highest-leverage instruction is "first sentence = the answer." Pair it with a numeric default (2–4 sentences, ~90-word ceiling for a normal reply) so the model has a concrete shape to hit rather than a vibe ("concise"). 4.6 honours explicit targets reliably.

### 2. One short list, not stacked paragraphs
Keep short bullet lists for genuine enumerations (comparing 3+ options) but cap at one and forbid stacking multiple prose paragraphs. This directly addresses the observed failure mode (verdict → three paragraphs of qualification → restated verdict).

### 3. Brevity is the default, depth on request
Explicitly carve out "unless the user asks you to go deeper / walk them through it" so detailed follow-ups still work. The cap governs the default turn, not every turn.

### 4. Preserve what works
The no-tables / no-headings / sparing-bold / "add reasoning, don't restate the panels" rules stay — they already shape good answers. Only the length/ordering guidance is rewritten.

## Files
```
lib/scout/system-prompt.ts   // rewrite the "How to format your answer" block; keep "What to say"
```

## Tests
- The existing ask-loop test asserts the system prompt still contains its scope/format markers (`/only/i`, `/fantasy premier league/i`, `/markdown tables/i`, `/restate/i`) — keep those phrases so the test stays valid, and (optionally) add an assertion that the new answer-first / length guidance is present.
- `tsc`/`eslint`/`vitest` green. Qualitative check in the browser: replies lead with the verdict and stay tight.
