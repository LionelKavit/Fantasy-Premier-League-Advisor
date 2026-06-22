## Tasks

> Deterministic only. Establishes the single source + invariant; the orchestrator and better triggers are later changes.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 237 passed. `ChipRecommendation` gained `status` + `draft` (kept `triggerGw`); `TransferType` dropped `WILDCARD`/`FREE_HIT`; the transfer synthesis no longer elects chips; This Week renders a chip only from `chipPlan` `play-now`@currentGw (none yet — deterministic emits `window` only). FREE_HIT's broken ROLL-coercion is gone with the type. In-app pass pending.

### Task 1 — ✅ Done: Unified chip-plan model
**Capability:** chip-strategy
**File:** `lib/optimizer/types.ts`

`ChipRecommendation` gains `status: "window" | "play-now" | "hold"`, `gw`, and an optional `draft` (the chip's transfer set). Remove `WILDCARD` / `FREE_HIT` from `TransferType` (chips are no longer transfer actions).

### Task 2: Deterministic generator emits windows + canonical draft
**Capability:** chip-strategy
**File:** `lib/optimizer/chip-interaction.ts`

Emit `window` / `hold` entries only (never `play-now`). Compute the wildcard/free-hit `draft` once and attach it. Keep the existing detection (improved triggers are `chip-candidate-windows`).

### Task 3: Strip chip election from the transfer synthesis
**Capability:** chip-strategy
**File:** `lib/optimizer/synthesis.ts`

Remove `WILDCARD` / `FREE_HIT` from the output schema and `mapTransferAction`; `primaryRecommendation` is FREE / HIT / ROLL only. FREE/HIT/ROLL behavior unchanged.

### Task 4: Render from the single source + invariant
**Capability:** chip-strategy
**Files:** `components/panel/ThisWeekDetail.tsx`, `components/panel/ChipsDetail.tsx` / `ChipTimeline.tsx`

This Week renders a chip activation iff `chipPlan` has `play-now` at `currentGw` (none yet — deterministic-only); the Chips tab renders the full `chipPlan` (windows). Use the entry's canonical `draft`.

### Task 5: Tests + verify
- Invariant: `play-now`@currentGw → This Week activates; windows-only → This Week shows no chip, Chips shows windows.
- Transfer synthesis: WILDCARD/FREE_HIT reply no longer activates a chip; FREE/HIT/ROLL unchanged; FREE_HIT not coerced to ROLL anywhere.
- `npx tsc --noEmit`, `eslint .`, `vitest` green (update optimizer/synthesis + chip tests).

## Verification
- In-app: the Chips tab shows chip windows; This Week no longer shows "Play your Wildcard" (it returns once `chip-orchestrator` adds LLM-gated activation).
