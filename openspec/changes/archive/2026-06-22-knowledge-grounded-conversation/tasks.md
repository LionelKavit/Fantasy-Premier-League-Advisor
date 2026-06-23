## 1. Brief grounded in the play-now chip

- [x] 1.1 Extend `BriefGrounding` in `lib/scout/brief.ts` with `chip: { label: string; reason: string } | null`
- [x] 1.2 In `buildBriefGrounding`, derive the play-now chip from `plan.transfers.chipPlan` using the same predicate as the panels (`status === "play-now" && triggerGw === currentGw`); set `chip` accordingly (null when none)
- [x] 1.3 In `buildBriefPrompt`, add a "Chip call" fact and guidance: when a chip is play-now, treat it as a top-tier lever and lead with it (alongside the transfer), not as merely "available"
- [x] 1.4 In `composeDeterministicBrief`, append a chip sentence when `chip` is set, keeping the ≤4-sentence shape

## 2. Chat grounded in the curated knowledge base

- [x] 2.1 In `lib/scout/system-prompt.ts`, append an expert-principles section to the chat system prompt via `loadKnowledge("chips")` and `loadKnowledge("rank-strategy")`, mirroring the chip-orchestrator's `## Expert chip principles` pattern
- [x] 2.2 Order it after the situation/committed-plan grounding so the committed plan stays authoritative and the knowledge informs reasoning (not a competing verdict); keep `chipPlanBlock`'s "treat as authoritative" instruction
- [x] 2.3 Confirm the knowledge sits in the cached system block (`withCachedSystem`) so it carries no per-message token cost

## 3. Tests

- [x] 3.1 `lib/__tests__/scout/brief.test.ts`: `buildBriefGrounding` sets `chip` when a play-now chip exists and `null` when not; `composeDeterministicBrief` includes a chip sentence for a play-now chip and omits it otherwise
- [x] 3.2 Assert `buildScoutSystemPrompt` includes the curated chip knowledge (e.g. the "one chip per gameweek" text from `chips.md`) and the rank-strategy knowledge; with a mocked/cleared knowledge cache, a missing file degrades to no extra context

## 4. Verify

- [x] 4.1 Green gate: `tsc`, eslint, `vitest` pass
- [x] 4.2 Manually verify in the running app (a team with a play-now chip): the opening brief names the play-now chip and no longer says all chips are merely held; ask the Scout to play two chips in one gameweek and confirm it declines, citing one-chip-per-gameweek from the grounded knowledge
