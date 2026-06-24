## ADDED Requirements

### Requirement: The free-transfer input accepts the integer range 0–5
The manager SHALL be able to enter any whole number of free transfers from 0 to 5 inclusive, replacing
the previous 1-or-2 toggle. 0 is the floor (both transfers used) and 5 is the FPL banking cap.

#### Scenario: Entering a value inside the range
- **WHEN** the manager types `0`, `3`, or `5` into the free-transfer field
- **THEN** the value is accepted, the field shows no error, and the action (Re-analyze / Submit) is enabled

#### Scenario: Boundary values are valid
- **WHEN** the manager enters `0` or `5`
- **THEN** both are accepted as in-range (inclusive bounds)

### Requirement: Out-of-range or non-integer input is blocked with an inline prompt
Input outside 0–5, or that is not a whole number, SHALL NOT be accepted or silently corrected; the field
stays editable, an inline message prompts for a valid value, and the dependent action is disabled.

#### Scenario: Above the maximum
- **WHEN** the manager enters `7` (or any value > 5)
- **THEN** an inline message "Enter a value between 0 and 5" is shown, the field is marked invalid, and
  Re-analyze (Header) / Submit (Form) is disabled
- **AND** the value is not persisted and is not sent to the engine

#### Scenario: Below the minimum
- **WHEN** the manager enters `-1` (or any value < 0)
- **THEN** the same inline prompt is shown and the action is blocked

#### Scenario: Non-integer or empty
- **WHEN** the field is empty or contains a non-integer (e.g. `2.5`, `abc`)
- **THEN** it is treated as invalid (after the field is touched) and the action is blocked, with no coercion

### Requirement: The accepted free-transfer value reaches the engine unclamped within 0–5
Every API route that reads `free_transfers` SHALL accept the full 0–5 range (defaulting to 1 when absent)
rather than clamping to 1–2, and SHALL guard against values outside 0–5.

#### Scenario: Routes honour the full range
- **WHEN** a request carries `free_transfers=0`, `3`, or `5` to any of the plan, plan/base, plan/insights,
  optimize, ask, brief, or squad endpoints
- **THEN** the route passes that exact value to the optimizer (no clamp to 1 or 2)

#### Scenario: Missing parameter defaults to 1
- **WHEN** a request omits `free_transfers`
- **THEN** the route uses the shared default of 1

#### Scenario: Server-side guard
- **WHEN** a hand-crafted request carries an out-of-range value (e.g. `free_transfers=99` or a non-numeric)
- **THEN** the route clamps it into 0–5 (or falls back to the default) so the engine never sees an illegal count

### Requirement: A saved free-transfer count of 0 round-trips
The persisted free-transfer selection SHALL restore 0 correctly on reload rather than collapsing it to 1.

#### Scenario: Reload with 0 stored
- **WHEN** the manager last selected 0 free transfers and reopens the app
- **THEN** the field restores to 0 (not 1), and the auto-loaded analysis uses 0
