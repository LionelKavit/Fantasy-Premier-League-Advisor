## Context

Three surfaces describe the week: the **verdict bar** + **This Week panel** (structured, from `plan.transfers.chipPlan`), the **chat** (grounded via `chipPlanBlock`/`heldChipsBlock` in the system prompt — wired through [AskTheScout.tsx](../../../components/panel/AskTheScout.tsx)), and the **proactive brief** (`lib/scout/brief.ts`).

Two grounding gaps, verified in code:
- The brief's `BriefGrounding` carries only held chip *names*, so it cannot mention a play-now chip.
- The curated knowledge base is loaded into the optimizer/captain/chip-orchestrator syntheses via `loadKnowledge` (e.g. chip-orchestrator: `## Expert chip principles\n${loadKnowledge("chips")}`), but the **scout chat never calls `loadKnowledge`** — so the agentic loop runs without the grounded principles. The one-chip-per-gameweek rule lives in `chips.md` and the orchestrator prompt, but not in the chat.

## Goals / Non-Goals

**Goals:**
- The brief leads with a play-now chip when one exists, consistent with the panels.
- The chat agentic loop is grounded in the curated knowledge base (chip + rank strategy), so it reasons with the same expert content as the panels — including "one chip per gameweek".
- Knowledge is a single source of truth (the `.md` files), reused via the existing `loadKnowledge`.

**Non-Goals:**
- Changing how the chip plan is computed (the orchestrator is correct; this conveys it).
- Re-grounding the chat's committed chip plan (`chipPlanBlock` already does that) — only adding the missing *knowledge* layer.
- Injecting full knowledge into the brief (it's a ≤4-sentence spoken greeting, not an agentic loop); the brief only needs the play-now chip fact.
- Resolving any genuine optimizer↔LLM disagreement about *whether* to play a chip.

## Decisions

**1. Add a `chip` field to `BriefGrounding`, derived from the play-now chip.**
`buildBriefGrounding` computes the active play-now chip from `plan.transfers.chipPlan` using the same predicate the panels use (`status === "play-now" && triggerGw === currentGw`) and stores `{ label, reason } | null`. `buildBriefPrompt` gains a "Chip call" fact, and the guidance says: when a chip is play-now, treat it as a top-tier lever — lead with it (alongside the transfer), not as merely "available". `composeDeterministicBrief` appends a chip sentence in the same slot, within the ≤4-sentence shape. The held-chips list stays for context. *Alternative:* pass the whole chip plan to the brief — rejected; the brief only needs the play-now call to stay consistent and token-light.

**2. Brief mentions the chip without dropping the transfer.**
A play-now Bench Boost and a free transfer can coexist; the chip is framed as an additional top lever, not a replacement, so the brief can still name the transfer.

**3. Inject the curated knowledge base into the chat system prompt via `loadKnowledge`.**
`buildScoutSystemPrompt` appends a knowledge section — `## Expert principles\n${loadKnowledge("chips")}\n\n${loadKnowledge("rank-strategy")}` (mirroring the orchestrator's pattern) — to the cached system prompt. Because the system is wrapped in `withCachedSystem`, the ~5 KB of static knowledge is prompt-cached and costs nothing per message. The one-chip-per-gameweek rule therefore reaches the chat *from `chips.md`* (single source of truth) rather than a hardcoded constant. *Alternatives considered:* (a) a hardcoded `ONE_CHIP_PER_GW_RULE` string — rejected; duplicates the knowledge and drifts from `chips.md`; (b) load knowledge per request uncached — rejected; `loadKnowledge` is already in-process cached and the system block is prompt-cached, so injection is effectively free.

**4. Knowledge is general-principle grounding alongside the committed-plan grounding, not a replacement.**
`chipPlanBlock` (authoritative for THIS team's chips) and `heldChipsBlock` stay; the knowledge layer adds the general reasoning principles. Ordering: situation/plan grounding first (team-specific, authoritative), then expert principles (general), so the model treats the committed plan as authoritative and the knowledge as reasoning support.

## Risks / Trade-offs

- **Prompt size grows ~5 KB.** → Static and prompt-cached via `withCachedSystem`; no per-message token cost. `loadKnowledge` already caches in-process.
- **Knowledge could push the chat to re-derive chip verdicts.** → Keep `chipPlanBlock`'s "treat as authoritative; defend THIS plan" instruction ahead of the principles, so knowledge informs *reasoning/explanation*, not a competing verdict.
- **Brief gets busier.** → Chip mentioned only when play-now; the ≤4-sentence cap and "lead with the single highest-leverage decision" guidance still bound it.
- **Missing knowledge file.** → `loadKnowledge` returns "" and the section renders empty — strictly additive, never throws.

## Migration Plan

Additive: one new field on an internal type, prompt-text changes, and a `loadKnowledge` call in the chat prompt. No route, data, or env changes. Keyless mode covered by the deterministic brief path (the chat needs a key regardless). Rollback = revert.

## Open Questions

- Inject both `chips.md` and `rank-strategy.md`, or only `chips.md` for now? Leaning both, since both already ground the syntheses and the chat answers rank/EO questions too. Resolve in build; spec requires at least the chip knowledge (which carries the one-chip rule).
- Should the brief also surface a chip sequenced near its expiry (use-it-or-lose-it), or only strict play-now? Leaning play-now only (matches the panels); expiry nudges already live in chat grounding.
