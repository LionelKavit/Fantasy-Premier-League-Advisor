## Why

FPL exposes a player's nationality only as a numeric `region` id (e.g. `200` = Spain, `241` = England) — its own id scheme, not ISO, and with **no public lookup published anywhere** (bootstrap's top-level keys are `chips, events, game_settings, game_config, phases, teams, total_players, element_stats, element_types, elements` — no `regions`/`countries` object). To show nationality anywhere in the app, we need a curated `region` id → country mapping with a flag, plus a way to maintain it and degrade gracefully on unknown ids. Isolating this as its own capability keeps the hand-curated table (the one ungrounded, maintenance-bearing piece) cleanly separable and independently testable.

## What Changes

- **Curated region map** — a single `lib/fpl-regions.ts` module mapping FPL `region` ids to `{ name, flag }`, with a `region(id)` lookup that returns `null` for unknown ids (so consumers omit the row rather than render a wrong/broken flag).
- **Computed flag emoji** — flags derived from an ISO alpha-2 code via regional-indicator codepoints (no hand-typing 100+ glyphs), with the three home nations (England/Scotland/Wales — which have no ISO alpha-2) special-cased to their subdivision flag sequences.
- **Seeding script** — a dev-only `scripts/dump-regions.ts` that fetches live bootstrap, buckets every distinct `region` id to example player names, and prints them, so the table is seeded/extended from observed data (provenance), not guessed.
- **Graceful unknowns** — an unknown `region` id never breaks: `region(id)` returns `null` and the consumer omits nationality.

## Capabilities

### New Capabilities
- `player-nationality`: Mapping a player's FPL `region` id to a display country name + flag emoji, with computed flags, home-nation special-casing, a seeding/provenance script, and graceful handling of unknown ids.

### Modified Capabilities
<!-- None — new, self-contained capability with no existing consumers. -->

## Impact

- **Lib**: new `lib/fpl-regions.ts` (curated table + `region(id)` + flag derivation).
- **Scripts**: new dev-only `scripts/dump-regions.ts` (not shipped to the client bundle; provenance/seeding).
- **Tests**: `lib/fpl-regions.test.ts` (known id → name+flag, unknown id → null, a home-nation flag).
- **Consumers**: none in this change. The player detail dialog (in the `last-mile-actionability` change) consumes `region(regionId)`; this change must land first.
- **Dependencies**: none new.
