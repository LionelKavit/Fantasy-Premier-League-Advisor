## ADDED Requirements

### Requirement: Visitors can enter demo mode without a manager ID
The app SHALL offer an explicit way to explore without an FPL manager ID, distinct from the ID-based flow.

#### Scenario: Explore CTA on the entry form
- **WHEN** the manager-ID form is shown
- **THEN** a secondary "Explore without a team" action is present alongside "Analyze my team"
- **AND** activating it starts demo mode without requiring an ID

#### Scenario: Demo loads the sample plan and brief
- **WHEN** demo mode starts
- **THEN** the app loads the demo plan via the demo route signal (no `team_id`), paints the pitch from the base phase, fills the trimmed insights, and the Scout opens with the demo welcome brief

### Requirement: Demo mode does not persist
A demo session SHALL NOT be saved or auto-resumed; the entry form is the default for every fresh visit.

#### Scenario: Demo is not written to storage
- **WHEN** a visitor is in demo mode
- **THEN** no manager ID or demo marker is written to `localStorage`

#### Scenario: Refresh returns to the form
- **WHEN** the page is reloaded during or after a demo session
- **THEN** the manager-ID form is shown (the prior demo is not auto-recalled)
- **AND** a previously saved real manager ID still auto-recalls as before

### Requirement: The verdict bar becomes a season-aware demo banner
In demo mode the always-visible verdict line SHALL present a season-aware banner instead of a personalized recommendation.

#### Scenario: Season-aware banner copy
- **WHEN** the verdict bar renders in demo mode
- **THEN** it shows a season-aware banner (e.g. a "draft pick for 2026-27" framing off-season, or a "Dream XV for GW{n} — enter your ID for yours" framing in-season)
- **AND** it does not show a personalized transfer·captain·chip recommendation line

#### Scenario: No per-manager deep link
- **WHEN** the verdict bar renders in demo mode
- **THEN** the per-manager "Open FPL Transfers" deep link is not shown

### Requirement: Personalized strategy panels are hidden in demo mode
In demo mode the app SHALL hide the panels that require a real squad or manager state, while keeping the squad-derived ones.

#### Scenario: Transfer, chip, and long-term surfaces hidden
- **WHEN** the breakdown renders in demo mode
- **THEN** the transfer recommendation section, the Chips tab, and the Long Term tab are not shown (the Long Term tab is the optimizer's transfer horizon, which demo does not produce)
- **AND** the Captaincy view remains available
- **AND** the active lens never lands on a hidden tab

#### Scenario: Header controls adapt to demo
- **WHEN** the header renders in demo mode
- **THEN** the Free-transfers toggle and the Re-analyze action are hidden
- **AND** a "Enter your ID" action is available that returns to the entry form
- **AND** no real manager name or overall rank is displayed (a demo marker is shown instead)

#### Scenario: Pitch shows no transfer-out highlight
- **WHEN** the pitch renders in demo mode
- **THEN** no player is flagged as a transfer-out target (there is no recommended move)

### Requirement: The chat offers demo-flavored starter chips
In demo mode the Scout's starter chips SHALL prompt general FPL questions about the sample squad, reusing the existing chip UI.

#### Scenario: Demo starters instead of personalized ones
- **WHEN** the chat shows starter chips in demo mode
- **THEN** the chips are general/sample-squad prompts (e.g. "Why is {captain} in this team?", "Best value pick?", a head-to-head, and a season-aware draft question), not "your transfer"/"your squad" prompts
- **AND** selecting a chip sends it and hides the chips as in the standard flow

### Requirement: Demo mode surfaces a conversion path to the ID flow
The demo experience SHALL include a low-pressure prompt to switch to the personalized ID-based flow.

#### Scenario: Soft conversion CTA
- **WHEN** a visitor is in demo mode
- **THEN** a persistent, non-blocking call-to-action invites them to enter their manager ID for personalized advice
- **AND** activating it returns to the entry form
