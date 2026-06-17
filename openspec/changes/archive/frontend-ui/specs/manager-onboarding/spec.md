## ADDED Requirements

### Requirement: Brand identity
The product SHALL be named **Pocket Scout** and present a tagline conveying a *personal* FPL scout (the differentiator vs FPL's broadcast-to-millions "The Scout").

#### Scenario: Name and tagline on onboarding
- **WHEN** the onboarding screen is shown
- **THEN** the title reads "Pocket Scout" and the tagline communicates a personal scout offering tailored transfers, captain picks, and chip strategy for the user's squad (e.g. "Your personal FPL scout — tailored transfers, captain picks, and chip strategy for your squad. Enter your Manager ID to get scouted.")

#### Scenario: Document title
- **WHEN** the app loads
- **THEN** the browser tab/document title is "Pocket Scout"

### Requirement: Manager ID entry
The app SHALL present an FPL-styled onboarding screen (brand purple, green/cyan accents) that accepts an FPL manager ID and triggers a plan request. No login/auth is required (FPL manager data is public).

#### Scenario: Valid ID submitted
- **WHEN** a user enters a numeric manager ID and submits
- **THEN** the app requests `/api/plan` for that ID and transitions to the loading state

#### Scenario: Invalid input guarded
- **WHEN** the input is empty or non-numeric
- **THEN** submission is blocked with inline guidance (no request is made)

#### Scenario: Help finding the ID
- **WHEN** the onboarding screen is shown
- **THEN** it includes a hint explaining where to find the manager ID (the number in the FPL team URL)

### Requirement: Free-transfers control
Because the backend cannot derive free transfers, onboarding SHALL capture it (1 or 2), defaulting to 1.

#### Scenario: Default and selection
- **WHEN** onboarding is shown
- **THEN** free transfers defaults to 1, and the user can switch to 2; the chosen value is passed to `/api/plan`

### Requirement: Recall last session
The app SHALL persist the last manager ID and free-transfers value in `localStorage`.

#### Scenario: Returning user
- **WHEN** a user who previously loaded a team reopens the app
- **THEN** the last manager ID and free-transfers value are pre-filled (and may auto-load)

#### Scenario: Change manager later
- **WHEN** a team is loaded
- **THEN** the user can change the manager ID / free transfers and re-analyze without a full page reload
