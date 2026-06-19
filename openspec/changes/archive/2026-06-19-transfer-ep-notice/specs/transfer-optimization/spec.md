## ADDED Requirements

### Requirement: A missing-ep_next hold is reported deterministically to the user
When the transfer optimizer holds specifically because `ep_next` is unavailable, the UI SHALL state that reason deterministically — independent of the LLM narrative.

#### Scenario: Optimizer carries a typed hold reason
- **WHEN** `evaluateSingleTransfer` returns without a recommended transfer
- **THEN** it sets `holdReason` to `'ep_unavailable'` (the gate's `Δep === null` branch), `'below_threshold'` (the gate's points-bar branch), or `'no_valid_targets'` (no valid transfers)
- **AND** a recommended transfer leaves `holdReason` null; the existing `rollReason` string is unchanged

#### Scenario: ep-unavailable produces a deterministic notice
- **WHEN** the optimizer result is assembled and `holdReason === 'ep_unavailable'`
- **THEN** `OptimizerResult.dataNotice` is set to a fixed plain-language message (authored in code, not by the LLM); otherwise it is null

#### Scenario: The notice renders in the UI
- **WHEN** `ThisWeekDetail` renders and `transfers.dataNotice` is present
- **THEN** it shows a calm, info-styled banner near the transfer block stating that recommendations are paused because FPL hasn't published expected points for the upcoming gameweek — even if the LLM narrative omits it

#### Scenario: Normal in-season operation is unaffected
- **WHEN** `ep_next` is available and the optimizer recommends a transfer or holds for another reason
- **THEN** `dataNotice` is null and no banner is shown; ranking and gate behavior are unchanged
