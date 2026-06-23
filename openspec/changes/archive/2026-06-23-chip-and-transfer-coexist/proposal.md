## Why

When the plan plays a **non-transfer chip** this gameweek (Bench Boost or Triple Captain), the manager still makes their normal free transfer — but the This Week tab and the verdict bar hide it and show only "Play your Bench Boost". The brief gets it right (it surfaces João Pedro → Watkins *and* the chip), so the surfaces disagree, and the panels under-show the week's actual plan.

The cause is structural: both the verdict ([moves.ts](../../../lib/client/moves.ts) `transferSegment`) and This Week ([ThisWeekDetail.tsx](../../../components/panel/ThisWeekDetail.tsx) `activeChip` branch) treat *every* play-now chip as replacing the transfer recommendation — rendering only the chip's `draft` transfers. That's right for Wildcard / Free Hit (whose `draft` *is* the transfers), but Bench Boost / Triple Captain have `draft: null` ([chip-orchestrator.ts:138](../../../lib/optimizer/chip-orchestrator.ts)), so the normal `primaryRecommendation` transfer is dropped from both panels.

## What Changes

- **Give the chip its own section in This Week.** Restructure the This Week tab into separate, clearly-labelled sections in order: **Transfer**, **Captaincy**, **Chip** (only when a chip is played this gameweek), then **Restructure**. The chip announcement ("Play your Bench Boost") moves out of the Transfer section into its own Chip section — the chip and the transfer are never shown in the same section, and a Transfer section always exists.
- **Transfer section shows the week's actual transfers.** It shows the chip's draft for transfer chips (Wildcard / Free Hit), otherwise the `primaryRecommendation` (the normal free transfer / roll / hit). So a draftless play-now chip (Bench Boost / Triple Captain) no longer hides João Pedro → Watkins — it shows in the Transfer section while the Chip section announces the chip, matching the brief.
- **Verdict bar order: transfer, then captain, then chip.** When a draftless chip coexists with a concrete move, the bar shows the move *and* the chip (e.g. "João Pedro → Watkins · Captain Haaland · Play your Bench Boost"). A drafted chip (WC/FH) shows "Play your {chip}" in the transfer segment (the draft is the transfer plan).

No data or pipeline changes — `primaryRecommendation` and `chipPlan` are already computed; this is a presentation fix so the panels show the complete plan the brief already describes.

## Capabilities

### New Capabilities
- `chip-and-transfer-coexist`: A draftless play-now chip (Bench Boost / Triple Captain) and the normal free transfer are shown together in the This Week tab and the verdict bar, consistent with the brief; transfer chips (Wildcard / Free Hit) still show their draft alone.

### Modified Capabilities
<!-- None — no living openspec/specs exist; the prior glanceable-verdict change is archived. -->

## Impact

- **This Week**: `components/panel/ThisWeekDetail.tsx` — restructure into Transfer / Captaincy / Chip (conditional) / Restructure sections; the Transfer section shows the draft for transfer chips else `primaryRecommendation`; a new Chip section announces the play-now chip; Captaincy moves above Restructure.
- **Verdict**: `lib/client/moves.ts` — `buildVerdict` shows the move *and* the chip when the play-now chip is draftless; a drafted chip shows "Play your {chip}" in the transfer segment.
- **Tests**: `lib/__tests__/client/moves.test.ts` — draftless chip + concrete move → both; draftless chip + roll → roll in transfer, chip in chip; drafted chip → "Play your {chip}" in transfer, no chip segment.
- **Data/Deps**: none. Reads existing `plan.transfers.primaryRecommendation` + `chipPlan`.
