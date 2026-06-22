## ADDED Requirements

### Requirement: Free-transfer toggle does not trigger analysis
Changing the free-transfer count SHALL update and persist the selected value without running an analysis. Re-analysis SHALL run only when the manager clicks Re-analyze (or submits a manager / changes manager).

#### Scenario: Toggling FT does not reload
- **WHEN** the manager changes the free-transfer toggle
- **THEN** the selected value updates and is persisted, but no base/insights fetch runs and the chat is not reset

#### Scenario: Re-analyze applies the selection
- **WHEN** the manager clicks Re-analyze after changing the toggle
- **THEN** the analysis re-runs with the currently-selected free-transfer count

### Requirement: Pending selection is signalled
While the selected free-transfer count differs from the value the displayed plan was computed with, the UI SHALL indicate that a re-analysis is pending, and the chat SHALL remain grounded on the applied (displayed) value until re-analysis.

#### Scenario: Dirty state highlights Re-analyze
- **WHEN** the selected FT differs from the applied FT
- **THEN** the Re-analyze control is visibly highlighted as pending

#### Scenario: Re-analyze clears the pending state
- **WHEN** the manager re-analyzes
- **THEN** the applied value equals the selection and the pending highlight clears

#### Scenario: Chat consistency during pending
- **WHEN** the FT selection is pending (not yet applied)
- **THEN** the chat is grounded on the applied free-transfer value that matches the plan on screen
