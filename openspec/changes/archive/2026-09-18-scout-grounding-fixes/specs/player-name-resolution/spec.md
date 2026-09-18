## ADDED Requirements

### Requirement: Player names resolve accent- and case-insensitively across web name and full name
`resolvePlayer` SHALL compare a folded query against the folded `webName` and folded `fullName` of every player, where folding is Unicode NFD with combining marks removed, a fold table for `ø æ ß œ ð þ ł đ`, lowercasing, and punctuation/whitespace collapsed. Precedence SHALL be exact web name, exact full name, prefix on either, substring on either; ties SHALL resolve to the higher `totalPoints`.

#### Scenario: Diacritic and special-letter spellings
- **WHEN** the query is `odegaard`, `gross`, `joao pedro`, or `sangare`
- **THEN** it resolves to Ødegaard, Groß, João Pedro, and M.Sangaré respectively

#### Scenario: Full-name query
- **WHEN** the query is the player's folded full name (e.g. `martin odegaard`)
- **THEN** it resolves to that player even though the web name differs

#### Scenario: ASCII names unchanged
- **WHEN** the query is `Saka` or `saka`
- **THEN** it resolves exactly as before (exact web-name match wins over any substring elsewhere)

### Requirement: A miss is a structured not-found with suggestions
Every tool that resolves a player by name SHALL, on a miss, return `{ notFound: true, query, suggestions }` where `suggestions` holds up to five near-miss names (folded prefix/substring matches, highest `totalPoints` first) and MAY be empty. `compare_players` SHALL report the miss per name without failing the other names; `simulate_transfer` and `simulate_captain` SHALL report which side missed.

#### Scenario: Not-found payload
- **WHEN** `score_player` is called with `Odegard` (typo) and Ødegaard exists
- **THEN** the result has `notFound: true`, `query: "Odegard"`, and no `error` string, and `suggestions` is a list (possibly empty)

#### Scenario: Comparison with one miss
- **WHEN** `compare_players` is called with `["Saka", "Nobody"]`
- **THEN** the result contains Saka's row and a not-found payload for `Nobody`

### Requirement: The Scout never explains away a miss
The system prompt SHALL instruct that a `notFound` result means the name did not match the data: the Scout says so, offers the suggestions, and asks for the spelling; it SHALL NOT infer injury, absence, a transfer or unavailability from a miss.

#### Scenario: Prompt rule present
- **WHEN** the manager or demo system prompt is built
- **THEN** it contains a Grounding rule stating that a not-found result must be reported as such and never explained by injury, absence or unavailability
