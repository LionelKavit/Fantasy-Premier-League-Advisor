# Design — deterministic ep-unavailable notice

## The gap
`evaluateSingleTransfer` already branches on the ep-missing case (`deltaEp === null → hold`), but its only output is a `rollReason` string fed to the LLM synthesis prompt. The user-facing `OptimizerResult.primaryRecommendation` (type `ROLL`, etc.) is produced by the LLM, so the *reason* for holding is non-deterministic. We add a deterministic channel.

## Typed hold reason (optimizer)
`SingleTransferResult` gains `holdReason: TransferHoldReason | null` where
`type TransferHoldReason = 'ep_unavailable' | 'below_threshold' | 'no_valid_targets'`.
Set it in the existing branches:
- no valid transfers → `'no_valid_targets'`
- gate fails with `deltaEp === null` → `'ep_unavailable'`
- gate fails with `deltaEp !== null` (below the points bar) → `'below_threshold'`
- a transfer is recommended → `null`

This is additive; `rollReason` (the human string for the LLM) stays.

## Deterministic notice (result + UI)
- `OptimizerResult` gains `dataNotice: string | null`.
- In `synthesis.ts`, after the LLM result is assembled, set `dataNotice` **deterministically** from the optimizer's `singleResult.holdReason`: when it is `'ep_unavailable'`, set a fixed plain-language string; otherwise `null`. The LLM never authors this field.
- `ThisWeekDetail` renders `transfers.dataNotice` as a small, calm banner (info, not error) near the transfer block when present — so even if the LLM narrative omits it, the user sees the reason.

Message (fixed): _"Transfer recommendations are paused — FPL hasn't published expected points (ep_next) for the upcoming gameweek yet. They'll resume once projections are available."_

## Why tie it to the gate, not a separate ep health check
The request is specifically "whenever recommendations are gated because of missing ep_next." The gate's `ep_unavailable` branch is exactly that signal, so the notice is driven by it — no parallel availability heuristic to keep in sync. (Note: with `ep_next` currently populated, the notice won't show in a normal in-season demo — it's the correct affordance for the genuine pre-GW1 / blanked-ep case.)

## Validation
- Unit: `evaluateSingleTransfer` sets `holdReason='ep_unavailable'` when the best transfer's `epNext` is null; `'below_threshold'` when below the bar; `null` when recommending.
- Unit: `dataNotice` is set iff `holdReason==='ep_unavailable'`.
- Browser: force the ep-null path (a squad/candidate with null `ep_next`) and confirm the banner renders.
- App gate clean.
