# Scout persona — one consistent Pocket Scout identity across the LLM calls

## Why
The app's LLM calls each open with a *different, ad-hoc* role line — "You are an FPL captaincy advisor…", "…transfer advisor…", "…strategist…" — so there's no single identity or voice. The Scout chat is already a true agent (tool-use loop), but the product as a whole speaks in five disconnected voices. Giving it **one shared persona — "Pocket Scout," an elite FPL analyst with a Premier League post-match pundit's voice** — makes it feel like one coherent expert, layered over the agentic chat and the domain knowledge (chips/rank) already wired in.

## What changes
- **New `lib/llm/persona.ts`** exporting the approved **Pocket Scout** persona (identity + voice + operating principles: reason only from given data, never invent numbers, lead with the *why*, think in rank not just points, be decisive-but-honest, be concise, respect the task's output format).
- Pass the persona as the `system` instruction to the **four reasoning / user-facing calls**:
  - captain synthesis (`synthesizeCaptainPick`),
  - transfer synthesis (`synthesizeRecommendation`),
  - long-term synthesis (`synthesizeLongTerm`),
  - the Scout chat (composed into `buildScoutSystemPrompt`).
- Trim the scattered "You are an FPL X advisor" openers down to each call's *specific task* — identity now comes from the shared persona.

## Out of scope
- **The team-news *extraction* call** keeps its current literal-extraction system (a punditry voice there is irrelevant and could pollute the structured extraction).
- The agentic behaviour / tools themselves (already exist — unchanged).
- Any new tools, loops, or model changes.

## Impact
- Prose-only effect: a consistent expert voice in the verdict, captain note, long-term outlook, and chat. No structured-output change — JSON-returning calls still return JSON (the persona explicitly defers to each task's format).
- `llm.complete` already accepts a `system` parameter, so the plumbing exists.

## Verify
- The persona text is present and applied to all four calls (and **not** the extraction call); JSON-returning syntheses still parse (regression-checked by the e2e flow test); app gate clean.
