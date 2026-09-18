## ADDED Requirements

### Requirement: The bootstrap distinguishes target, in-play and last-locked gameweeks
`BootstrapData` SHALL expose `targetGameweek` (the first gameweek with `finished === false` and `deadline_time` later than now), `inPlayGameweek` (the `is_current` gameweek when its deadline has passed and it is not finished; otherwise null), and `currentGameweek` (FPL's `is_current`). Detection SHALL be pure functions of the events list and a supplied clock.

#### Scenario: Preparation week
- **WHEN** GW4 is `finished` and `is_current`, GW5 has a future deadline, and the clock is between them
- **THEN** `targetGameweek` is GW5, `inPlayGameweek` is null, `currentGameweek` is GW4

#### Scenario: Live round
- **WHEN** GW5's deadline has passed, GW5 is not `finished`, and GW6 has a future deadline
- **THEN** `targetGameweek` is GW6, `inPlayGameweek` is GW5, `currentGameweek` is GW5

#### Scenario: Pre-season
- **WHEN** no gameweek is `is_current` and GW1 has a future deadline
- **THEN** `targetGameweek` is GW1, `inPlayGameweek` is null, `currentGameweek` is null

#### Scenario: Season over or API mid-rollover
- **WHEN** no gameweek has a future deadline
- **THEN** `targetGameweek` equals `currentGameweek` (the last finished gameweek) and `inPlayGameweek` is null

### Requirement: The analysis gameweek is the target; the picks gameweek is the last locked one
`SquadAnalysisResult.currentGw` and `deadline` SHALL be the target gameweek's id and deadline. `SquadAnalysisResult.squadGw` SHALL be the last locked gameweek used to fetch picks, and `inPlayGw` SHALL carry the in-play gameweek or null. Every scorer, planner, chip evaluation, alert, prompt and label SHALL use `currentGw`; only the picks fetch SHALL use `squadGw`.

#### Scenario: Pipeline during the preparation week
- **WHEN** the pipeline runs while GW5 is the target and GW4 is locked
- **THEN** picks are fetched for GW4, `currentGw` is 5, `squadGw` is 4, `deadline` is GW5's, and the fixture signals' first fixture for every player is their GW5 fixture

#### Scenario: Fixture window
- **WHEN** fixture signals are computed for the analysis
- **THEN** the five-gameweek run covers the target through target + 4 and `gw1Fdr` is the target's fixture difficulty

#### Scenario: Statistical denominator matches the backtest
- **WHEN** statistical signals are computed for the analysis
- **THEN** per-gameweek rates divide by the target gameweek, as `research/composite-backtest/build-dataset.ts` does for its target round

### Requirement: Presentation names the target gameweek and its deadline
The header, the scout greeting and system prompt, the deadline brief and the plan verdict SHALL name the target gameweek and quote its deadline; while `inPlayGw` is non-null the header MAY additionally show the in-play gameweek.

#### Scenario: Greeting on deadline day
- **WHEN** the scout brief is generated on 2026-09-18 with GW5 the target
- **THEN** it greets for GW5 and quotes the GW5 deadline, not GW4's

### Requirement: Horizons originate at the target
The transfer horizon SHALL rescore the target and the four gameweeks after it. The captain horizon SHALL cover the five gameweeks after the target and SHALL NOT apply `ep_next` to any horizon entry (the target is scored separately with `ep_next`).

#### Scenario: Transfer horizon gameweeks
- **WHEN** the target is GW5
- **THEN** the transfer horizon's per-gameweek scores are for GW5–GW9

#### Scenario: Captain horizon gameweeks
- **WHEN** the target is GW5
- **THEN** the captain horizon entries are GW6–GW10 and none uses the `ep_next` blend

### Requirement: Chip last-call timing uses the target
Chip last-call and expiry-pressure logic SHALL evaluate against the target gameweek.

#### Scenario: First-half last call
- **WHEN** the target is GW19 and a first-half chip is held
- **THEN** the last-call window is surfaced for GW19 (previously it could only appear once GW19 was `is_current`, i.e. after its deadline)

### Requirement: Locked-picks semantics are preserved where they matter
`/api/squad` SHALL fetch picks for the last locked gameweek; `/api/fixtures` SHALL compute FDR runs and gameweek flags from the target.

#### Scenario: Squad route during the preparation week
- **WHEN** `/api/squad` is called with GW4 locked and GW5 the target
- **THEN** the picks returned are GW4's

### Requirement: The harness records fixture alignment without rewriting history
Captures SHALL record `squadAsOfGw = squadGw` and `pipelineGw = currentGw`, and every pool and universe row SHALL carry `fixture_gw` equal to the gameweek its fixture signals were computed from. Files and records captured before this change SHALL NOT be modified.

#### Scenario: Clean capture after the change
- **WHEN** a pre-deadline capture runs with GW5 the target
- **THEN** the record has `gw = 5`, `pipelineGw = 5`, `squadAsOfGw = 4`, and every row in `gw05.csv` and `gw05.universe.csv` has `fixture_gw = 5`

#### Scenario: Earlier files untouched
- **WHEN** the change lands
- **THEN** `pool/gw04*.csv` and any pre-change `gw05*.csv` are byte-identical to before and carry no `fixture_gw` column

### Requirement: The fit uses only alignment-verified rows (proposed default)
`fit_live.py` SHALL include a row only when its `fixture_gw` equals its `gw`; rows lacking the column SHALL be excluded and counted, and the fit report SHALL state the excluded count and reason.

#### Scenario: Legacy rows excluded
- **WHEN** the dataset contains GW4/GW5 rows without `fixture_gw` and GW6+ rows with `fixture_gw == gw`
- **THEN** only the GW6+ rows enter the fit and the report reads `excluded N rows: fixture_gw missing or ≠ gw (captured before target-gameweek-alignment)`

### Requirement: Replays and ep-gated decisions are unchanged
`research/squad-eval/replay.ts` and `transfer-replay.ts` SHALL re-run byte-identical, and the ep-denominated transfer gate SHALL produce the same recommendation on the same inputs.

#### Scenario: Replay invariance
- **WHEN** both replays are re-run after the change
- **THEN** `report.md` and `transfer-report.md` are byte-identical to the committed files
