# Design

## Context

- The orchestrator builds its prompt in `chip-orchestrator.ts` ([buildPrompt](lib/optimizer/chip-orchestrator.ts)); it computes `deadline` from the chip calendar and writes "The current half's chip deadline is GW{deadline}" — but never states which half, so the LLM-authored reasons can mislabel it.
- `ChipTimeline` ([components/panel/ChipTimeline.tsx](components/panel/ChipTimeline.tsx)) renders a chips-left row, a gameweek axis with chip markers, and a reasons list. After `chip-timeline-stacking` the markers were grouped per gameweek and styled by status, and the reasons list highlights the play-now.

## Key decisions

### 1. State the half in the orchestrator grounding
Derive a half label — `currentGw <= CHIP_CALENDAR.firstHalfExpiryGw` → "first half (GW1–19)", else "second half (GW20–{seasonEndGw})" — and put it in the prompt ("These are the manager's {half} chips; they expire at GW{deadline}"), with a nudge to refer to it as that half rather than guessing. Deterministic, one place, no behavioural change beyond reason wording.

### 2. Remove the axis, keep the reasons list
Delete the gameweek-axis block (the `ticks`/`byGw`/marker rendering) from `ChipTimeline`. Keep the chips-left row and the reasons list, with the play-now entry highlighted (the useful part of the timeline work). Remove the now-unused locals (`ticks`, `maxGw`, `byGw`) and any imports they alone needed. The empty state ("no upcoming gameweek clears the bar" / "all used") is unchanged.

### 3. Supersede chip-timeline-stacking
That change's marker-collision fix is obsolete once the axis is gone; its proposal is removed and its reasons-list play-now highlight is retained and re-justified here. Net Chips-tab state: chips-left row + reasons list (play-now highlighted), no axis.

## Files
```
lib/optimizer/chip-orchestrator.ts        // buildPrompt: name the current half
components/panel/ChipTimeline.tsx          // remove the gameweek-axis marker block; keep chips-left + reasons list
lib/__tests__/optimizer/chip-orchestrator.test.ts  // assert the prompt names the correct half
```

## Tests
- Orchestrator: the prompt-grounding test asserts the prompt identifies the second half at a second-half gameweek (and first half at a first-half gameweek) — extends the existing "grounds the prompt" test, which already inspects the prompt string.
- `ChipTimeline`: no existing render test; verify in the browser that the axis is gone and the reasons list (with the highlighted play-now) remains.
- `tsc`/`eslint`/`vitest` green (watch for unused-var lint after removing the axis locals).
