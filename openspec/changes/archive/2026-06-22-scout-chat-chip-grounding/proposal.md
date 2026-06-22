# Ground the chat in the chip plan — stop the third brain

## Why

The Scout chat contradicts the panels on chip questions. Asked "TC or Bench Boost?", the chat answered Triple Captain while This Week and the Chips tab (both reading the orchestrator's `chipPlan`) recommended Bench Boost. The cause is structural: the chat (`runScoutConversation`) is an **independent LLM** whose grounding (`ScoutContext`, built from the raw `AnalysisContext`) does **not** include the orchestrator's chip decision. Its `get_plan` tool returns `chipsRemaining` — *which* chips are held — but not the committed `chipPlan` (play-now / window / hold + reasons) ([tools.ts:155–175](lib/scout/tools.ts)). So it re-derives a chip verdict from scratch and can diverge — a third brain alongside the single source the panels read. (In the observed case the chat even contradicted its own arithmetic: it noted the bench adds ~10 pts and TC ~7.3, then picked TC.)

This is the same dual-brain failure the chip single-source-of-truth work removed for This-Week-vs-Chips — except the chat was never wired to `chipPlan`.

## What changes

- **Pass the committed chip plan to the chat.** The page already holds it (`plan.transfers.chipPlan`). The Ask request carries a slim chip summary (chip, status, gameweek, reason — no draft payload), and the `/api/ask` route forwards it to `runScoutConversation`.
- **Ground the system prompt in it.** `buildScoutSystemPrompt` renders an authoritative "Chip plan" section listing each held chip's decision and reason, with an instruction: this is the app's committed recommendation — explain and defend it; do not invent a different chip verdict. If the user disagrees, surface the plan's reasoning rather than contradicting it.
- **Behaviour-preserving elsewhere.** No tool changes; non-chip questions are unaffected. When no chip plan is supplied (e.g. keyless, or insights unavailable), the section is omitted and the chat behaves as before.

## Scope & decisions

- **Client-sent, not server-refetched.** The client sends exactly what's on screen, so the chat is consistent by construction — and there's no risk of the ask path recomputing insights (an LLM spend) if the insights cache has expired mid-session. The slim summary strips the `draft` (the large `ValidTransfer[]`) to keep the payload small.
- **System-prompt grounding, not a tool.** Always-present grounding guarantees consistency without depending on the model choosing to call a tool. The chip plan is constant within a conversation, so it doesn't disturb prompt caching.
- **Authority, not a gag.** The chat still answers freely and adds reasoning; it simply treats the chip *decision* as settled (the panels' verdict), the way it already treats prices and projections as ground truth.

## Out of scope

- The Chips-tab timeline marker rendering bug (a separate change, `chip-timeline-stacking`).
- Changing how the orchestrator itself decides chips, or the staleness of end-of-season input stats.
