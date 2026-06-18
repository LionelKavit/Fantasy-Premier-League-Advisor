## ADDED Requirements

### Requirement: Tabs are a lens over both columns
The screen SHALL be a two-column layout where a tab selection acts as a **lens** applied to both columns. The active-tab state is owned at the page level; the pitch is pinned.

- **Left column:** pitch (top, always) + a tab-aware **prose zone** + **pinned alerts**.
- **Right column:** the tab bar + **tab-aware structured detail** (no paragraphs).

Tabs: **This Week** (default), **Long Term Strategy**, **Ask The Scout** (disabled).

#### Scenario: Default lens
- **WHEN** a plan loads
- **THEN** the screen opens on the "This Week" lens — left shows the weekly verdict prose, right shows the weekly structured detail

#### Scenario: Switching the lens updates both columns
- **WHEN** the user switches to "Long Term Strategy"
- **THEN** the left prose changes to the long-term summary AND the right detail changes to horizon + chips — while the pitch (top-left) stays rendered and unchanged

#### Scenario: Ask The Scout is a disabled placeholder
- **WHEN** the tabs render
- **THEN** "Ask The Scout" appears as a visibly **disabled** tab marked "coming soon" (not selectable; a later change)

### Requirement: Prose left, data right
#### Scenario: No paragraphs on the right
- **WHEN** the right column renders for either lens
- **THEN** it contains only compact/structured content (badges, chains, sparklines, picks) — multi-sentence prose lives in the left column

#### Scenario: Left fills the space under the pitch
- **WHEN** the prose + alerts render on the left
- **THEN** they occupy the area beneath the pitch, balancing the two columns (the left may run longer than the right to fit the synthesis)

### Requirement: Alerts pinned to the left across tabs
#### Scenario: Always visible
- **WHEN** any tab is active
- **THEN** the merged, de-duplicated alerts (`plan.alerts` + `transfers.alerts` + `captaincy.alerts`) remain visible in the left column

#### Scenario: No alerts
- **WHEN** there are no alerts
- **THEN** the alerts area is hidden (no empty card)

### Requirement: Responsive layout
#### Scenario: Desktop
- **WHEN** viewed on a wide screen
- **THEN** the left (pitch + prose + alerts) and right (tab detail) sit side by side

#### Scenario: Mobile
- **WHEN** viewed on a narrow screen
- **THEN** the layout stacks: pitch → prose/alerts → structured detail, with the tab bar full width

### Requirement: Single source, no extra fetch
#### Scenario: Everything from one response
- **WHEN** the lens switches
- **THEN** all content is derived from the already-loaded `GameweekPlan` (no additional request)

### Requirement: Accessible tabs
#### Scenario: Keyboard and semantics
- **WHEN** the tab bar is used
- **THEN** tabs are keyboard-navigable with appropriate ARIA roles/selected state, and the disabled tab is not selectable
