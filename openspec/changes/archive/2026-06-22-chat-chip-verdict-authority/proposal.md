## Why

A previously-fixed bug has re-emerged. [`scout-chat-chip-grounding`](../archive/2026-06-22-scout-chat-chip-grounding/proposal.md) stopped the chat being a "third brain" — it grounded the chat in the committed `chipPlan` and told it to *explain and defend* that decision, not re-derive a different one. That worked because the chat had no independent chip principles to reason from.

Then [`knowledge-grounded-conversation`](../archive/2026-06-22-knowledge-grounded-conversation/proposal.md) injected `chips.md` into the chat system prompt. That re-armed the chat with the raw chip principles — including the Triple Captain line "a single great home fixture can justify it" — so it once again re-derives a chip verdict from scratch and contradicts the committed plan. Observed live (GW38): the panels/`chipPlan` say play **Bench Boost**, but the chat argues **Triple Captain** is the stronger play. The `chipPlanBlock` "treat as authoritative" instruction sits *before* a full page of expert principles and is too soft to hold against them.

This was the explicit risk noted in the `knowledge-grounded-conversation` design ("knowledge could push the chat to re-derive chip verdicts"); the chosen mitigation (ordering the plan before the principles) proved insufficient.

## What Changes

- **Make the committed chip plan authoritative *over* the curated knowledge in the chat.** Strengthen the chip grounding so the chat treats `chipPlan` as the settled chip *verdict* and the curated principles as *explanation only*. Concretely: an explicit subordination instruction stating that when the principles would suggest a different chip than the committed plan, the chat defers to the plan and explains the plan's reasoning — it never recommends playing a different chip this gameweek (or playing a chip when the plan holds).
- **Keep authority, not a gag.** The chat still explains chip trade-offs, answers "why this chip over that one", and cites the principles to *justify* the committed call — it just doesn't issue a competing verdict. Non-chip and general chip-principle questions are unaffected.

No data, route, or pipeline changes — this is a system-prompt grounding fix. The chip plan is still computed only by the orchestrator.

## Capabilities

### New Capabilities
- `chat-chip-verdict-authority`: In the chat, the committed `chipPlan` is the authoritative chip verdict and the curated knowledge is subordinate to it — the Scout explains and defends the plan's chip call rather than re-deriving a competing one, even with the chip principles in context.

### Modified Capabilities
<!-- None — no living openspec/specs exist; this is a new capability that hardens prior prompt grounding. -->

## Impact

- **Chat**: `lib/scout/system-prompt.ts` — strengthen the committed-plan chip authority relative to `expertKnowledgeBlock()` (e.g. an explicit subordination clause, placed so it governs the knowledge — recency after the knowledge block, and/or framing the knowledge as general principles already applied to this squad by the plan).
- **Tests**: `lib/__tests__/scout/ask.test.ts` — assert the strengthened subordination instruction is present when both a `chipPlan` and the knowledge are in the prompt; assert the chat still receives the knowledge (explanation) and the committed plan (verdict).
- **Data/Deps**: none. Prompt text only.
