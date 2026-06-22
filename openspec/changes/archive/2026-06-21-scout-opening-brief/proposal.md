# Scout opening brief — the Scout speaks first (backend)

## Why

Pocket Scout is pitched as a scout *agent*, but the agent never opens its mouth: "Ask The Scout" starts empty behind the third tab and waits to be prompted. The product knows — deterministically — the single highest-leverage decision each week, yet it makes the manager dig for it across equal-weight panels.

This change builds the **backend brain** of a proactive opening: a dedicated, **streamed** brief in the Pocket Scout voice that, on load, leads with the one decision that matters and names the deadline — "Right, before Saturday's 11:00 deadline: one clean transfer and an easy captain call." Grounded in the real plan, never invented. The **UI that consumes it is a separate change** (`proactive-scout-brief-ui`).

It is a *dedicated* LLM call (not a reuse of the existing syntheses) so the greeting can be written as punchy spoken word, while still grounding on the already-computed optimizer/captain results.

## What Changes

- **New capability `opening-brief`** — `streamOpeningBrief({ context, onToken })` in `lib/scout/brief.ts`: `llm.stream()` with `SCOUT_PERSONA` (`lib/llm/persona.ts`) plus a brief-specific instruction (greet, lead with the highest-leverage decision, name the deadline, ≤4 sentences, spoken-aloud, no headings/tables/markdown). It grounds on a **compact summary** assembled from the plan: the primary transfer recommendation + `narrativeSummary`, the captain pick, the top alert, chips remaining, and the deadline. **No tools** (unlike the agentic chat).
- **New endpoint** — `POST /api/brief` accepting `{ team_id, freeTransfers }`, returning the **same NDJSON event stream** as `/api/ask` (`{type:"token"|"error"|"done"}`). It reuses the cached `runGameweekPlanInsights` for grounding, so it does **not** re-spend the optimizer/captain work the insights phase already did.
- **Graceful no-key fallback** — when `ANTHROPIC_API_KEY` is absent, the endpoint streams a one-shot **deterministic** composed brief (from the same grounding summary) so the Scout still greets, consistent with the app's degrade-don't-fail ethos.

## Scope & decisions

- **Dedicated call, not reuse** (user decision): a distinct prompt tuned for a spoken greeting; grounding reuses computed results, not the prose.
- **Reuse transport, don't reinvent**: mirror the `/api/ask` `ReadableStream` NDJSON helper; the client transport lands in the UI change.
- **Grounded, never invented**: the brief may only reference figures present in the grounding summary; the prompt forbids inventing prices/scores/projections (same discipline as `lib/optimizer/synthesis.ts`).
- **Stateless**: derives grounding server-side from `team_id` (+ cached context); persists nothing.
- **Depends on** `gameweek-deadline-surface` for the deadline in the grounding summary.

## Out of scope

- The chat UI wiring / auto-fire / contextual starters (`proactive-scout-brief-ui`).
- Tools in the brief, multi-turn, persistence, push/notifications.
