# Surface a deterministic notice when transfers are held for missing ep_next

## Why
`transfer-hold-threshold` made the optimizer **hold** when `ep_next` is unavailable (transfers chosen on the composite alone are negative-EV). But that reason currently only goes into the **LLM synthesis prompt** (`rollReason`) — the LLM may or may not relay it, so the user can be left seeing "Roll your transfer" with no explanation. When recommendations are paused specifically because FPL hasn't published expected points (e.g., pre-GW1 / off-season), the UI should say so **deterministically**, not depend on the model.

## What changes
- **`transfer-optimization`** — the optimizer carries a typed hold reason and a deterministic data notice that bypasses the LLM:
  - `SingleTransferResult` gains `holdReason: 'ep_unavailable' | 'below_threshold' | 'no_valid_targets' | null`, set by the existing go/hold branches in `evaluateSingleTransfer`.
  - `OptimizerResult` gains `dataNotice: string | null`, set deterministically (not by the LLM) when `holdReason === 'ep_unavailable'`.
  - `ThisWeekDetail` renders the notice as a small banner near the transfer recommendation whenever `dataNotice` is present.

## Impact
- Runtime + UI change (`lib/optimizer/*`, `components/panel/ThisWeekDetail.tsx`). Additive — ranking and the gate logic are unchanged; this only *reports* an existing hold reason.
- Browser-verifiable; the message is plain-language ("FPL hasn't published expected points for the upcoming gameweek yet").

## Out of scope
- Changing when the optimizer holds (that's `transfer-hold-threshold`, archived).
- A league-wide ep-availability health check separate from the transfer gate (the notice is tied to the gate firing, per the request).

## Depends on
`transfer-hold-threshold` (the `ep_next`-null → hold behavior whose reason this surfaces).
