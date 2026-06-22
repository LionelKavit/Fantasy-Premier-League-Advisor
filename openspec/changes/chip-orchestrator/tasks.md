## Tasks

> The LLM judgment layer. Depends on `chip-single-source-of-truth`; benefits from `chip-candidate-windows`.

### Task 1: Grounding facts builder
**Capability:** chip-orchestrator
**File:** `lib/optimizer/chip-orchestrator.ts` (new)

Assemble the deterministic facts the orchestrator reasons over: the candidate windows, chip state (chips + half + expiry deadlines), and the relevant fixture facts. Pure, token-light.

### Task 2: chips.md-grounded synthesis → structured chipPlan
**Capability:** chip-orchestrator
**File:** `lib/optimizer/chip-orchestrator.ts`

One `llm.complete` with `SCOUT_PERSONA + chips.md` as system + the facts as prompt. Parse a structured plan: per chip, `play-now` (at most one, current gameweek) | sequenced gameweek | hold, with reasoning + confidence. Grounding guard: drop any gameweek not in the provided windows. Attach the canonical draft for an activatable chip.

### Task 3: Wire into the pipeline + keyless passthrough
**Capability:** chip-orchestrator
**File:** `lib/optimizer/index.ts`

Run the orchestrator over the candidate windows; its result becomes `chipPlan` (single source). No key → skip it and pass the deterministic windows through unchanged (all `window`/`hold`). Cache per `team:gw`.

### Task 4: Surfacing + offline badge
**Capability:** chip-orchestrator
**File:** `components/panel/ChipsDetail.tsx`

Render the orchestrator's reasoning in the Chips tab; show an "AI reasoning offline" badge when keyless (reuse the existing offline pattern). This Week activation already derives from `chipPlan` play-now@currentGw (from `chip-single-source-of-truth`).

### Task 5: Tests + verify
- Grounding: prompt carries chips.md + windows; `play-now` only on a provided window; hallucinated gameweek dropped.
- N2: with-key `play-now`@currentGw → This Week activation; keyless → no `play-now`, This Week shows no chip, Chips shows windows + offline badge.
- Single source: both tabs read the orchestrator's `chipPlan`.
- Caching per `team:gw`; bounded tokens.
- `npx tsc --noEmit`, `eslint .`, `vitest` green; manual with a key.

## Verification
- With a key: the Chips tab shows a sequenced, chips.md-grounded plan with reasoning, and This Week activates a chip only when the orchestrator says play it this week — the two never contradict. Keyless: windows + offline badge, no This Week activation.
