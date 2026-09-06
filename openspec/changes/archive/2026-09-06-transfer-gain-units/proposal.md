# Transfer gain units — record the ep delta the gate uses, and stop printing composite as "ep"

## Why

The transfer gate is ep-denominated: a free move is admitted only when `epNext(in) − epNext(out)` clears the 1.5-point bar (`lib/optimizer/allocate.ts`). But the number that gets surfaced afterwards — `ValidTransfer.gw1Gain` and the action's `netGain` (`Σ gw1Gain`, `lib/optimizer/synthesis.ts`) — is a **composite-score difference** on a 0–1 scale, and it is printed with an "ep" label in the deadline brief email and in the live-eval capture. On 2026-09-06 this produced a false defect report ("the GW4 move cleared at +0.3 against a 1.5 bar"); the real ep delta was +6.7. A reader of the brief would draw the same wrong conclusion every week. Separately, the live transfer eval (`research/squad-eval`) stores only the composite delta per move, so it cannot calibrate the gate's own projection against realized points — the one thing the eval exists to do.

## What Changes

- **Capture records the gate's number.** Each move in the live-eval record gains `epOut`, `epIn`, and `epDelta` (from the two players' `epNext`, null-safe), alongside the existing composite `gw1Gain`. `score-live.ts` reports projected `epDelta` next to realized `in − out` so the transfer-bar calibration (new-season-readiness Task 4) has its input. The capture's console summary prints the ep delta and labels the composite delta as composite.
- **The brief prints ep, labelled as ep.** `scripts/deadline-brief.ts` prints each move's `epNext` delta (available on `primary.transfers[].candidate/weakPlayer.player.epNext`) and the action's summed ep delta; the composite figure is no longer shown as "ep". When a player's `epNext` is null the line says `unavailable` rather than substituting the composite.
- **Units are stated at the type.** `ValidTransfer.gw1Gain` / `gw5Gain` and `TransferAction.netGain` get doc comments naming their unit (composite-score delta, display ordering only) and pointing at where the ep decision lives. No rename — `netGain` has consumers in synthesis, the brief, and the LLM synthesis prompt's JSON contract; a comment is the cheap, non-breaking fix.
- **No decision logic changes.** The gate, the allocator, the synthesis JSON contract, and every recommendation are untouched.

## Capabilities

### New Capabilities
- `transfer-gain-units`: the ep delta that drives a transfer decision is recorded with the recommendation and is the only quantity presented to a manager as expected points; composite deltas are labelled as composite wherever they surface.

### Modified Capabilities
<!-- None — no existing spec under openspec/specs/ covers the brief or the eval record. -->

## Impact

- `lib/optimizer/types.ts` (doc comments only), `scripts/deadline-brief.ts` (two lines of output), `research/squad-eval/live-types.ts` + `capture.ts` + `score-live.ts` (record fields, console label, report column).
- The GW4 record already in `live-log.json` predates the fields; `score-live.ts` treats a missing `epDelta` as `unavailable — captured before transfer-gain-units` rather than back-computing it from today's feed (that would be anachronistic).
- No UI change: `components/` render neither `gw1Gain` nor `netGain`. No API/config/dependency change.
