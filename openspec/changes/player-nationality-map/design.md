## Context

FPL's `element.region` is a numeric id in FPL's own scheme (verified: `200` = Spain, `241` = England — not ISO numeric, where Spain would be `724`). No FPL endpoint maps these ids to country names; bootstrap has no `regions` object. So the mapping is necessarily **hand-curated**, with no upstream to sync from. This change isolates that table so the one ungrounded piece of the actionability work is small, auditable, and independently testable.

## Goals / Non-Goals

**Goals:**
- A single, auditable `region` id → `{ name, flag }` table with a `region(id)` lookup.
- Flags computed from ISO alpha-2 (not hand-typed), home nations special-cased.
- A repeatable way to seed/extend the table from observed data, with documented provenance.
- Never break on an unknown id (return `null`; consumer omits the row).

**Non-Goals:**
- Any UI — consumers (the player dialog) live in `last-mile-actionability`.
- A complete enumeration of every FPL region id on day one — the table covers the current PL player set and grows on demand.
- Pulling nationality from a third-party source.

## Decisions

**1. Storage shape: `region id → { name, iso2 }`, flag computed.**
The table stores the country `name` and an `iso2` code; `region(id)` returns `{ name, flag }` where `flag` is derived at lookup from `iso2`:
```ts
const flagFromIso2 = (iso2: string) =>
  String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
```
*Alternative:* hand-type each flag glyph — rejected, error-prone across 100+ countries.

**2. Home nations special-cased.**
England/Scotland/Wales have no ISO alpha-2; their flag emoji are subdivision sequences (e.g. England = `🏴` + `gbeng` tag chars + cancel-tag). These three entries carry an explicit `flag` string that overrides the computed path. Northern Ireland/Republic of Ireland use standard ISO (`GB`/`IE`) where applicable.

**3. Unknown id → `null`.**
`region(id)` returns `null` for any id not in the table (and for a `null`/`undefined` input). Consumers MUST treat `null` as "omit nationality". This makes an incomplete table a cosmetic gap, never a bug.

**4. Provenance via a dev script, not guesses.**
`scripts/dump-regions.ts` (run with `tsx`, never imported by the app) fetches bootstrap, groups distinct `region` ids → sample `first_name second_name`, and prints them. The table is seeded by recognising those players' nationalities; the module header comments the provenance and points back to the script. Extending the table is: run script → map the new id → add a line.

## Risks / Trade-offs

- **No official source → table can be wrong/incomplete.** → Graceful-omit rule makes errors cosmetic; the script gives a repeatable provenance trail. Country names/ISO codes for recognised players are easy to verify.
- **Region id scheme could change season-to-season.** → Unknown ids degrade to omitted; re-run the script if flags go missing after a season rollover.
- **Flag emoji rendering varies by platform/font.** → Cosmetic only; the `name` carries the information regardless.

## Migration Plan

Purely additive: one lib module, one dev script, one test file. No runtime dependency on anything else; no consumers in this change. Rollback = delete the files.

## Open Questions

- Whether to also expose `region(id)?.iso2` for callers that want just a flag without the name — trivial to add if a consumer needs it; not required by the dialog.
