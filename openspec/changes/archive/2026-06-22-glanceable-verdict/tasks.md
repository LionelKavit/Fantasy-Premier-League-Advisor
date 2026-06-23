## 1. Client helpers (pure, unit-tested)

- [x] 1.1 Create `lib/client/fpl-links.ts` with `FPL_TRANSFERS_URL = "https://fantasy.premierleague.com/transfers"` (the `player-detail-dialog` change extends this module with `plPlayerUrl`/`slugify`)
- [x] 1.2 Create `lib/client/moves.ts`: `buildVerdict(plan): { transfer: string; captain: string | null; chip: string }`, a pure function of `GameweekPlan` reusing `groupTransferMoves` — handle the move case, hold/roll, the play-now chip; captain from the LLM-refined `plan.captaincy` only (never the base armband)
- [x] 1.3 Add `lib/__tests__/client/moves.test.ts`: move, hold/roll, play-now chip, no-chips, and "never uses the base armband" cases

## 2. Verdict bar

- [x] 2.1 Create `components/panel/VerdictBar.tsx`: takes a `loading` prop — shows a placeholder ("Preparing this week's verdict…") while insights compute, else the one-line verdict from `buildVerdict`; right = "Open FPL Transfers" anchor (`FPL_TRANSFERS_URL`, `target="_blank"`, `rel="noopener noreferrer"`), shown in both states
- [x] 2.2 Render `VerdictBar` in `app/page.tsx` directly under `Header`, full-width above the pitch/conversation grid (outside the two-column grid so it spans both)

## 3. Verify

- [x] 3.1 Green gate: `tsc`, eslint, and `vitest` (incl. `moves.test.ts`) pass
- [x] 3.2 Manually verify in the running app: full-width bar above the fold showing the placeholder while insights compute, then the final verdict (no captain swap); "Open FPL Transfers" opens the transfers screen in a new tab; verdict wording matches This Week — verified (GW38 demo team): placeholder → "Play your Bench Boost · Captain Bowen", matches the This Week tab, console clean, link is a real anchor
