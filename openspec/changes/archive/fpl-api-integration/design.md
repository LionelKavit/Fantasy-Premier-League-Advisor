## Context

The FPL AI Transfer Advisor is a Next.js web app that analyzes a user's Fantasy Premier League squad and recommends transfers, captain picks, and chip strategy. The FPL public API is the sole data source — no local CSVs or databases. All data must flow through server-side API routes because the FPL API blocks browser-origin requests via CORS policy.

The API integration layer is the foundation that every other system component depends on: the scoring pipeline reads player stats, the optimizer reads fixture difficulty, and the UI displays team and player data. Getting the data layer right — correct types, reliable caching, clean normalization — determines the quality of everything built on top.

## Goals / Non-Goals

**Goals:**
- Single source of truth for all FPL data access — no component fetches from FPL directly
- Type-safe data contracts so downstream pipelines catch shape mismatches at compile time
- Minimize API calls via caching (FPL data only updates once daily during season)
- Clean normalization (prices in £m, positions as strings, forms as numbers) so downstream code never deals with raw API quirks
- Detect BGW/DGW gameweeks automatically from fixture data

**Non-Goals:**
- Authenticated endpoints (my-team, transfers-latest, me) — all needed data is available publicly
- Real-time live score updates during matches — 1-hour cache is sufficient
- Historical data beyond what the API provides (no scraping, no external databases)
- Price change prediction algorithms — we surface `cost_change_event` and `transfers_in_event` as-is

## Decisions

### Decision 1: Use native `fetch` with manual in-memory cache over a caching library

**Choice:** Implement a simple `Map<string, {data, timestamp}>` cache in a module-level variable with 1-hour TTL check.

**Alternatives considered:**
- `node-cache` or `lru-cache` npm packages — adds a dependency for something that's ~15 lines of code
- Next.js built-in `fetch` cache with `revalidate` — works for static routes but doesn't give fine-grained control over per-endpoint TTL, and behavior differs between dev and production
- Redis — overkill for a single-user app with <10 cached endpoints

**Rationale:** The FPL API has ~8 endpoints, each called at most once per hour. A simple Map with timestamp checking is sufficient, has zero dependencies, and is easy to reason about. The cache lives in-process and resets on server restart, which is acceptable.

### Decision 2: Normalize data at the fetch layer, not downstream

**Choice:** `fpl-api.ts` returns normalized types (`Player`, `Team`, `Fixture`) rather than raw API responses. Normalization happens once at fetch time.

**Alternatives considered:**
- Return raw API types and let each pipeline normalize what it needs — leads to duplicated `now_cost / 10` logic scattered across files
- Create separate raw and normalized types with explicit transform functions — adds type complexity without benefit since nothing needs the raw format after fetching

**Rationale:** Every consumer of this data wants prices in £m, positions as strings, and forms as numbers. Doing it once at the boundary means zero normalization code downstream and a single type to work with.

### Decision 3: Lazy-fetch element-summary with per-player caching

**Choice:** Element summaries (per-GW player history) are fetched lazily — only when a specific player is needed by the trend analyzer or scoring pipeline. Each player's summary is cached independently.

**Alternatives considered:**
- Pre-fetch all 500+ player summaries on bootstrap — 500+ API calls, ~30 seconds of network time, most data unused
- Only fetch for the user's 15 squad players — misses candidates who need trend analysis for transfer recommendations

**Rationale:** The trend analyzer needs history for ~30-40 players (15 squad + top candidates per position). Lazy fetching with per-player caching keeps the initial load fast (~2 seconds for bootstrap + picks + fixtures) while still providing trend data when needed. Cache ensures repeat views don't re-fetch.

### Decision 4: Gameweek detection from events array, not hardcoded

**Choice:** Current gameweek, BGW, and DGW are dynamically detected from API data every time bootstrap is fetched.

**Alternatives considered:**
- Hardcode known BGW/DGW gameweeks per season — breaks when the schedule changes (FA Cup rescheduling, etc.)
- Use a third-party FPL calendar API — adds an external dependency for data we already have

**Rationale:** The fixture data contains everything needed to compute BGW (teams with 0 fixtures) and DGW (teams with 2 fixtures). Dynamic detection means the system works correctly even when fixtures are rescheduled mid-season.

### Decision 5: API route structure mirrors pipeline boundaries

**Choice:** Five API routes that map to clear responsibilities:
- `/api/bootstrap` — raw data proxy (cached)
- `/api/squad` — squad analysis pipeline entry point
- `/api/fixtures` — fixture data for heatmap + pipeline
- `/api/transfers` — optimizer pipeline entry point
- `/api/advice` — Claude synthesis entry point

**Alternatives considered:**
- Single `/api/analyze` endpoint that runs everything — long response time, can't show intermediate results
- GraphQL — overhead for a fixed set of queries with known shapes

**Rationale:** Separate routes allow the frontend to show the squad table immediately while transfers and advice load in the background. Each route has a clear latency profile: bootstrap (~200ms cached), squad (~500ms), fixtures (~200ms), transfers (~1s), advice (~4s).

## Risks / Trade-offs

**[FPL API goes down or changes schema]** → The FPL API is unofficial and undocumented. Fields could be renamed or removed between seasons. Mitigation: TypeScript types will surface breakages at compile time. The `fpl-api.ts` layer isolates all API interaction so fixes are localized.

**[Cache causes stale data]** → 1-hour TTL means a user might see slightly outdated injury news or price changes. Mitigation: Acceptable trade-off — FPL data updates once daily for most fields. Adding a manual "refresh" button in the UI that bypasses cache is a future option.

**[Element-summary lazy loading adds latency]** → Fetching 30-40 player histories serially would take ~10 seconds. Mitigation: Use `Promise.all` to fetch in parallel. 40 parallel requests complete in ~1-2 seconds.

**[Memory usage from in-process cache]** → Bootstrap response is ~2MB, each element-summary is ~5KB. At 40 cached players + bootstrap + fixtures, total cache is ~2.5MB. Mitigation: Negligible for a single-user app. If deployed multi-tenant, replace with Redis.
