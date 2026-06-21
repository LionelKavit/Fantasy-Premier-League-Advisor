## MODIFIED Requirements

### Requirement: Tabs are a lens over both columns
The screen SHALL be a **conversation-first** layout: the Scout conversation is the prominent, always-visible surface, and the structured This Week / Long Term detail lives in a collapsible **"Full breakdown"** drawer. The pitch and alerts remain as supporting context. Tab selection (This Week / Long Term) acts as a lens **within** the breakdown drawer; there is no longer a separate "Ask The Scout" tab.

- **Supporting region:** pitch (always) + **pinned alerts**.
- **Hero region:** the Scout conversation (always present, not tabbed).
- **Full breakdown (collapsible, collapsed by default):** the tab toggle + tab-aware structured detail (This Week / Long Term).

#### Scenario: Default view
- **WHEN** a plan loads
- **THEN** the conversation is the prominent surface, the pitch and alerts are visible as context, and the "Full breakdown" drawer is collapsed

#### Scenario: Opening the breakdown
- **WHEN** the user expands "Full breakdown"
- **THEN** the This Week / Long Term tab detail appears unchanged, and switching the in-drawer tab swaps the structured detail (horizon + chips for Long Term, transfer + captaincy for This Week)

#### Scenario: Conversation is always available
- **WHEN** the screen renders
- **THEN** the conversation is present without selecting a tab (it is the hero, not a lens), and it persists across drawer open/close within the session

### Requirement: Alerts pinned to the left across tabs
The merged, de-duplicated alerts SHALL stay visible in the supporting region regardless of the breakdown drawer's state.

#### Scenario: Always visible
- **WHEN** the loaded screen renders, regardless of the breakdown drawer's state
- **THEN** the merged, de-duplicated alerts (`plan.alerts` + `transfers.alerts` + `captaincy.alerts`) remain visible in the supporting region

#### Scenario: No alerts
- **WHEN** there are no alerts
- **THEN** the alerts area is hidden (no empty card)

### Requirement: Responsive layout
The layout SHALL adapt between wide and narrow viewports, keeping the conversation as the hero in both.

#### Scenario: Desktop
- **WHEN** viewed on a wide screen
- **THEN** the conversation sits prominently beside the supporting pitch + alerts, with the "Full breakdown" drawer spanning beneath/within the layout

#### Scenario: Mobile
- **WHEN** viewed on a narrow screen
- **THEN** the layout stacks: pitch → conversation → "Full breakdown" drawer (full width)

### Requirement: Single source, no extra fetch
All rendered content SHALL derive from the already-loaded `GameweekPlan`; switching the drawer or its tab SHALL NOT trigger a new request.

#### Scenario: Everything from one response
- **WHEN** the breakdown drawer opens or its tab switches
- **THEN** all content is derived from the already-loaded `GameweekPlan` (no additional request)

### Requirement: Accessible tabs
The "Full breakdown" drawer and its in-drawer tab bar SHALL be operable by keyboard with correct semantics.

#### Scenario: Keyboard and semantics
- **WHEN** the "Full breakdown" drawer and its in-drawer tab bar are used
- **THEN** the drawer is keyboard-operable with correct expanded/collapsed semantics, and the tabs keep keyboard navigation and ARIA roles/selected state

## REMOVED Requirements

### Requirement: Prose left, data right
**Reason:** The two-column "prose left / data right" model is superseded by the conversation-first hero + collapsible breakdown. The Scout's reasoning now lives primarily in the conversation (and the opening brief), not a fixed left prose column.
**Migration:** The long-term narrative remains reachable inside the "Full breakdown" drawer; weekly reasoning moves into the conversation/brief. No data is lost — only its placement changes.
