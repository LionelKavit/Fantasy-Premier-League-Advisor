## ADDED Requirements

### Requirement: Formation label and pitch layout
The pitch SHALL render the starting XI (`squad` where `isStarting`) grouped by position into rows — GK, then DEF, MID, FWD — sized to the actual counts, over an FPL-style green gradient pitch (`#00a651` → `#008a45`).

#### Scenario: Formation derived from the squad
- **WHEN** the starting XI has 3 DEF, 4 MID, 3 FWD
- **THEN** the pitch shows a 3-4-3 layout with one GK on its own row

#### Scenario: Formation label at the top, centred
- **WHEN** the pitch renders
- **THEN** the formation label (e.g. "3-4-3") appears as a centred pill at the **top of the pitch** — not beside the Substitutes heading

#### Scenario: Substitutes strip
- **WHEN** rendering the squad
- **THEN** the 4 bench players (`!isStarting`) appear in a clearly separated darker-green strip (`#007a3d`) below the pitch, under a **centred "SUBSTITUTES"** heading (GK first, then bench order) — not mixed into the formation

### Requirement: Player token — frosted FPL card
Each player SHALL render as a single **frosted, translucent card** (a shirt area over a purple footer) so the pitch shows through — not an opaque white tile.

#### Scenario: Translucent card surface
- **WHEN** a token renders
- **THEN** the card uses a semi-transparent frosted backdrop (translucent white + backdrop blur) with a translucent purple footer

#### Scenario: Real shirt with fallback and alt text
- **WHEN** a player's shirt image loads from the FPL CDN (by `teamCode`, GK variant for keepers)
- **THEN** it is shown with descriptive alt text ("{name}, {club}"); **AND WHEN** it fails to load, a stylized team-tinted jersey is shown instead

#### Scenario: Full name on one line
- **WHEN** rendering the footer name
- **THEN** the web name is shown on a single line, sized to fit common names without an ellipsis (the card is wide enough; truncation is a last resort only)

#### Scenario: Rating as coloured text, not a filled box
- **WHEN** showing the headline metric
- **THEN** the composite `score` is shown as a 0–10 rating rendered as **coloured text** in the footer — green when strong, white when mid, red when weak — with the number always present (dual-encoded), and **no gaudy filled pill**
- **AND** the price (£x.x) is shown beside it; projected points (`epNext`) and PPG (`pointsPerGame`) are available for display

### Requirement: Badges and markers (corner-placed, non-overlapping)
Markers SHALL sit in card corners, small, and never overlap the shirt or the name.

#### Scenario: Captain / vice badges
- **WHEN** a player has `isCaptainRec` or `isViceRec`
- **THEN** the **top-right** corner shows a circular badge — filled green "C" or outlined white "V" — distinguished by letter + style, not colour alone

#### Scenario: Weak-spot / transfer-out marker
- **WHEN** a player has `isWeakSpot`, or is the "out" side of the primary recommended transfer
- **THEN** the card carries a coloured ring (amber for weak, pink for out) **AND** a small chip in the **top-left** corner ("▲" amber / "OUT" pink), kept small and clear of the shirt and the name

#### Scenario: Availability flag with text
- **WHEN** a player's availability is injured/suspended/doubtful/unavailable
- **THEN** a small flag in the shirt's **bottom-left** shows colour + text (e.g. "INJ", "SUS", "N/A", or the chance-of-playing percentage) — never colour alone

### Requirement: Resilient rendering
#### Scenario: Missing recommendation data
- **WHEN** `captaincy` is null (its pipeline failed)
- **THEN** the pitch still renders all players correctly, without (C)/(V) badges

### Requirement: Accessibility
#### Scenario: Non-colour encoding and contrast
- **WHEN** any rating, status, or marker is shown
- **THEN** it pairs colour with text/number, and text meets WCAG-AA contrast

#### Scenario: Touch targets
- **WHEN** viewed on touch devices
- **THEN** each player token is a tap target of at least ~44px
