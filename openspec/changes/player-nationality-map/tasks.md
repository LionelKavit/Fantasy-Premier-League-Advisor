## 1. Seeding script (provenance)

- [ ] 1.1 Create `scripts/dump-regions.ts` (run via `tsx`, never imported by app code): fetch `bootstrap-static`, group distinct `element.region` ids → example `first_name second_name`, print sorted by id
- [ ] 1.2 Run it once and capture the current id → example-players output to seed the table

## 2. Region map module

- [ ] 2.1 Create `lib/fpl-regions.ts`: curated `Record<number, { name: string; iso2: string }>` table (with a provenance header comment pointing to the script), a `flagFromIso2(iso2)` helper, and a `HOME_NATION_FLAGS` override for England/Scotland/Wales
- [ ] 2.2 Implement `region(id: number | null | undefined): { name: string; flag: string } | null` — returns `null` for unknown/`null`/`undefined`; otherwise resolves name + flag (home-nation override else computed from `iso2`)
- [ ] 2.3 Seed the table from the script output for the current PL player set (common footballing nations)

## 3. Tests

- [ ] 3.1 Create `lib/fpl-regions.test.ts`: known id (Spain 200) → `{ name, flag }`; computed flag from ISO alpha-2; a home-nation flag (England); unknown id → `null`; `null` input → `null`

## 4. Verify

- [ ] 4.1 Green gate: `tsc`, eslint, and `vitest` pass (script is type-checked but excluded from the client bundle)
