## MODIFIED Requirements

### Requirement: Tabs are a lens over both columns
The screen SHALL be a **conversation-first** 2×2 grid: **row 1** is the pitch (left) and the Scout conversation (right); **row 2** is the collapsible plan drawer (left, under the pitch) and the alerts (right, under the conversation). The conversation SHALL be **stretched to match the pitch's height**. Tab selection (This Week / Long Term) acts as a lens **within** the drawer; there is no longer a separate "Ask The Scout" tab.

- **Pitch (row 1, left):** always, paints instantly from the base phase; defines the row height.
- **Conversation (row 1, right):** the Scout hero — always present, not tabbed, stretched to the pitch's height.
- **Plan drawer (row 2, left):** collapsible, **always collapsed on load**, header label **"This week & long-term plan"**; reveals the tab toggle + tab-aware structured detail.
- **Alerts (row 2, right):** under the conversation.

#### Scenario: Default view
- **WHEN** a plan loads
- **THEN** the pitch is top-left, the conversation is the hero top-right (its height matching the pitch), the plan drawer sits under the pitch (collapsed), and the alerts sit under the conversation

#### Scenario: Drawer always starts collapsed
- **WHEN** the screen loads (including after Re-analyze or a manager switch)
- **THEN** the "This week & long-term plan" drawer is collapsed every time — there is no remembered/persisted open state

#### Scenario: Drawer label names its contents
- **WHEN** the drawer is collapsed
- **THEN** its header reads "This week & long-term plan" (pointing at the This Week + Long Term detail it reveals), not a bare "Full breakdown"

#### Scenario: Opening the breakdown
- **WHEN** the user expands the "This week & long-term plan" drawer
- **THEN** the This Week / Long Term tab detail appears, and switching the in-drawer tab swaps the structured detail (transfer + captaincy for This Week; the long-term outlook prose followed by horizon + chips for Long Term)

#### Scenario: Verdict prose is relocated, not duplicated
- **WHEN** the screen renders
- **THEN** the `ScoutVerdict` card is NOT shown in the always-visible area; the **weekly** verdict prose is omitted (the conversation/brief covers it), and the **long-term** outlook prose appears only inside the drawer's Long Term view (above the structured long-term detail)

#### Scenario: Conversation is always available
- **WHEN** the screen renders
- **THEN** the conversation is present without selecting a tab (it is the hero, not a lens), and it persists across drawer open/close within the session

### Requirement: Alerts sit under the conversation
The merged, de-duplicated alerts SHALL render in the right column, beneath the Scout conversation, and stay visible regardless of the plan drawer's state.

#### Scenario: Under the conversation
- **WHEN** the loaded screen renders, regardless of the plan drawer's state
- **THEN** the merged, de-duplicated alerts (`plan.alerts` + `transfers.alerts` + `captaincy.alerts`) render under the conversation (row 2, right)

#### Scenario: No alerts
- **WHEN** there are no alerts
- **THEN** the alerts area is hidden (no empty card)

### Requirement: Responsive layout
The layout SHALL adapt between wide and narrow viewports, keeping the conversation as the hero in both.

#### Scenario: Desktop
- **WHEN** viewed on a wide screen
- **THEN** the 2×2 grid shows pitch | conversation on row 1 (the conversation stretched to the pitch's height) and plan-drawer | alerts on row 2

#### Scenario: Mobile
- **WHEN** viewed on a narrow screen
- **THEN** the layout stacks full width: pitch → conversation → plan drawer → alerts

### Requirement: Single source, no extra fetch
All rendered content SHALL derive from the already-loaded `GameweekPlan`; switching the drawer or its tab SHALL NOT trigger a new request.

#### Scenario: Everything from one response
- **WHEN** the breakdown drawer opens or its tab switches
- **THEN** all content is derived from the already-loaded `GameweekPlan` (no additional request)

### Requirement: Accessible tabs
The plan drawer ("This week & long-term plan") and its in-drawer tab bar SHALL be operable by keyboard with correct semantics.

#### Scenario: Keyboard and semantics
- **WHEN** the plan drawer and its in-drawer tab bar are used
- **THEN** the drawer is keyboard-operable with correct expanded/collapsed semantics, and the tabs keep keyboard navigation and ARIA roles/selected state

## REMOVED Requirements

### Requirement: Prose left, data right
**Reason:** The two-column "prose left / data right" model is superseded by the conversation-first hero + collapsible breakdown. The Scout's reasoning now lives primarily in the conversation (and the opening brief), not a fixed left prose column.
**Migration:** The long-term narrative remains reachable inside the plan drawer ("This week & long-term plan"); weekly reasoning moves into the conversation/brief. No data is lost — only its placement changes.
