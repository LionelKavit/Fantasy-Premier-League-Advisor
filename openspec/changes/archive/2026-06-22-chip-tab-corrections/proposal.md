# Chips tab corrections — name the right half, drop the timeline axis

## Why

Two issues on the Chips tab:

1. **Wrong half in the reason text.** A Bench Boost reason read "First-half Bench Boost expires at the GW38 deadline" — but GW38 is the **second**-half deadline (a first-half Bench Boost expires at GW19). The orchestrator prompt states the deadline gameweek but never names *which* half ([chip-orchestrator.ts:76](lib/optimizer/chip-orchestrator.ts)), so the LLM guessed and mislabeled it — even contradicting its own Triple Captain reason in the same plan, which said "second half."
2. **The gameweek-axis visual is unwanted.** The chip-name pills stacked over a gameweek tick add clutter, and the reasons list below already conveys the plan. (This **supersedes** the uncommitted `chip-timeline-stacking` change, which fixed a marker collision — moot once the axis is removed.)

## What changes

- **Name the current half in the orchestrator grounding** (first half, GW1–19; or second half, GW20–38) so the reasons use the correct label and stop inventing it.
- **Remove the gameweek-axis-with-markers block** from `ChipTimeline`. Keep the "Chips left" row and the reasons list — with the play-now entry highlighted (retained from the timeline work) — as the single chip view.

## Scope & decisions

- **Two related Chips-tab corrections in one change**: one backend reason-quality fix (orchestrator grounding) and one UI trim (`ChipTimeline`).
- **The reasons list stays** as the chip view, with the play-now distinguished. Removing the axis does not remove the play-now legibility, just the redundant marker visual.
- **Supersedes `chip-timeline-stacking`** (its proposal is removed); the play-now highlight in the reasons list that it introduced is retained here.

## Out of scope

- The chat's chip grounding (separate change, `scout-chat-expiring-chip-advice`).
- Changing which chips the orchestrator schedules or how the deterministic windows are produced.
