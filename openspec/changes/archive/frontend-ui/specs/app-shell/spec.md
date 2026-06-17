## ADDED Requirements

### Requirement: Plan fetch and state machine
The app SHALL fetch `GET /api/plan?team_id=X&free_transfers=N` once per analysis and drive the UI through idle → loading → loaded/error states.

#### Scenario: Successful load
- **WHEN** the request resolves with a `GameweekPlan`
- **THEN** the app renders the pitch and recommendation panel from that single response (no second request)

#### Scenario: Loading feedback
- **WHEN** a request is in flight (the call takes ~2s+: squad analysis + LLM)
- **THEN** a skeleton pitch with brief progress copy is shown (not a frozen screen)

#### Scenario: Error handling
- **WHEN** the request fails (e.g. 404 invalid ID, or 500)
- **THEN** an error card is shown with the reason and a way to try a different ID

### Requirement: Centred header
The app SHALL show an FPL-purple summary header with the loaded manager's context and controls, all **centre-aligned** on a single vertical axis.

#### Scenario: Manager context centred
- **WHEN** a plan is loaded
- **THEN** the header shows, centre-aligned: the team name and manager name, then a centred stats row of GW, Overall rank, and Bank (value over label, from `manager`/`bank`/`currentGw`) on an FPL-purple bar with white text

#### Scenario: Centred controls with Reset
- **WHEN** a plan is loaded
- **THEN** a centred controls row exposes the free-transfers toggle, a "Re-analyze" action (re-fetches without a page reload), and a "Reset" action that returns to the onboarding screen

### Requirement: Responsive layout
#### Scenario: Desktop
- **WHEN** viewed on a wide screen
- **THEN** the pitch and recommendation panel sit side by side

#### Scenario: Mobile
- **WHEN** viewed on a narrow screen
- **THEN** the layout stacks (pitch above, recommendations below) and remains usable

### Requirement: FPL-familiar theme
#### Scenario: Brand palette as CSS variables
- **WHEN** the app renders
- **THEN** it uses the FPL brand palette defined as CSS variables — purple `#37003C`, green `#00FF87`, cyan `#04F5FF`, magenta `#E90052`, and a pitch-green field — with the pitch as the visual anchor and the recommendation panel on a calmer neutral surface

#### Scenario: Accent usage discipline
- **WHEN** applying bright green/cyan
- **THEN** they are used for large fills/accents, not small body text (which would fail contrast)

### Requirement: Accessibility baseline
The app SHALL meet a baseline of accessibility so the rich data stays usable for everyone.

#### Scenario: Color is never the only signal
- **WHEN** conveying scores, statuses, recommendations, or alerts
- **THEN** color is always paired with text/number and/or an icon

#### Scenario: Contrast and motion
- **WHEN** text is rendered
- **THEN** it meets WCAG-AA contrast; **AND** non-essential motion respects `prefers-reduced-motion`

#### Scenario: Images have alt text
- **WHEN** a club shirt (or fallback jersey) is rendered
- **THEN** it has descriptive alt text identifying the player and club
