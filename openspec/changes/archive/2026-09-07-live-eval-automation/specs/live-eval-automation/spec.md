## ADDED Requirements

### Requirement: A single scheduler runs the live-eval pipeline unattended
The system SHALL provide a LaunchAgent (`com.pocketscout.live-eval`, hourly, run-at-load) that executes `scripts/live-eval-tick.ts`, and that tick SHALL run, in order, capture, scoring, dataset build, refit hand-off, and status, with each step idempotent and each failure logged without preventing later independent steps.

#### Scenario: Quiet tick
- **WHEN** no deadline is within 5 hours and no recorded gameweek is newly finished
- **THEN** the tick performs no capture or scoring, rewrites the status file, and exits 0

#### Scenario: Step failure does not cascade
- **WHEN** the scoring step throws
- **THEN** the failure is recorded in state with a timestamp, the dataset and refit steps are skipped for this tick, the status step still runs, and the next tick retries scoring

### Requirement: Capture runs only inside the deadline window and only from the tick
The tick SHALL invoke `capture.ts` when the next deadline is within 5 hours, and `scripts/deadline-brief.ts` SHALL NOT invoke `capture.ts`.

#### Scenario: In-window capture
- **WHEN** a tick runs with the next deadline 4 hours away
- **THEN** `capture.ts` runs (its own guard decides what is written) and state records the gameweek and time on success

#### Scenario: Brief no longer captures
- **WHEN** `scripts/deadline-brief.ts` runs inside its window
- **THEN** it composes and sends the email without spawning `capture.ts`, and `live-log.json` is not modified by it

### Requirement: Scoring triggers on finished, data-checked gameweeks
The tick SHALL run `score-live.ts` when any recorded pre-deadline gameweek newer than `lastScoredGw` has `finished === true` and `data_checked === true` in the bootstrap, and SHALL update `lastScoredGw` only on success.

#### Scenario: Provisional results are not scored
- **WHEN** a gameweek is `finished` but `data_checked` is false
- **THEN** scoring does not run for it and the status file shows it as `awaiting data_checked`

#### Scenario: Scored once
- **WHEN** a gameweek was scored on a previous tick
- **THEN** a later tick with no newer finished gameweek does not re-run scoring

### Requirement: Artefacts are persisted to a data branch
After a successful capture, scoring, or dataset step, the tick SHALL sync the season artefacts into a git worktree on branch `live-eval-data`, commit with a fixed message format, and push; code branches SHALL NOT be modified.

#### Scenario: First sync creates the branch
- **WHEN** the worktree does not exist
- **THEN** the tick creates it, commits the current artefacts, and pushes `live-eval-data`

#### Scenario: Code branch untouched
- **WHEN** the tick syncs
- **THEN** `git status` in the main checkout shows no new commits and no staged changes attributable to the tick

### Requirement: Status file and alerts
The tick SHALL rewrite `research/squad-eval/live-status.md` every run, and SHALL send an email via the configured Resend credentials when a capture window closes without a clean pre-deadline record, or when any step fails on two consecutive ticks.

#### Scenario: Missed window
- **WHEN** a deadline passes and no record for that gameweek has `postDeadline === false`
- **THEN** the next tick sends one alert naming the gameweek and does not repeat it for that gameweek

#### Scenario: Status content
- **WHEN** any tick completes
- **THEN** the status file states the checkout branch and HEAD, next deadline and hours left, last capture summary, last scored gameweek, dataset row and complete-label counts, last fit line, and last error with timestamp

### Requirement: State is durable and success-only
The tick SHALL persist per-step state in `scripts/.live-eval-state.json`, gitignored, written only after a step succeeds, with consecutive failure counts that reset on success.

#### Scenario: Retry after failure
- **WHEN** capture fails on one tick and succeeds on the next
- **THEN** state shows `failures.capture = 0` and the new capture time, and no alert is sent for the single failure
