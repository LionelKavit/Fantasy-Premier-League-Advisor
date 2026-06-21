# Proactive Scout brief — wire the Scout to speak first (UI)

## Why

With the deadline on the plan (`gameweek-deadline-surface`), a streamed brief endpoint (`scout-opening-brief`), and the conversation promoted to the hero slot (`conversation-first-shell`), the last step is to make the Scout actually **open the conversation**: on load it streams its brief into the first message, and the suggested prompts become **grounded in this week's real recommendation** instead of four generic strings.

This is what turns the dashboard into a scout — the agent leads with the one decision that matters and invites the manager into the detail on their terms.

## What Changes

- **New client transport `lib/client/brief.ts`** — `streamBrief({ teamId, freeTransfers }, handlers)`, a thin sibling of `lib/client/ask.ts`: POSTs `/api/brief`, reads the NDJSON stream, dispatches `onToken` / `onError`. (If the NDJSON reader stays identical, extract the shared reader from `ask.ts` and have both use it.)
- **New helper `lib/client/scoutStarters.ts`** — `buildScoutStarters(plan)` derives 3–4 contextual prompts from the loaded `GameweekPlan` (e.g. `Why ${captain} over ${vice}?`, `Walk me through ${out} → ${in}`, `Should I take a hit instead?`, `Which of my players are at risk?`), falling back to the current generic four when there is no recommendation.
- **Modified capability `scout-chat-ui`** — `AskTheScout` now:
  - **Auto-fires the brief once** per analysis when the plan is ready, streaming it into a first assistant bubble using the existing `streamingText` / `Bubble` machinery (no new render path). It fires exactly once and **re-fires on Re-analyze / manager change** (the page already resets chat state on load).
  - Replaces the static `SUGGESTIONS` with the **contextual starters** from `buildScoutStarters(plan)`.
  - Leaves follow-ups untouched: they still go through `/api/ask` → the agentic tool-use loop.

## Scope & decisions

- **Fire once, re-fire on reload** — keyed on the analysis so switching manager or Re-analyze produces a fresh greeting; normal re-renders do not.
- **Reuse the existing streaming UI** — the brief is just the conversation's first assistant turn; no separate brief widget.
- **Grounded starters** — derived purely from the already-loaded plan (no fetch).
- **Degrade gracefully** — if the brief stream errors or returns the no-key fallback, it still renders as the Scout's opening message; the manual chat keeps working.
- **Depends on** `scout-opening-brief` (the endpoint) and `conversation-first-shell` (the hero slot). `AskTheScout` gains access to the plan (for starters) and a trigger for the brief.

## Out of scope

- The brief's content/voice and the endpoint (owned by `scout-opening-brief`).
- The layout/hero promotion (owned by `conversation-first-shell`).
- Persisted chat history, push/notifications, a "what changed since last week" delta.
