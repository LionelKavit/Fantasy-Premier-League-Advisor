## ADDED Requirements

### Requirement: Capture timing is judged at write time
The capture SHALL determine whether it is post-deadline from the clock read immediately before writing its artefacts, after the pipeline has run, and SHALL stamp that time as `capturedAt`.

#### Scenario: Pipeline crosses the deadline mid-run
- **WHEN** the capture selects a target gameweek before its deadline but finishes the pipeline after it
- **THEN** the write plan is post-deadline, regardless of the clock at target selection

### Requirement: A post-deadline capture never displaces a pre-deadline artefact
If a pre-deadline, non-retrospective record exists for the target gameweek, a post-deadline capture SHALL leave that record untouched. A post-deadline record SHALL be written only when no such clean record exists, and it SHALL carry `postDeadline: true`.

#### Scenario: Clean record exists
- **WHEN** a post-deadline capture runs and `live-log.json` holds a record for the gameweek with `postDeadline === false` and `captureMode` pre-deadline (or absent)
- **THEN** `live-log.json` is not modified and the console reports that the clean record was preserved

#### Scenario: No clean record exists
- **WHEN** a post-deadline capture runs and the gameweek has no record, or only a post-deadline or retrospective one
- **THEN** the flagged record is written for audit, and it remains excluded from captain and transfer scoring

### Requirement: Post-deadline pool rows are quarantined
Pool rows from a post-deadline capture SHALL be written to `pool/gwNN.post-deadline.csv`, never to `pool/gwNN.csv`, and every pool row SHALL carry a `post_deadline` column equal to `1` for such captures and `0` otherwise.

#### Scenario: Sidecar file
- **WHEN** a post-deadline capture writes its pool
- **THEN** `pool/gwNN.csv` (if present) is unchanged and `pool/gwNN.post-deadline.csv` contains the rows with `post_deadline = 1`

#### Scenario: Clean capture
- **WHEN** a pre-deadline capture writes its pool
- **THEN** rows go to `pool/gwNN.csv` with `post_deadline = 0`

### Requirement: The dataset builder ingests only clean rows
`score-live.ts` SHALL build `live-dataset.csv` only from files matching `gwNN.csv`, SHALL drop any row whose `post_deadline` is `1`, SHALL treat a missing `post_deadline` column as clean, and SHALL report the number of dropped rows and the sidecar files it ignored.

#### Scenario: Sidecar present
- **WHEN** `pool/` contains `gw05.csv` and `gw05.post-deadline.csv`
- **THEN** only `gw05.csv` rows enter the dataset and the console names the ignored sidecar

#### Scenario: Flagged row in a clean file
- **WHEN** a row in a `gwNN.csv` has `post_deadline = 1`
- **THEN** it is excluded and counted in the dropped-row total

#### Scenario: Legacy file without the column
- **WHEN** a `gwNN.csv` predates the column (no `post_deadline` header)
- **THEN** all its rows are ingested as clean

### Requirement: The guard is pure and tested
The write decision SHALL be a pure function (`planCaptureWrite`) with unit tests covering: pre-deadline write, pre-deadline overwrite of an earlier pre-deadline record, post-deadline with a clean record, post-deadline with no record, post-deadline over a post-deadline record, and post-deadline over a retrospective record.

#### Scenario: Test suite
- **WHEN** `vitest run` executes
- **THEN** `research/squad-eval/capture-guard.test.ts` passes all of the above cases
