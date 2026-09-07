## ADDED Requirements

### Requirement: Every capture dumps the full universe at lite tier
Each pre-deadline capture SHALL write `pool/gwNN.universe.csv` containing one row per player in the bootstrap, scored by `scorePlayerLite` with `maxEpNext` equal to the maximum `epNext` over all bootstrap players (floor 1), with `fidelity = "lite"` and `post_deadline = 0`, in the same column set as `pool/gwNN.csv`.

#### Scenario: Universe row count and tier
- **WHEN** a pre-deadline capture completes for gameweek N
- **THEN** `pool/gwNN.universe.csv` has exactly one row per bootstrap player, every row has `fidelity = "lite"`, and the capture record's `pool.universeRows` equals that count

#### Scenario: Runtime-scale ep normalisation
- **WHEN** the universe rows are written
- **THEN** each row's `sm_epNextSignal` equals `min(1, max(0, epNext / maxEpNext))` with the same `maxEpNext` the runtime pipeline would compute for that bootstrap, and `has_xP = 0` when the player's `epNext` is null

### Requirement: The deadline guard covers the universe file
A post-deadline capture SHALL write its universe rows to `pool/gwNN.universe.post-deadline.csv` with `post_deadline = 1`, and SHALL NOT overwrite an existing `pool/gwNN.universe.csv`.

#### Scenario: Late capture
- **WHEN** the write plan is post-deadline
- **THEN** `gwNN.universe.csv` (if present) is unchanged and the sidecar carries the rows

### Requirement: The builder produces two datasets with no duplicate element per gameweek
`score-live.ts` SHALL build `live-dataset.csv` from `gwNN.universe.csv` files only and `live-pool-dataset.csv` from `gwNN.csv` files only, joining `next1_points`, `next3_points`, and `label_gws` by the same code path, dropping `post_deadline = 1` rows and ignoring sidecars in both.

#### Scenario: Two outputs
- **WHEN** `pool/` contains `gw05.csv` and `gw05.universe.csv`
- **THEN** `live-dataset.csv` contains the universe rows for GW5 and none of the full-tier rows, `live-pool-dataset.csv` the reverse, and no (element, gw) pair appears twice in either file

#### Scenario: Legacy gameweeks without a universe file
- **WHEN** `pool/` contains `gw04.csv` but no `gw04.universe.csv`
- **THEN** GW4 contributes rows to `live-pool-dataset.csv` only, and the console states `GW4: universe unavailable — captured before live-dataset-universe`

### Requirement: Parquet derivation accepts a path
`to_parquet.py` SHALL accept an explicit CSV path argument and write the Parquet file beside it, preserving its default behaviour when called without a path.

#### Scenario: Live dataset to Parquet
- **WHEN** `python3 research/composite-backtest/to_parquet.py research/squad-eval/live-dataset.csv` runs
- **THEN** `research/squad-eval/live-dataset.parquet` is written with the same rows and typed numeric columns

### Requirement: Schema parity with the backtest dataset
The universe file SHALL contain every column of the backtest dataset (`research/composite-backtest/build-dataset.ts` `COLUMNS`) with the same semantics, plus the live-only extras; `t2_*` columns SHALL be present and blank.

#### Scenario: Fit reads the live file unchanged
- **WHEN** `fit.py`'s feature list (`FEATURES[pos] + EXTRA`) is applied to `live-dataset.parquet`
- **THEN** every feature column exists and is numeric, and the eligibility filter (`low_minute`, `label_gws`, `has_fixture`, `has_xg`) can be applied without modification
