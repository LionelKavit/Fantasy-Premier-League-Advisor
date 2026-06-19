## ADDED Requirements

### Requirement: Point-in-time labeled dataset
The system SHALL build an offline dataset of (player × gameweek × season) rows where features are computed only from data available **before** that gameweek and labels are the realized FPL points over a chosen horizon.

#### Scenario: No lookahead
- **WHEN** the feature row for gameweek N is built
- **THEN** it uses only data known up to and including gameweek N−1 (no end-of-season totals, no realized GW N stats)

#### Scenario: Next-3-gameweek label
- **WHEN** labels are attached
- **THEN** each row carries the realized FPL points **summed over the next 3 gameweeks** (GW N…N+2) as the label

#### Scenario: Two feature tiers (core/parity vs candidate/exploratory)
- **WHEN** features are emitted
- **THEN** **Tier-1 core features** are produced by the app's own signal functions (`computeStatisticalSignals` / `computeFixtureSignals` / `computeMarketSignals` / `computeTrendSignals`) so training X matches runtime X (these are the only ones whose fitted weights may ship)
- **AND** **Tier-2 candidate features** (rolling xG90/xA90, finishing over/under-performance, rolling bps90, congestion from `kickoff_time`, transfer momentum, opponent-strength, n_fixtures, penalty-taker flag, understat metrics, defensive-contribution where available) are included for ablation/feature-importance only and **tagged distinctly** — they do not produce shippable weights unless first added to the runtime pipeline by a follow-up change
- **AND** each column is tagged with the seasons it is available for (e.g. defensive-contribution = 2025-26 only)

#### Scenario: Identified Tier-2 candidate gaps are tracked for evaluation
- **WHEN** Tier-2 candidate features are assembled
- **THEN** they include the four runtime-pipeline gaps identified for this work (detailed in design.md), each engineered and assessed via ablation:
  - **DC threshold probability** — P(crosses the 2025-26 defensive-contribution threshold: ≥10 CBIT DEF / ≥12 CBIRT MID-FWD) from the rolling CBIRT distribution, not the continuous `defensiveScore` the pipeline uses today (2025-26 data only)
  - **Own-team attacking strength** — the currently-missing own-team side of the matchup (own `strength_attack` × opp `strength_defence`, home/away), complementing the opponent-only `opponentStrength`
  - **Fixture congestion / rest days** — days-since-last-match and matches-in-7-days from `kickoff_time` (no recency/rotation signal exists in the pipeline today)
  - **Deterministic set-piece + availability** — penalty/set-piece premium from `penalties_order` and a numeric availability discount from `chance_of_playing_next_round`, as deterministic (backtestable, offline-robust) alternatives to the LLM `setPieceHierarchy`/`injurySeverity` signals
- **AND** each remains Tier-2: shippable only after a follow-up change adds it to the runtime pipeline

#### Scenario: Features are point-in-time rolling aggregations
- **WHEN** a feature for gameweek N is computed from per-GW data
- **THEN** it is a rolling aggregation (per-90 / rate) over prior gameweeks (≤ N−1) — the realized GW N row is never used as its own feature

#### Scenario: Target-gameweek fixture/opponent context is joined
- **WHEN** building the feature row for gameweek N
- **THEN** target-GW (and next-3) fixture context — FDR, home/away, opponent attack/defence strength, and fixture count (DGW/BGW) — is joined from `fixtures.csv` / `teams.csv`

#### Scenario: xP included; LLM-context excluded
- **WHEN** the dataset is built
- **THEN** FPL expected-points (`xP` = `ep_this`, taken from the `gw{N}.csv` column, which equals the `xP{N}.csv` file) **is included** as a feature/baseline
- **AND** LLM-context signals are omitted (not historically available), documented as a limitation

#### Scenario: Per-season xP integrity gate (never shift clean data)
- **WHEN** deciding how to use `xP` for a season
- **THEN** a per-season integrity diagnostic runs over ALL the season's gameweeks — checking whether "surprise-blank" players (nailed starters in GW N−1 with ≥60 min, 0 min in GW N) retain a meaningfully positive `xP` (pre-deadline) or are driven to ≈0 (post-match contaminated)
- **AND** seasons that pass use **raw `xP` untouched** (never shifted)
- **AND** seasons that fail have `xP` **excluded** (set missing / dropped), not shifted — `shift(1)` is at most a separately-flagged salvage experiment, never the default and never applied to clean seasons
- **AND** pooled training includes only clean-`xP` seasons in the `xP` feature, keeping the column semantically uniform
- **AND** the per-season verdict is recorded in the report

#### Scenario: Distorting rows are filtered or flagged
- **WHEN** rows are emitted
- **THEN** low-minute players (below the minutes threshold) and double/blank-gameweek rows are filtered or explicitly flagged so they don't silently distort the fit

#### Scenario: Per-row availability flags (no silent degradation)
- **WHEN** a feature's source data is absent for a season
- **THEN** each row carries availability flags — at minimum `has_fixture` (team mapping present, so fixture signals are real vs degenerate-zero for pre-2020-21 seasons that lack a `team` column), `has_xP`, `has_xg`, `has_dc`
- **AND** an unavailable feature is emitted as `0` (not a fabricated value), gated by its flag — so consumers (the benchmark, and the Phase 2 fit) must filter on the flag rather than treat `0` as a real measurement (e.g. fit the fixture weight only on `has_fixture==1` rows)

#### Scenario: Single long-format dataset
- **WHEN** the dataset is written
- **THEN** it is **one long/tidy file** (Parquet preferred; CSV acceptable) with one row per (season × gameweek × player), columns = identifiers (season, GW, element, position, name — carried but not used as features) + features (tagged Tier-1/Tier-2 and by season-availability) + the next-3 label (and raw next-GW points)
- **AND** per-position fitting filters on the `position` column at fit time (not separate per-position files)
- **AND** this single file is the handoff artifact consumed by both the Phase 1 benchmark and the Phase 2 fitter
