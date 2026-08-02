## ADDED Requirements

### Requirement: The runner acts only inside the pre-deadline window
The scheduled runner SHALL read the live FPL deadline calendar on every tick and act only when the next gameweek's deadline is between 5 hours and 0 minutes away; outside the window it SHALL exit without side effects.

#### Scenario: Quiet tick outside the window
- **WHEN** the runner ticks and the next deadline is more than 5 hours away (or has passed)
- **THEN** it performs no capture, sends no email, and exits cleanly

#### Scenario: Late wake inside the window still fires
- **WHEN** the machine wakes and the tick lands inside the window (e.g. 2 hours before the deadline)
- **THEN** the runner proceeds normally — a late brief beats a missing one

#### Scenario: Past the deadline, nothing fires
- **WHEN** the tick lands after the deadline for a gameweek that was never briefed
- **THEN** it skips both capture and email (a post-deadline email is unactionable; a post-deadline capture is contaminated by the eval's own rules) and logs the miss

### Requirement: The capture safety net runs inside the window
Inside the window the runner SHALL invoke the existing live-eval capture command for the configured manager, preserving all of that harness's semantics (idempotent pre-deadline refresh, post-deadline flagging).

#### Scenario: Capture refreshes an earlier manual capture
- **WHEN** the manager already captured manually earlier in the week and the runner fires
- **THEN** the gameweek's record is overwritten with the fresher pre-deadline snapshot, per the capture command's own idempotence rule

#### Scenario: Capture failure does not block the email
- **WHEN** the capture child process fails (e.g. FPL API hiccup)
- **THEN** the runner logs the failure and still attempts the email brief

### Requirement: The email brief carries the app's own plan
The runner SHALL compute the weekly recommendation with the same `runGameweekPlan` call the app serves, and email the recommended transfers (with moves and expected-points reasoning), captain and vice, chip call, and alerts to the configured recipient via Resend. The email SHALL never contain decision logic of its own.

#### Scenario: Brief sent once per gameweek
- **WHEN** the runner fires inside the window and no brief has been sent for this gameweek
- **THEN** one email is sent and the gameweek is recorded in the state file only after a successful send

#### Scenario: Failed send retries on the next tick
- **WHEN** the Resend call fails
- **THEN** the state file is not updated and the next hourly tick inside the window retries

#### Scenario: Missing configuration is loud, not silent
- **WHEN** `RESEND_API_KEY` or `BRIEF_EMAIL_TO` is unset
- **THEN** the capture still runs, the email is skipped with an explicit `unavailable — <reason>` log line, and the runner exits non-zero

### Requirement: Free transfers are derived and stated as an assumption
The runner SHALL derive the manager's free-transfer count from public transfer and chip history using the standard banking rules (1 after GW1, +1 per gameweek, cap 5, each transfer consumes one with floor 0, wildcard/Free Hit gameweeks consume none), and the email SHALL state the derived number as an assumption.

#### Scenario: Derivation matches the banking rules
- **WHEN** the manager made no transfers in GW2 and GW3 holding 1 FT after GW1
- **THEN** the derived count for GW4 is 3

#### Scenario: Chip gameweeks do not consume
- **WHEN** the manager played a Wildcard in GW5 making 8 transfers, holding 2 FTs
- **THEN** the derived count for GW6 is 3 (2 preserved + 1 accrued)

#### Scenario: The assumption is visible in the email
- **WHEN** the brief is sent with a derived count of N
- **THEN** the email includes "assuming N free transfers (derived from your transfer history)"

### Requirement: No personal data or secrets in tracked files
The recipient address, API key, and manager id override SHALL live only in `.env.local`; tracked files SHALL carry only placeholder names (`.env.example`) and the state file SHALL be gitignored.

#### Scenario: Repo stays clean
- **WHEN** the change is committed
- **THEN** no email address, API key, or sent-state appears in any tracked file
