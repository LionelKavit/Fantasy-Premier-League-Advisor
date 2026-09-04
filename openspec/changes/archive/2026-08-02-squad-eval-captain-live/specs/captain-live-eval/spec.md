## ADDED Requirements

### Requirement: The full captain pipeline is evaluated prospectively
The system SHALL evaluate the app's full captain pipeline (with live `ep_next` and LLM context) by capturing its recommendation at each gameweek deadline and scoring it against realized points after the gameweek — never by historical backfill.

#### Scenario: Pre-deadline capture of the full recommendation
- **WHEN** the capture command runs for a gameweek
- **THEN** it runs the app's full captain pipeline (`runCaptainPipeline`/`runCaptainWithContext`, using live `ep_next` and the real LLM context) and appends a record to the season log keyed by gameweek
- **AND** the record includes the recommended captain (+ vice + ranked candidates with scores), the manager's current XI and actual captain, the driving inputs (`ep_next`, `rotationRisk`/LLM signals), and a `captured_at` timestamp

#### Scenario: Capture timing is validated
- **WHEN** a capture is recorded
- **THEN** `captured_at` is compared against the gameweek deadline; a post-deadline capture is flagged (and excluded from scoring) because `ep_next`/ownership/lineups are no longer point-in-time
- **AND** re-capturing before the deadline overwrites that gameweek's record, but a record is never overwritten once the gameweek has started

#### Scenario: Post-gameweek scoring reuses the replay's metrics
- **WHEN** the score command runs and a logged gameweek's fixtures are finished
- **THEN** it fetches realized `total_points` and computes hit-rate, points-captured, head-to-head vs the manager's actual captain, and baselines (PPG, ownership, random) — using the **same** metric code as `squad-eval-captain-replay` (extracted into a shared helper so floor and full agree by construction)

#### Scenario: Full-vs-floor comparison is reported
- **WHEN** the report is written
- **THEN** it presents the full-pipeline results next to `squad-eval-captain-replay`'s deterministic-floor results, so the lift from `ep_next` + LLM is explicit
- **AND** partial-season reports state the gameweek count `n` and are labeled provisional

#### Scenario: Offline-only, app build unaffected
- **WHEN** the harness and its log live under `research/`
- **THEN** they are excluded from the app build, and `tsc`/`eslint`/`vitest` remain clean
