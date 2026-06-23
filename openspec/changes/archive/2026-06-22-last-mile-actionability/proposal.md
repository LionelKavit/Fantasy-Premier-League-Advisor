> **SUPERSEDED (2026-06-22, not implemented).** Split into two focused changes —
> `glanceable-verdict` (verdict bar + FPL transfers handoff) and
> `player-detail-dialog` (player dialog + premierleague.com link + cache-warm
> endpoint) — because the two surfaces share only the `FPL_TRANSFERS_URL`
> constant and are cleaner to build and review apart. Archived as the paper trail;
> no code shipped under this change. The nationality map it referenced shipped
> separately as `player-nationality-map`.

## Why

Pocket Scout is strong at *telling* a manager what to do, but advice → execution is fully manual: you read "João Pedro → X, captain Haaland," then open fantasy.premierleague.com and re-find every player yourself. There is also no one-second, always-visible verdict for the manager who doesn't want to read the brief or expand a drawer. Closing this last mile is the single biggest driver of whether someone returns every gameweek — it turns a dashboard you *read* into a tool you *act* with.

## What Changes

- **Glanceable verdict bar** — a full-width bar spanning the pitch and chat columns, above the fold, showing a one-line verdict (e.g. *"This week: João Pedro → Saka · Captain Haaland · Hold your chips"*) derived deterministically from the committed plan so it is correct before/without LLM insights, with the **"Open FPL Transfers"** action at the end of the bar.
- **FPL transfers deep link** — the bar's "Open FPL Transfers" button links to `https://fantasy.premierleague.com/transfers`, landing the manager on the screen where they execute the move. (FPL has no public *write* API — we hand off, we do not auto-execute.)
- **Player detail dialog** — clicking a pitch token *or* a This-Week transfer name opens a dialog with key details for that player: name, age, nationality, FPL form, minutes & points last week, expected next points, and a **"View on Premier League"** button linking to the player's premierleague.com profile (FPL has no per-player page; the profile is keyed by the player's Opta id, which FPL exposes as `opta_code`).

No breaking changes. The verdict and handoff degrade gracefully when insights are absent (deterministic base still yields a verdict; the deep link is always available once a plan loads; the dialog shows everything except minutes-last-week until insights warm the element-summary cache).

## Capabilities

### New Capabilities
- `actionability-handoff`: External handoffs that let a manager *act* on the advice — the FPL transfers deep link, and a per-player detail dialog (key stats + a "View on Premier League" link to the player's premierleague.com profile) opened from a pitch token or a This-Week transfer name.
- `glanceable-verdict`: A single always-visible, above-the-fold verdict bar summarising the week's decision (transfer, captain, chip), derived deterministically and kept in sync with refined captaincy, hosting the "Open FPL Transfers" action.

### Modified Capabilities
<!-- None — this change introduces new surfaces only; existing pipeline/optimizer requirements are unchanged. -->

## Impact

- **UI**: new full-width `VerdictBar` above the pitch/conversation grid (`app/page.tsx` + `components/panel/VerdictBar.tsx`); a new `components/panel/PlayerDialog.tsx`; click handlers wiring the dialog into `components/pitch/PlayerToken.tsx` and `components/panel/ThisWeekDetail.tsx`.
- **API**: a new lazy `app/api/player/[id]/route.ts` returning a merged `PlayerDetail`, reusing the existing `fetchElementSummary` (warm server cache → no redundant FPL call for analyzed players).
- **Client libs**: `lib/client/fpl-links.ts` (`FPL_TRANSFERS_URL`, `plPlayerUrl`, `slugify`); `lib/client/moves.ts` (`buildVerdict` from a `GameweekPlan`).
- **Data**: adds `optaCode`/`fullName` to the normalized `Player` and `SquadPlayerView` for link building; introduces a `PlayerDetail` shape (including the raw `regionId`) served by the new route. Relies on existing `GameweekPlan` fields for the verdict. No optimizer/captain/scoring pipeline changes.
- **Depends on**: the **`player-nationality-map`** change (provides `region(id)` for the dialog's nationality row). That change must land first.
- **Dependencies**: none new (dialog via the existing `@base-ui/react` primitives; links are plain anchors).
