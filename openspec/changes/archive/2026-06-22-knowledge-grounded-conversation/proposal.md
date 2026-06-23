## Why

The app's premise is that the conversation never contradicts — and is grounded in the same expert content as — the panels. Two gaps break that:

1. **The proactive brief omits the chip recommendation.** [buildBriefGrounding](../../../lib/scout/brief.ts) feeds the opening brief only the manager's *held* chip names (`remainingChips`), never the committed chip plan's play-now decision. So when the panels say "Play your Bench Boost" this gameweek, the brief can't see it and instead says "you've still got every chip in the locker" — under-selling, sometimes contradicting, the panels' highest-leverage call.

2. **The chat agentic loop is not grounded in the curated knowledge base.** The repo's expert content — [chips.md](../../../lib/knowledge/chips.md) (chip timing/sequencing, incl. "one chip per gameweek — never two in the same week") and [rank-strategy.md](../../../lib/knowledge/rank-strategy.md) (effective-ownership / chase-vs-protect) — is loaded into the optimizer, captain, and chip-orchestrator syntheses via `loadKnowledge`, but **never into the scout chat**. So during its tool-use loop the Scout reasons without the grounded principles, and can e.g. suggest stacking two chips in one gameweek.

## What Changes

- **Brief leads with the chip call.** Extend `BriefGrounding` with the chip plan's play-now recommendation (label + reason), and update both brief paths — `streamOpeningBrief` (LLM) and `composeDeterministicBrief` (keyless) — so a play-now chip is named as a top-tier lever rather than treated as merely "available". Makes the brief consistent with the verdict bar / This Week panel.
- **Chat is grounded in the curated knowledge base.** Inject the expert knowledge (`chips.md`, `rank-strategy.md`) into the chat system prompt via the existing `loadKnowledge`, mirroring how the optimizer/captain syntheses already do it. This grounds the agentic loop in the same principles the panels are built on — and the one-chip-per-gameweek rule comes from the curated content itself (single source of truth), not a hardcoded string.

No breaking changes. Both surfaces degrade gracefully: no chip plan → brief behaves as today; `loadKnowledge` returns "" if a file is missing, so knowledge grounding is strictly additive.

## Capabilities

### New Capabilities
- `knowledge-grounded-conversation`: The conversational surfaces are grounded like the panels — the proactive brief leads with a play-now chip from the committed plan, and the chat agentic loop is grounded in the curated expert knowledge base (chip + rank strategy) — so the conversation neither contradicts nor reasons without the grounded content.

### Modified Capabilities
<!-- None — no living openspec/specs exist; this is a new capability. -->

## Impact

- **Brief**: `lib/scout/brief.ts` — `BriefGrounding` gains a `chip` field; `buildBriefGrounding`, `buildBriefPrompt`, and `composeDeterministicBrief` updated. The brief route already runs the fully-merged plan, so no route change.
- **Chat**: `lib/scout/system-prompt.ts` — inject `loadKnowledge("chips")` and `loadKnowledge("rank-strategy")` into the chat system prompt (cached system → no per-message cost). The existing committed-plan grounding (`heldChipsBlock`, `chipPlanBlock`) stays; knowledge is general-principle grounding alongside it.
- **Tests**: `lib/__tests__/scout/brief.test.ts` (brief names a play-now chip; absent when none) and a system-prompt assertion that the curated knowledge (incl. the one-chip rule text) is present in the chat prompt.
- **Data/Deps**: none new. Reuses `loadKnowledge`, `plan.transfers.chipPlan`, and `chipsRemaining`.
