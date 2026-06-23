## ADDED Requirements

### Requirement: This Week tab section structure

The This Week tab SHALL render its content as separate, clearly-labelled sections in this order: **Transfer**, **Captaincy**, **Chip** (only when a chip is played this gameweek), then **Restructure**. The Transfer section SHALL always exist. The chip call and the transfer SHALL NOT be shown in the same section — the chip announcement lives only in the Chip section, and the transfer(s) live only in the Transfer section.

#### Scenario: Section order

- **WHEN** the This Week tab is shown with a play-now chip
- **THEN** the sections appear in order: Transfer, Captaincy, Chip, Restructure

#### Scenario: No chip this gameweek

- **WHEN** no chip is played this gameweek
- **THEN** the Chip section is omitted and the order is Transfer, Captaincy, Restructure

#### Scenario: Transfer section is never the chip

- **WHEN** a chip is played this gameweek
- **THEN** the "Play your {chip}" announcement appears in the Chip section, never in the Transfer section

#### Scenario: Chip section reasoning is a one-liner

- **WHEN** the Chip section shows "Play your {chip}" with its reasoning
- **THEN** the reasoning is a single concise line (truncated/clamped if longer), not a multi-line block

### Requirement: Transfer section shows the week's actual transfers

The Transfer section SHALL show the transfers actually being made this gameweek: when the play-now chip carries a transfer draft (Wildcard or Free Hit), the Transfer section SHALL show that draft; otherwise (a draftless chip such as Bench Boost / Triple Captain, or no chip) it SHALL show the `primaryRecommendation` (the normal free-transfer call, including a roll/hold or a hit). It SHALL NOT show a chip announcement.

#### Scenario: Bench Boost play-now with a concrete transfer

- **WHEN** the plan plays Bench Boost this gameweek and recommends João Pedro → Watkins
- **THEN** the Transfer section shows João Pedro → Watkins, and the Chip section shows "Play your Bench Boost"

#### Scenario: Wildcard play-now

- **WHEN** the plan plays Wildcard this gameweek (a drafted chip)
- **THEN** the Transfer section shows the Wildcard draft transfers, and the Chip section shows "Play your Wildcard"

#### Scenario: Draftless chip with no concrete move

- **WHEN** the plan plays a draftless chip and the transfer recommendation is a roll/hold
- **THEN** the Transfer section expresses the roll/hold and the Chip section shows the chip

### Requirement: Verdict bar segment order

The verdict bar SHALL present its segments in the order: transfer, then captain, then chip. When a draftless play-now chip (Bench Boost / Triple Captain) coexists with a concrete transfer, the transfer segment SHALL show the move and the chip segment SHALL show "Play your {chip}", so the bar reads e.g. "João Pedro → Watkins · Captain Haaland · Play your Bench Boost". When the play-now chip carries a draft (Wildcard / Free Hit), the transfer segment SHALL show "Play your {chip}" (the draft is the transfer plan) and no separate chip segment is added.

#### Scenario: Order with a draftless chip and a transfer

- **WHEN** Bench Boost is play-now and João Pedro → Watkins is recommended
- **THEN** the verdict reads transfer (João Pedro → Watkins), then captain, then chip (Play your Bench Boost)

#### Scenario: Drafted chip in the verdict

- **WHEN** a drafted chip (Wildcard / Free Hit) is play-now
- **THEN** the transfer segment shows "Play your {chip}" and no separate chip segment is shown

### Requirement: Verdict, This Week, and brief agree on a chip+transfer week

The verdict bar, the This Week tab, and the proactive brief SHALL present the same combination of transfer and chip for the gameweek, so no surface omits the transfer that another surface shows.

#### Scenario: Surfaces are consistent

- **WHEN** a draftless play-now chip and a concrete transfer are both recommended
- **THEN** the verdict bar, the This Week tab, and the brief all reflect both the transfer and the chip
