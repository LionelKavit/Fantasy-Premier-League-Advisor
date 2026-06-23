## Context

Two LLMs touch chips: the **chip-orchestrator** (authoritative — the only thing that sets `play-now`, produces the `chipPlan`) and the **chat** (an independent agentic loop). The chat's system prompt currently has, in order:

1. situation + committed-plan grounding, including `chipPlanBlock` — "the app's committed recommendation — treat as authoritative … do not produce a different chip verdict";
2. `expertKnowledgeBlock` — the full `chips.md` + `rank-strategy.md` principles (added by `knowledge-grounded-conversation`).

The knowledge in (2) re-arms the chat to re-derive a chip verdict, overriding the softer instruction in (1). The result is the "third brain" `scout-chat-chip-grounding` had removed.

## Goals / Non-Goals

**Goals:**
- The committed `chipPlan` is the chat's chip *verdict*; the curated principles are *explanation only*.
- The chat still explains chip trade-offs and uses the principles to justify the committed call.
- Fix is prompt-level, deterministic to assert (the instruction is present), and doesn't weaken the now-valuable knowledge grounding for non-chip reasoning.

**Non-Goals:**
- Changing how the orchestrator decides chips, or whether BB/TC is "right" for any team.
- Removing `chips.md` from the chat (its general value stands; only the *chip-verdict re-derivation* must be subordinated).
- Any tool, route, data, or pipeline change.

## Decisions

**1. Subordinate the knowledge to the committed plan explicitly, with recency.**
Add an explicit authority clause that the curated chip principles are *general* guidance the committed plan has **already applied to this squad**, so for the actual chip decision the chat defers to the plan: it MUST NOT recommend playing a different chip this gameweek than the plan's `play-now` (nor recommend playing a chip when the plan holds), and uses the principles only to *explain* the committed call. Place this clause so it governs the knowledge — i.e. *after* `expertKnowledgeBlock` (recency), in addition to keeping `chipPlanBlock`'s existing instruction. *Alternative:* rely on ordering alone (plan before principles) — rejected; that's exactly what already failed.

**2. Frame the knowledge block as subordinate where it's introduced.**
`expertKnowledgeBlock`'s heading/intro states these are general principles, not a license to override the committed plan's chip decision. Cheap, reinforces (1).

**3. Keep full knowledge; subordinate only the chip *verdict*.**
Do not trim `chips.md`/`rank-strategy.md` per-consumer (messy, loses value for rank/EO and general chip questions). The constraint is scoped to the *play-this-week chip decision*, not to discussing chips. *Alternative:* strip the TC-selection lines from the chat's copy of `chips.md` — rejected; brittle and removes legitimate explanatory content.

**4. Authority, not a gag (preserve the prior change's principle).**
The instruction explicitly permits explaining trade-offs and answering comparative questions ("why Bench Boost over Triple Captain") by surfacing the plan's reasoning — it only forbids issuing a competing *play* recommendation.

## Risks / Trade-offs

- **Over-suppression** (chat refuses to discuss alternative chips). → The clause explicitly allows explanation/comparison; only the competing *verdict* is forbidden. Manual check covers this.
- **Prompt-only fix can't be proven by a unit test for LLM behaviour.** → Unit-test the *presence* of the subordination instruction; cover the behaviour with the manual verification (ask "TC or BB?" with a committed BB plan → chat backs BB).
- **Keyless / no chip plan.** → When no `chipPlan` is supplied, there's no committed verdict to defend; the subordination clause renders only alongside the chip plan, so behaviour is unchanged.

## Migration Plan

Additive prompt text in `buildScoutSystemPrompt`. No data/route/pipeline change. Rollback = revert.

## Open Questions

- Should the subordination clause live inside `chipPlanBlock` (with a forward reference to the principles) or as a standalone closing line after the knowledge? Leaning a standalone closing authority line for recency; resolve in build — no spec impact.
