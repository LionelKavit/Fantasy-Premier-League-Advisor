# Design

## Context

By the time this change runs, three pieces exist: the deadline on the plan (`gameweek-deadline-surface`), the streamed `/api/brief` endpoint with the same NDJSON contract as `/api/ask` (`scout-opening-brief`), and the conversation promoted to the always-visible hero slot (`conversation-first-shell`). `AskTheScout` already streams replies token-by-token via `streamAsk` (`lib/client/ask.ts`) into a `Bubble`, holds history client-side, and resets when the page reloads a plan (`app/page.tsx` clears `chat` on `load`). The only missing pieces are: a client transport for the brief, contextual prompts, and the trigger that makes the Scout open on its own.

## Key Decisions

### 1. The brief is just the conversation's first assistant turn
No separate "brief" widget. `streamBrief` streams into the existing `streamingText` → `Bubble` path and is committed to history like any reply. This means the opener looks and behaves exactly like the Scout talking, and the rest of the panel (scroll, markdown render, error states) is reused for free.

### 2. `lib/client/brief.ts` mirrors `lib/client/ask.ts`; share the reader if identical
The NDJSON reader (fetch → stream → line-buffer → dispatch `onToken`/`onError`) is the same as `ask.ts`. Decision: if the logic is byte-for-byte equivalent, extract a shared `readNdjsonStream` helper and have both transports call it; otherwise mirror it. Avoid two copies of partial-line buffering drifting apart.

### 3. Fire exactly once per analysis, re-fire when the analysis changes
The trigger is keyed on the analysis identity (team + gw + free transfers), not on render. A guard (ref/keyed effect) ensures the brief fires once when a fresh plan is ready and again on Re-analyze / manager switch — both of which already reset `chat` — but never on ordinary re-renders or lens/drawer toggles. This is the subtle correctness risk of the change, so it is called out as its own decision.

### 4. Starters are derived from the plan, pure and fetch-free
`buildScoutStarters(plan)` returns 3–4 prompts from the loaded `GameweekPlan`: captain vs vice, the recommended `out → in` (or "should I transfer at all?" when held), a hit question, a risk question. Pure function, unit-testable, sibling to `lib/client/longTermSummary.ts`. Falls back to the existing generic four when there is no recommendation. Grounding the prompts in the real names is what turns generic suggestions into an invitation into *this* week's detail.

### 5. Follow-ups are unchanged
After the opener, typing or clicking a starter goes through `streamAsk` → `/api/ask` → the agentic tool-use loop, exactly as today. This change touches the *opening* and the *prompts*, not the conversation engine.

### 6. Degrade like the rest of the app
If the brief stream errors or carries the no-key fallback token, it still renders as the Scout's first message and the manual chat keeps working — the opener never blocks the panel.

## Design constraints

- **Reuse the existing streaming UI** — the brief must render through the current `streamingText`/`Bubble` path, not a new render branch.
- **Idempotent open** — exactly one brief per analysis; re-fire only on analysis change. No double-greeting, no greet-on-every-render.
- **No new fetch for starters** — `buildScoutStarters` reads only the already-loaded plan.
- **Engine untouched** — `streamAsk`, `lib/scout/chat.ts`, and the tools are not modified.
- **Keep `ask.ts` DRY** — extract the shared NDJSON reader rather than duplicating it.
- **Depends on** `scout-opening-brief` (endpoint) and `conversation-first-shell` (hero slot + the props it wired into `AskTheScout`).

## Component map

```
lib/client/brief.ts            // streamBrief({teamId,freeTransfers}, handlers) — NDJSON reader (shared with ask.ts if identical)
lib/client/ask.ts              // optionally: extract shared readNdjsonStream
lib/client/scoutStarters.ts    // buildScoutStarters(plan): string[] (contextual, with generic fallback)
components/panel/AskTheScout.tsx// auto-fire brief once per analysis → first bubble; starters from buildScoutStarters
app/page.tsx                   // pass plan + ready signal into AskTheScout (props wired by conversation-first-shell)
lib/__tests__/client/scoutStarters.test.ts // contextual vs fallback prompts
```

## Reused
- `streamAsk` / the NDJSON dispatch in `lib/client/ask.ts`; the `streamingText`/`Bubble`/markdown render in `AskTheScout`; the page's existing chat-reset-on-load.
- `GameweekPlan` / sub-types for starter derivation; the `/api/brief` contract from `scout-opening-brief`.

## Follow-ups
- A "what changed since last week" delta opener, persisted history, and proactive push are explicitly out of scope (noted in the proposal) — this change establishes the proactive-open surface they would later build on.
