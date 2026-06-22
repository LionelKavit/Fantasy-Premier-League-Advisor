## Context

Pocket Scout already commits a deterministic `GameweekPlan` (transfers, captaincy, squad, chips) and renders it across the pitch, the conversation, and a collapsible breakdown. What it does not yet do is help the manager *execute* — there is no handoff to FPL, no one-second verdict, and no way to inspect a recommended player in-place.

Two constraints shape the design:
- **FPL has no public write API and no per-player web page.** `/api/element-summary/{id}` returns JSON, not a page. We can deep-link to the manager-facing **transfers screen** (`/transfers`) and hand off; we cannot auto-execute, and we cannot pre-fill the in/out players (FPL's transfers URL takes no parameters).
- **Grounding.** Every surface reads from already-committed data and degrades gracefully when LLM insights are absent. No new numbers, no fabrication.

The premierleague.com profile is keyed by the player's **Opta id**, which FPL exposes on every player as `opta_code` (`"p223094"` → Haaland). URL: `https://www.premierleague.com/en/players/{optaId}/{slug}/overview`. An id-only URL does **not** resolve (the slug is required), so the player's full name must be carried through to build the slug.

**Data availability (verified against the live FPL bootstrap):** `birth_date` (→ age), `form`, `ep_next`, `event_points` (points in the most recent gameweek), `opta_code`, and season `minutes` are all on the bootstrap element. **Nationality** is only a numeric `region` id — there is no published id→name map, so a static lookup is required. **Minutes last week** (a per-gameweek split) is not on the bootstrap element; it lives in `element-summary/{id}.history`, which the analysis pipeline already fetches for squad + candidate players ([pipeline/index.ts:48-68](../../../lib/pipeline/index.ts)) and which `fetchElementSummary` caches by id.

## Goals / Non-Goals

**Goals:**
- A correct, always-visible one-line verdict in a full-width bar above the pitch/chat grid, present from the deterministic base phase and kept in sync as captaincy is refined, with the "Open FPL Transfers" action at the end of the bar.
- A player detail dialog (age, nationality, form, last-week minutes/points, ep_next) opened from a pitch token or a This-Week transfer name, with a "View on Premier League" link.
- Reuse the warm element-summary cache so the dialog adds no redundant FPL round-trips for analyzed players.

**Non-Goals:**
- Auto-executing transfers, writing to FPL, or pre-filling the transfers screen (no public write API / no URL params).
- Linking to any third-party stats site (official FPL / Premier League domains only).
- Changing the optimizer, captain, or scoring pipelines — this is a presentation + handoff layer.
- A copy-to-clipboard "moves" summary (dropped in favour of the dialog + deep link; can revisit later).

## Decisions

**1. Per-player external link → premierleague.com via Opta id + name slug.**
`opta_code` (`"p<optaId>"`) yields the PL id; the slug is `slugify(fullName)` (lowercase, diacritics stripped, non-alphanumerics → hyphens). When `opta_code` is missing/malformed the "View on Premier League" button is hidden (never a broken link). *Alternatives:* id-only URL (rejected, doesn't resolve); third-party sites (rejected, external + grounding risk).

**2. Player detail dialog over a plain link.**
Clicking a token or transfer name opens a dialog (`@base-ui/react/dialog`, consistent with `button.tsx`) rather than navigating away. It answers "who is this?" in-place and keeps the external hop optional. The dialog is fed by a new `app/api/player/[id]/route.ts` returning a merged `PlayerDetail` (bootstrap element fields + last-`history` entry from `fetchElementSummary`). *Alternative:* thread every detail field into the page payload — rejected; bloats the squad/insights payload and doesn't cover transfer-target players uniformly. The route reuses `fetchElementSummary`, so for any squad/candidate player the call is a **cache hit (no FPL round-trip)**; the dialog also caches its `PlayerDetail` client-side per id so re-opening is instant.

**3. Nationality via the `player-nationality-map` capability (separate change, landed first).**
The dialog calls `region(detail.regionId)` from `lib/fpl-regions.ts` (delivered by the `player-nationality-map` change) and renders the nationality row only when it returns non-`null`. This change owns the `PlayerDetail.regionId` plumbing but not the id→country table.

**4. `minutes`/`points` last week.**
`points last week` = `event_points` (on the bootstrap element, always available). `minutes last week` = the `minutes` of the latest `history` entry from `element-summary`. The latter is only warm once the **insights** phase has run (the base phase uses a *lite* context with no summaries), so before insights the dialog shows that single row as "—"; everything else renders immediately.

**5. Thread `optaCode` + `fullName` through the normalized `Player` → `SquadPlayerView`.**
`normalizePlayer` already has `raw.opta_code`, `raw.first_name`, `raw.second_name`. Add `optaCode: string | null` and `fullName: string` to the normalized `Player` and surface both on `SquadPlayerView` (built in `buildSquadView`). This Week's transfer chips read from `ScoredPlayer.player`, so they get the fields for free. The dialog needs only the player **id** to call the route; the link helper needs `optaCode`/`fullName`.

**6. Deterministic-first verdict.**
`buildVerdict(plan)` reads `plan.transfers.primaryRecommendation` (or the play-now chip draft) and `plan.captaincy`, reusing `groupTransferMoves` so wording matches This Week. During the base phase `transfers`/`captaincy` are null, so the verdict shows the parts it has (e.g. "captain pending") rather than blocking; when insights merge into the same plan, it re-renders in place. *Alternative:* wait for insights — rejected, defeats the above-the-fold goal.

**7. Placement.**
`VerdictBar` renders in `app/page.tsx` directly under `Header`, full-width above the `grid` row, hosting verdict text (left) and "Open FPL Transfers" (right, new tab, `rel="noopener noreferrer"`).

## Risks / Trade-offs

- **PL slug mismatch (accents, Jr., nicknames) → 404.** → `slugify` strips diacritics; full first+second name matches PL's slug for the overwhelming majority. A wrong slug lands on the player-not-found page, not a crash; the button is a convenience.
- **`region` map drift / unknown ids.** → unknown → row omitted; never a wrong flag. The map is small and static.
- **`element-summary` cache cold (click during base phase / after TTL).** → the route does exactly one real fetch for that player; the "minutes last week" row shows "—" until then. Non-fatal.
- **`opta_code` absent (rare new entrant).** → "View on Premier League" hidden.
- **Verdict drift vs This Week.** → both derive from the same plan via `groupTransferMoves`, so they cannot disagree.
- **Transfers deep link can't pre-fill the move.** → labelled honestly as "Open FPL Transfers" (a jump to the execution screen), not "make this transfer".

## Migration Plan

Additive: one new route, three new components/libs, a static map, and two new fields on existing types. No data migration, no env changes, no optimizer changes. Keyless mode is unaffected (verdict + deep link + dialog all work without an API key; only LLM prose elsewhere needs the key). Rollback = revert the change.

## Open Questions

- Whole token vs. name as the dialog trigger — leaning whole-token for hit area, keeping the captain/availability badges non-interactive. (Resolved in build; no spec impact.)
- Whether to also link "View on Premier League" from the dialog's own header vs. a footer button — footer button, per the requested layout.
