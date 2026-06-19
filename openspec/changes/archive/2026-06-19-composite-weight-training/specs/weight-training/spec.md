## ADDED Requirements

### Requirement: Composite weights are fit from data, per position
The system SHALL fit the linear composite weights via unconstrained ridge regression, separately per position, on the Phase 1 dataset, and ship them only if they beat the current weights and baselines on held-out data.

#### Scenario: Fit on the normalized signal-map (coefficients map to weights)
- **WHEN** the fit features are assembled
- **THEN** they are the **normalized per-position `signalMap` values** the weights actually multiply (one column per `SCORING_WEIGHTS` key, via `buildSignalMap`/`NORMALIZATION_BOUNDS`) — not the raw signal components — so ridge coefficients map 1:1 to `SCORING_WEIGHTS[position]`
- **AND** since the Phase 1 dataset emits the composite total + raw components + baselines (not the full signal map), the dataset builder is first extended to emit those normalized columns

#### Scenario: Per-position unconstrained ridge fit
- **WHEN** weights are trained
- **THEN** an unconstrained ridge (L2) regression is fit separately for GK/DEF/MID/FWD on the signal-map features + `epNextSignal` + `ppg` (label = next-3-GW realized points)

#### Scenario: Availability flags and gate-clean xP are honored
- **WHEN** rows are selected for the fit
- **THEN** each feature is fit only where its availability flag is set — `has_fixture==1` for the fixture weight, `has_xg==1` for xG-derived signals, `has_xP==1` **and** a gate-clean season for the `xP`/`epNext` feature (contaminated 2025-26 xP excluded) — and `low_minute==1` rows are dropped

#### Scenario: Time-aware validation
- **WHEN** the model is validated
- **THEN** training and validation use a time-aware split (held-out later season or walk-forward) — never a random shuffle — and both train and held-out metrics are reported; the regularization strength is chosen on held-out performance

#### Scenario: Ship only on improvement
- **WHEN** the fitted weights are re-run through the benchmark
- **THEN** they are committed to `lib/config.ts` only if they beat the hand-tuned composite AND the baselines (`xP`/`ppg`) on held-out data; otherwise the current weights stand and only the findings/report ship

#### Scenario: Only parity (Tier-1) features produce shippable weights
- **WHEN** weights are fit
- **THEN** the shippable fit uses only the Tier-1 core features the runtime composite computes (so coefficients map back to `SCORING_WEIGHTS`)
- **AND** Tier-2 candidate features from the dataset are assessed for predictive value (feature-importance/ablation) but do **not** ship as composite weights here — a candidate that proves valuable requires a follow-up change to add it to the runtime pipeline first

#### Scenario: Runtime unchanged apart from constants
- **WHEN** fitted weights are adopted
- **THEN** the only runtime change is the weight values plus folding `epNextSignal` into the weighted base sum — `computeCompositeScore` still computes `Σ signal × weight`, with no model artifact, inference, or new latency

#### Scenario: LLM-context excluded from the fit
- **WHEN** training
- **THEN** the LLM-context adjustment is not part of the linear fit (absent from the dataset) and the runtime `llmAdj` term is left as-is, documented as a limitation
