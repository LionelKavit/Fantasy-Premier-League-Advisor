## 1. Data plumbing — carry the dialog fields on the normalized Player

- [x] 1.1 Add `birth_date` + `region` to `FplPlayerRaw`, and `optaCode`, `fullName`, `birthDate`, `region` to the normalized `Player` (`lib/types.ts`)
- [x] 1.2 Populate them in `normalizePlayer` (`lib/fpl-api.ts`) from `raw.opta_code` / `${raw.first_name} ${raw.second_name}` / `raw.birth_date` / `raw.region`; update the test `makePlayer` factory
- [x] 1.3 (Revised) `SquadPlayerView` is NOT changed — `fetchBootstrap` returns normalized players, so the route builds `PlayerDetail` from `BootstrapData.players`; the dialog opens with just a player id

## 2. Link helper

- [x] 2.1 Extend `lib/client/fpl-links.ts` with `slugify(name)` and `plPlayerUrl(optaCode, fullName): string | null` (strip leading `p`, require digits, build `/en/players/{id}/{slug}/overview`; `null` when no usable id)
- [x] 2.2 Add `lib/__tests__/client/fpl-links.test.ts`: Haaland mapping, missing/malformed `opta_code` → null, diacritics slug

## 3. Player detail endpoint

- [x] 3.1 Define a `PlayerDetail` type + pure `buildPlayerDetail(player, summary)` + `ageFromBirthDate` (`lib/player-detail.ts`); unit-tested in `lib/__tests__/player-detail.test.ts`
- [x] 3.2 Create `app/api/player/[id]/route.ts`: reuse `fetchBootstrap` (warm) + `fetchElementSummary(id)` (warm; failure → minutesLastWeek null) → return `PlayerDetail`
- [x] 3.3 Add `lib/client/playerDetail.ts`: a fetch helper with per-id client-side caching (shared in-flight promise) so re-opening is instant

## 4. Player dialog

- [x] 4.1 Create `components/panel/PlayerDialog.tsx` using `@base-ui/react/dialog`: `PlayerDialogProvider` + `useOpenPlayerDialog`; body keyed by id (fresh mount, no synchronous setState in effect); renders name, age, nationality (via `region` — omit when null), form, mins/pts last week (mins "—" when null), exp next pts, and a "View on Premier League" button via `plPlayerUrl` (hidden when null); dismiss via close/backdrop/Escape
- [x] 4.2 Wire into `components/pitch/PlayerToken.tsx` (token is a `<button>` → opens the dialog; badges stay non-interactive)
- [x] 4.3 Wire into `components/panel/ThisWeekDetail.tsx` transfer chips (`TransferLine` via `groupTransferMoves` ids + restructure sell/buy/dream rows)

## 5. Design review

- [x] 5.1 Ran `fpl-design-review` on the rendered dialog; applied the fixes: large extrabold tabular stat figures, small uppercase labels, cyan subtitle, the expected-next-points value accented green, and a pill-shaped PL button
- [x] 5.2 Updated the spec with the FPL-aligned visual-presentation requirement

## 6. Verify

- [x] 6.1 Green gate: `tsc`, eslint (no errors), and `vitest` (292 passing, incl. fpl-links + player-detail + transferMoves) pass
- [x] 6.2 Manually verified in the running app: a pitch token opens the dialog with correct stats (Pickford: age 32, 🏴 England, mins 90, pts 2, ep 1.5); nationality flag renders; "View on Premier League" present; before/after styling confirmed via screenshot
