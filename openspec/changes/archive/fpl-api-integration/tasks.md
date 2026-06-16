## 1. Project Setup

- [ ] 1.1 Initialize Next.js project at `/Users/km/Desktop/fpl-advisor` with TypeScript, Tailwind CSS, and App Router
- [ ] 1.2 Install dependencies: `anthropic` (Claude SDK)
- [ ] 1.3 Configure Tailwind with FPL color palette (purple #37003c, green #00ff87, cyan #05f0ff, pink #e90052, darkPurple #2d0032, lightPurple #963cff)
- [ ] 1.4 Create `.env.local` with `ANTHROPIC_API_KEY` placeholder
- [ ] 1.5 Initialize and configure shadcn/ui

## 2. TypeScript Types

- [ ] 2.1 Create `lib/types.ts` with `FplPlayerRaw` type (all 73+ fields from bootstrap-static elements, organized by group: identity, status, game data, raw stats, expected stats, per-90, ICT, set pieces, ranks, scouting)
- [ ] 2.2 Add `Player` normalized type (price in £m, position as string, form as number, teamName resolved) with nested `availability` object (status mapped to string, chanceOfPlayingThis/Next, news, newsAdded, scoutRisks, scoutNewsLink) and nested `setPieceDuties` object (penalties, corners, directFreekicks — each with order and text)
- [ ] 2.3 Add `Team` type (22 fields including strength_attack/defence home/away)
- [ ] 2.3.1 Add `TeamSetPieceNotes` type (teamId + notes array of info_message strings from set-piece-notes endpoint)
- [ ] 2.4 Add `Fixture` type (id, event, team_h/a, FDR, scores, kickoff_time, stats)
- [ ] 2.5 Add `Gameweek` type (id, name, deadline_time, is_current, is_next, finished)
- [ ] 2.6 Add `ManagerEntry` type (id, name, points, rank, bank, value — normalized)
- [ ] 2.7 Add `Pick` type and `PicksResponse` type (15 picks, entry_history, active_chip)
- [ ] 2.8 Add `PlayerGameweekHistory` type (per-GW stats from element-summary — including expected_goals_conceded, clean_sheets, saves, defensive_contribution, yellow_cards, red_cards for trend analysis)
- [ ] 2.9 Add `PlayerPastSeason` type (per-season totals from element-summary history_past)
- [ ] 2.10 Add `ApiErrorResponse` type (`{ error: string, status: number }`)

## 3. FPL API Client

- [ ] 3.1 Create `lib/fpl-api.ts` with in-memory cache (`Map<string, {data, timestamp}>`) and 1-hour TTL check
- [ ] 3.2 Implement `fetchBootstrap()` — fetch bootstrap-static, normalize players/teams/events, cache response
- [ ] 3.3 Implement `fetchEntry(teamId)` — fetch manager entry, normalize bank/value to £m
- [ ] 3.4 Implement `fetchPicks(teamId, gw)` — fetch picks for a gameweek, normalize bank
- [ ] 3.5 Implement `fetchHistory(teamId)` — fetch season history, derive chips remaining
- [ ] 3.6 Implement `fetchFixtures()` — fetch all fixtures, cache response
- [ ] 3.7 Implement `fetchElementSummary(elementId)` — fetch per-GW player history, cache per-player
- [ ] 3.8 Implement `fetchLiveEvent(gw)` — fetch live gameweek data
- [ ] 3.9 Implement `fetchSetPieceNotes()` — fetch team set piece notes
- [ ] 3.10 Add error handling for all fetch functions (non-200 responses, network failures, timeouts)

## 4. Gameweek Detection

- [ ] 4.1 Implement `detectCurrentGameweek(events)` — find current GW from events array with fallback logic
- [ ] 4.2 Implement `computeTeamFixtureCounts(fixtures, currentGw)` — per-team fixture count per upcoming GW
- [ ] 4.3 Implement `detectBGW(fixtureCounts)` — flag gameweeks where ≥4 teams have 0 fixtures
- [ ] 4.4 Implement `detectDGW(fixtureCounts)` — flag gameweeks where ≥4 teams have 2 fixtures
- [ ] 4.5 Implement `computeFdrRun(teamId, fixtures, currentGw, n)` — FDR array for next N GWs per team, handling nulls (BGW) and arrays (DGW)
- [ ] 4.6 Implement `getPlayerFixtures(player, fixtures, teams, currentGw, n)` — upcoming fixtures with opponent name, FDR, home/away

## 5. API Routes

- [ ] 5.1 Create `app/api/bootstrap/route.ts` — proxy bootstrap data to frontend
- [ ] 5.2 Create `app/api/squad/route.ts` — accept team_id + free_transfers, return enriched squad with metadata
- [ ] 5.3 Create `app/api/fixtures/route.ts` — return fixtures with BGW/DGW flags and team FDR runs
- [ ] 5.4 Create `app/api/transfers/route.ts` — stub route (will connect to optimizer pipeline later)
- [ ] 5.5 Create `app/api/advice/route.ts` — stub route (will connect to Claude synthesis later)
- [ ] 5.6 Implement consistent error response format (`{ error, status }`) across all routes

## 6. Verification

- [ ] 6.1 Test `fetchBootstrap()` returns valid player data — verify a known player (e.g., Salah) has correct fields
- [ ] 6.2 Test cache: second call to `fetchBootstrap()` within 1 hour does not make a network request
- [ ] 6.3 Test `fetchPicks()` with a real team ID returns 15 picks with valid element IDs
- [ ] 6.4 Test price normalization: raw `now_cost: 125` becomes `price: 12.5`
- [ ] 6.5 Test gameweek detection returns correct current GW
- [ ] 6.6 Test BGW/DGW detection against known gameweeks from the current season
- [ ] 6.7 Test FDR run computation returns correct difficulty values for a known team
- [ ] 6.8 Test `/api/squad` route end-to-end: team ID in → enriched squad out
- [ ] 6.9 Test error handling: invalid team ID returns 404 with correct error format
