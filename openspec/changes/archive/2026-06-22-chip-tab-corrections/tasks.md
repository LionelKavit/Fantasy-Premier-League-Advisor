## Tasks

> Supersedes the uncommitted `chip-timeline-stacking` change (its proposal removed). The stacking marker code is still in `ChipTimeline` on the branch until Task 2 removes the axis; the reasons-list play-now highlight it added is retained.

### Task 1: Name the current half in the orchestrator grounding
**Capability:** chip-orchestrator
**File:** `lib/optimizer/chip-orchestrator.ts`

In `buildPrompt`, derive a half label (`currentGw <= CHIP_CALENDAR.firstHalfExpiryGw` → first half GW1–19, else second half GW20–{seasonEndGw}) and state it alongside the deadline, instructing the model to use that half rather than guessing.

### Task 2: Remove the gameweek-axis marker block
**Capability:** chip-timeline
**File:** `components/panel/ChipTimeline.tsx`

Delete the gameweek-axis block (the `ticks` / `byGw` / marker rendering); keep the chips-left row and the reasons list with the play-now entry highlighted. Remove the now-unused locals/imports.

### Task 3: Tests + verify
**File:** `lib/__tests__/optimizer/chip-orchestrator.test.ts`

- Extend the prompt-grounding assertion: the prompt names the second half at a second-half gameweek (and first half at a first-half gameweek).
- `ChipTimeline` has no render test — verify in the browser the axis is gone and the reasons list (with highlighted play-now) remains.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.

## Verification
The Chips-tab reasons label the correct half (no "first-half" at GW38), and the tab shows only the chips-left row + reasons list (play-now highlighted), with the gameweek-axis visual removed.
