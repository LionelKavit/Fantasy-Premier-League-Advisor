## Context

FPL has no per-player web page (`/api/element-summary/{id}` is JSON) and no public write API. But premierleague.com profiles are keyed by the player's **Opta id**, which FPL exposes on every player as `opta_code` (`"p223094"` → Haaland): `https://www.premierleague.com/en/players/{optaId}/{slug}/overview`. An id-only URL does **not** resolve (the slug is required), so the player's full name must be carried through to build the slug.

**Data availability (verified against the live FPL bootstrap):** `birth_date` (→ age), `form`, `ep_next`, `event_points` (points in the most recent gameweek), `opta_code`, and season `minutes` are on the bootstrap element. **Nationality** is only a numeric `region` id, resolved by the `region(id)` helper from the archived `player-nationality-map` change. **Minutes last week** (a per-gameweek split) is not on the bootstrap element; it lives in `element-summary/{id}.history`, which the analysis pipeline already fetches for squad + candidate players ([pipeline/index.ts:48-68](../../../lib/pipeline/index.ts)) and which `fetchElementSummary` caches by id.

## Goals / Non-Goals

**Goals:**
- A player detail dialog (age, nationality, form, last-week minutes/points, ep_next) opened from a pitch token or a This-Week transfer name, with a "View on Premier League" link.
- Reuse the warm element-summary cache so the dialog adds no redundant FPL round-trips for analyzed players.
- Graceful degradation for every uncertain field.

**Non-Goals:**
- The verdict bar and the FPL transfers handoff (the `glanceable-verdict` change).
- Auto-executing transfers or linking to third-party stats sites.
- Optimizer/captain/scoring changes.

## Decisions

**1. Dialog over a plain external link.**
Clicking a token or transfer name opens a dialog (`@base-ui/react/dialog`, consistent with `components/ui/button.tsx`) rather than navigating away — it answers "who is this?" in-place and keeps the external hop optional.

**2. Cache-warm `app/api/player/[id]` route over payload threading.**
The dialog fetches a new route that returns a merged `PlayerDetail` (bootstrap element fields + the latest `history` entry from `fetchElementSummary`). The route reuses `fetchElementSummary`, so for any squad/candidate player it is a **cache hit (no FPL round-trip)**; the dialog also caches `PlayerDetail` client-side per id so re-opening is instant. *Alternative:* thread every detail field into the page payload — rejected; bloats the squad/insights payload and doesn't uniformly cover transfer-target players (who aren't in the squad view).

**3. `minutes`/`points` last week.**
`pointsLastWeek` = `event_points` (always on the bootstrap element). `minutesLastWeek` = the `minutes` of the latest `history` entry; only warm once the **insights** phase has run (the base phase uses a lite context with no summaries), so before insights the dialog shows that one row as "—" while everything else renders.

**4. Per-player external link → premierleague.com via Opta id + name slug.**
`plPlayerUrl(optaCode, fullName)` strips the leading `p`, requires digits, and builds `/en/players/{id}/{slug}/overview` with `slug = slugify(fullName)` (lowercase, diacritics stripped, non-alphanumerics → hyphens). Returns `null` when there is no usable id → the button is hidden. *Alternatives:* id-only URL (doesn't resolve); third-party sites (external + grounding risk).

**5. Carry the dialog fields on the normalized `Player`; the dialog opens with just an id.**
`fetchBootstrap` returns *normalized* players (it discards the raw elements), so the warm-cache source for the route is `BootstrapData.players` — meaning the dialog fields live on the normalized `Player`, not the raw element. Add `optaCode`, `fullName`, `birthDate`, and `region` to `Player` (populated in `normalizePlayer` from the raw fields). The route then builds `PlayerDetail` from `players.find(id)` + the element-summary. The dialog itself opens with only the player **id** (+ a display name for the loading header) and gets `optaCode`/`fullName`/region back in `PlayerDetail`, so `SquadPlayerView` is **not** changed. This Week's transfer chips need ids to open the dialog, so `groupTransferMoves` is extended to carry `outId` + `candidateIds` alongside the existing names (purely additive — `buildVerdict` still reads the names).

**6. Nationality via the archived `player-nationality-map` capability.**
The dialog calls `region(detail.regionId)` and renders the nationality row only when it returns non-`null`.

## Risks / Trade-offs

- **PL slug mismatch (accents, Jr., nicknames) → 404.** → `slugify` strips diacritics; full first+second name matches PL's slug for the overwhelming majority. A wrong slug lands on the player-not-found page, not a crash; the button is a convenience.
- **`element-summary` cache cold (click during base phase / after TTL).** → the route does exactly one real fetch for that player; the minutes-last-week row shows "—" until then. Non-fatal.
- **`opta_code` absent (rare new entrant).** → "View on Premier League" hidden.
- **Unmapped `region` id.** → nationality row omitted (never a wrong flag).

## Migration Plan

Additive: one route, two components/libs, and two new fields on existing types. No data migration, no env changes, no optimizer changes. Keyless mode unaffected (the dialog uses FPL data only). Rollback = revert.

## Open Questions

- Whole token vs. name as the dialog trigger — leaning whole-token for hit area, keeping the captain/availability badges non-interactive. (Resolved in build; no spec impact.)
