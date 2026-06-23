## 1. Data plumbing — carry Opta id + full name

- [ ] 1.1 Add `optaCode: string | null` and `fullName: string` to the normalized `Player` in `lib/types.ts`
- [ ] 1.2 Populate them in `normalizePlayer` (`lib/fpl-api.ts`) from `raw.opta_code` and `${raw.first_name} ${raw.second_name}`
- [ ] 1.3 Add `optaCode: string | null` and `fullName: string` to `SquadPlayerView` (`lib/plan/types.ts`) and populate in `buildSquadView` (`lib/plan/index.ts`), with safe fallbacks (`null` / `webName`)

## 2. Client helpers + static data (pure, unit-tested)

- [ ] 2.1 Create `lib/client/fpl-links.ts`: `FPL_TRANSFERS_URL`, `slugify(name)`, `plPlayerUrl(optaCode, fullName): string | null` (strip leading `p`, require digits, build `/en/players/{id}/{slug}/overview`; `null` when no usable id)
- [ ] 2.2 Create `lib/client/moves.ts`: `buildVerdict(plan): { transfer: string; captain: string | null; chip: string }`, a pure function of `GameweekPlan` reusing `groupTransferMoves` (handle hold/roll, play-now chip, missing-captain)
- [ ] 2.3 Add unit tests: `lib/client/fpl-links.test.ts` (Haaland mapping, missing/malformed opta_code → null, diacritics slug) and `lib/client/moves.test.ts` (move, hold, chip, captain-pending)

> Nationality mapping (`lib/fpl-regions.ts` + `region(id)`) is delivered by the **`player-nationality-map`** change, which must land first. This change only *consumes* `region(regionId)` in the dialog (task 5.1).

## 3. Player detail endpoint

- [ ] 3.1 Define a `PlayerDetail` type (id, webName, fullName, position, team, price, age, regionId/nationality, form, epNext, pointsLastWeek, minutesLastWeek, optaCode)
- [ ] 3.2 Create `app/api/player/[id]/route.ts`: read the bootstrap element + reuse `fetchElementSummary(id)` (warm cache) to compute age from `birth_date`, `pointsLastWeek` from `event_points`, and `minutesLastWeek` from the latest `history` entry (`null` when no history yet); return `PlayerDetail`
- [ ] 3.3 Add a tiny client fetch helper (e.g. `lib/client/playerDetail.ts`) with per-id client-side caching so re-opening a dialog is instant

## 4. Verdict bar (glanceable verdict + transfers handoff)

- [ ] 4.1 Create `components/panel/VerdictBar.tsx`: left = one-line verdict from `buildVerdict`; right = "Open FPL Transfers" anchor (`FPL_TRANSFERS_URL`, new tab, `rel="noopener noreferrer"`)
- [ ] 4.2 Render `VerdictBar` in `app/page.tsx` directly under `Header`, full-width above the pitch/conversation grid; verify it shows in the base phase (captaincy pending) and updates in place when insights arrive

## 5. Player dialog

- [ ] 5.1 Create `components/panel/PlayerDialog.tsx` using `@base-ui/react/dialog`: fetches `PlayerDetail` on open (loading state), renders name, age, nationality (via `region(regionId)` from the `player-nationality-map` change — omit the row when it returns `null`), form, minutes & points last week (minutes "—" when null), expected next points, and a "View on Premier League" button via `plPlayerUrl` (hidden when null); dismiss via close button, backdrop, and Escape
- [ ] 5.2 Wire the dialog open-trigger into `components/pitch/PlayerToken.tsx` (token click → open dialog for that player; keep captain/availability badges non-interactive)
- [ ] 5.3 Wire the dialog open-trigger into `components/panel/ThisWeekDetail.tsx` transfer chips (`TransferLine` + restructure rows) so clicking a player name opens the dialog for that player (squad member or transfer target)

## 6. Verify

- [ ] 6.1 Run the green gate: `tsc`, eslint, and `vitest` (including the new helper tests) all pass
- [ ] 6.2 Manually verify in the running app: full-width verdict bar above the fold pre- and post-insights; "Open FPL Transfers" opens the transfers screen; clicking a pitch token and a This-Week name opens the dialog with correct stats; "View on Premier League" resolves to the right profile; minutes-last-week shows "—" before insights and a value after
