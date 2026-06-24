## ADDED Requirements

### Requirement: The composite does not flatten under low minutes (cold-start)
At season start (and for any low-minute player), the composite SHALL still rank on `ep_next` rather than collapsing to a single constant fallback.

#### Scenario: Low-minute players still follow ep_next
- **WHEN** `computeCompositeScore` runs for a player below `minMinutes`
- **THEN** it still incorporates `market.epNextSignal` (FPL's projection) in the score instead of returning a flat `insufficientDataFallbackScore` that bypasses the epNext anchor
- **AND** the constant fallback is used only when `ep_next` is also unavailable

#### Scenario: Early-GW ranking is non-degenerate
- **WHEN** the pitch and optimizer run at GW1–3 of 2026-27 (every player under `minMinutes`)
- **THEN** composite scores show a meaningful spread (tracking `ep_next`), not a uniform 3.0/10

### Requirement: The full pipeline is evaluated forward from GW1
The system SHALL capture and score the live pipeline's captain and transfer recommendations prospectively, since the ep-absent historical replays could not exercise `ep_next`.

#### Scenario: Captain live-eval is active
- **WHEN** 2026-27 begins
- **THEN** `squad-eval-captain-live` is implemented and capturing pre-deadline picks from GW1

#### Scenario: Transfer recommendations are captured live
- **WHEN** the live optimizer produces a transfer recommendation each gameweek (with real `ep_next` + LLM)
- **THEN** it is logged pre-deadline and scored post-GW by realized `in − out` over next-1/next-3 vs holding and vs the manager's actual transfer — the forward analog of `squad-eval-transfer-replay`, reusing the shared `research/squad-eval/` reconstruction + metric helpers
- **AND** the report is comparable to the deterministic-floor numbers so the `ep_next` + LLM lift and the `τ=1.5` gate are validated live

### Requirement: Tier-2 defensive-contribution is evaluated on live data
The defensive-contribution signal (outside FPL's `ep_next`) SHALL be evaluated for inclusion once 2026-27 accrues enough data.

#### Scenario: DC threshold tested when data exists
- **WHEN** ~GW8+ of 2026-27 `defensive_contribution` data is available
- **THEN** the Tier-2 augmentation eval is re-run including `t2_dc_threshold_prob` on live data, and a fold-in decision is recorded (it was 0%-coverage historically, so this is its first real test)

### Requirement: Calibrations are revalidated against the new season
The composite weights and the transfer-hold threshold SHALL be revalidated against 2026-27 and refit only if the data moved.

#### Scenario: Freshness check after a few gameweeks
- **WHEN** a handful of 2026-27 gameweeks have been played
- **THEN** the composite weight fit and the transfer-threshold curve are recomputed and compared to the shipped weights and `τ=1.5`
- **AND** a refit/retune is applied only if FPL's 2026-27 scoring rules or the meta shifted them materially; the comparison is documented either way

### Requirement: Chip-count handles the two-halves expiry
The chips-remaining model SHALL correctly reflect the two-sets-per-season rule, including dropping an unused first-half chip after the GW19 deadline.

#### Scenario: First-half chips expire at the GW19 deadline
- **WHEN** the GW19 deadline passes and an unused first-half chip exists
- **THEN** `deriveChipsRemaining` no longer counts it (verify FPL's `bootstrap-static` `chips` stops advertising the expired chip, or otherwise adjust the derivation) so the chip narrative never recommends a chip the manager can no longer play

### Requirement: Restructure is coherent with the long-term plan
The Restructure section (This Week) and the Long Term transfer-horizon view SHALL share context so they do not present contradictory stories. A restructure's dream upgrade SHALL be judged over the planning horizon, not only the next-gameweek ep delta, reflecting that a restructure is a multi-week investment.

#### Scenario: The restructure dream is evaluated over the horizon
- **WHEN** a restructure chain is evaluated once the season is live and the horizon is meaningful
- **THEN** the dream upgrade's value is assessed over the multi-gameweek planning horizon (the same projection the Long Term tab uses), not only the single next-GW ep delta
- **AND** a dream the horizon flags as WAIT (or never surfaces as a worthwhile target) is not pitched as a buy-now restructure

#### Scenario: The two tabs tell one story
- **WHEN** a restructure is recommended, or a premium target appears in the transfer horizon
- **THEN** the Long Term view and the Restructure section reference the same target and timing — the dream a restructure funds is consistent with (and visible in) the long-term plan, never contradicting it
