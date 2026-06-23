## ADDED Requirements

### Requirement: Region id to country mapping

The system SHALL provide a `region(id)` lookup that maps an FPL `region` id to a display country `name` and `flag` emoji. The mapping SHALL be a single curated module, seeded from observed FPL data with documented provenance.

#### Scenario: Known region id

- **WHEN** `region(200)` is called (Spain)
- **THEN** it returns `{ name: "Spain", flag: "🇪🇸" }`

### Requirement: Computed flag emoji

The system SHALL derive a country's flag emoji from its ISO alpha-2 code via regional-indicator codepoints, rather than storing hand-typed glyphs, for all countries that have an ISO alpha-2 code.

#### Scenario: Flag derived from ISO alpha-2

- **WHEN** a region entry has ISO alpha-2 `"ES"`
- **THEN** the returned flag is the two regional-indicator symbols for E and S (🇪🇸)

### Requirement: Home nation flags

The system SHALL special-case the United Kingdom home nations (England, Scotland, Wales), which have no ISO alpha-2 code, to their correct subdivision flag emoji sequences.

#### Scenario: England flag

- **WHEN** `region(id)` resolves to England
- **THEN** the returned flag is the England subdivision flag emoji (🏴 with the `gbeng` tag sequence)

### Requirement: Graceful unknown handling

The `region(id)` lookup SHALL return `null` for any id not present in the table and for a `null` or `undefined` input, so that consumers omit the nationality rather than rendering a wrong or broken value. An unknown id SHALL NOT throw.

#### Scenario: Unknown region id

- **WHEN** `region(999999)` is called and `999999` is not in the table
- **THEN** it returns `null` and does not throw

#### Scenario: Null input

- **WHEN** `region(null)` is called
- **THEN** it returns `null`

### Requirement: Seeding and provenance script

The system SHALL include a dev-only script that fetches live FPL bootstrap data, groups distinct `region` ids to example player names, and prints them, to seed and extend the curated table from observed data. The script SHALL NOT be imported by application/runtime code.

#### Scenario: Listing region ids with examples

- **WHEN** the seeding script is run
- **THEN** it prints each distinct `region` id alongside example player names, enabling each id to be mapped to a country by recognising the players
