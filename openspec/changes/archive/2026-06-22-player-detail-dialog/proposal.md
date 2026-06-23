## Why

When the Scout says "sell João Pedro, buy Saka," the natural next question is *"who is this — is he fit, what's his form, his fixtures?"* Today the manager opens a new tab and re-searches the name. A player detail dialog answers that in-place from data the app has already fetched, and offers an optional hop to the player's official profile — removing the re-search step that recurs across a 15-man squad every gameweek.

(Split out from the former `last-mile-actionability` proposal, which is superseded by this change and `glanceable-verdict`.)

## What Changes

- **Player detail dialog** — clicking a pitch token *or* a This-Week transfer name opens a dialog with key details for that player: name, age, nationality, FPL form, minutes & points last week, and expected next points. Dismissable via close button, backdrop, and Escape.
- **View on Premier League** — the dialog's footer links to the player's premierleague.com profile (`/en/players/{optaId}/{slug}/overview`), keyed by the player's Opta id (FPL's `opta_code`) and a name slug. FPL has no per-player page; the button is hidden when the Opta id is missing (never a broken link).
- **Cache-warm detail endpoint** — a new `app/api/player/[id]` route serves the merged `PlayerDetail`, reusing the existing `fetchElementSummary` (already cached per id by the insights pipeline), so for any squad/candidate player there is **no redundant FPL round-trip**.

No breaking changes. The dialog degrades gracefully: minutes-last-week shows "—" until the insights phase warms the element-summary cache; nationality omits when the region is unmapped; the PL button hides when there is no Opta id.

## Capabilities

### New Capabilities
- `player-detail-dialog`: A per-player detail dialog (opened from a pitch token or a This-Week transfer name) showing key FPL stats and a "View on Premier League" link, backed by a cache-warm player-detail endpoint.

### Modified Capabilities
<!-- None — new surface only; no existing pipeline/optimizer requirements change. -->

## Impact

- **UI**: new `components/panel/PlayerDialog.tsx` (built on `@base-ui/react/dialog`); click-to-open wiring in `components/pitch/PlayerToken.tsx` and `components/panel/ThisWeekDetail.tsx`.
- **API**: new `app/api/player/[id]/route.ts` returning a `PlayerDetail`, reusing `fetchElementSummary` (warm cache).
- **Client libs**: `lib/client/fpl-links.ts` gains `plPlayerUrl(optaCode, fullName)` + `slugify(name)` (the module/`FPL_TRANSFERS_URL` is created by the `glanceable-verdict` change); a small `lib/client/playerDetail.ts` fetch helper with per-id client cache.
- **Data**: adds `optaCode: string | null` and `fullName: string` to the normalized `Player` and `SquadPlayerView`; introduces a `PlayerDetail` shape (including the raw `regionId`).
- **Depends on**: `player-nationality-map` (provides `region(id)` for the nationality row — already archived) and `glanceable-verdict` (creates `lib/client/fpl-links.ts`). Order: those first, then this.
- **Dependencies**: none new (dialog via the existing `@base-ui/react` primitives).
