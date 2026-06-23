## 1. This Week tab — four separate sections

- [x] 1.1 In `components/panel/ThisWeekDetail.tsx`, restructure into sections in order: Transfer, Captaincy, Chip (only when a play-now chip exists), Restructure (move Captaincy above Restructure; add a dedicated Chip section)
- [x] 1.2 Transfer section (always): show the week's actual transfers — `activeChip.draft` when the play-now chip carries a draft (WC/FH), otherwise `primaryRecommendation` (move / roll / hit) — via `groupTransferMoves` + `TransferLine`, keeping the hit verdict + data-notice; never render a chip announcement here
- [x] 1.3 Chip section (conditional): announce "Play your {chipName}" with a one-line reason (clamp the chip `reason` to a single line, e.g. `line-clamp-1`/truncate); no transfer pills

## 2. Verdict bar — transfer, then captain, then chip

- [x] 2.1 In `lib/client/moves.ts`, update `buildVerdict`/`transferSegment`/`chipSegment` so: drafted play-now chip → `transfer = "Play your {chip}"`, `chip = ""`; draftless chip + concrete move → `transfer` = the move, `chip = "Play your {chip}"`; draftless chip + roll → `transfer = "Roll your transfer"`, `chip = "Play your {chip}"`

## 3. Tests

- [x] 3.1 `lib/__tests__/client/moves.test.ts`: draftless chip + concrete move → move in `transfer`, "Play your {chip}" in `chip`; draftless chip + roll → roll in `transfer`, chip in `chip`; drafted chip → "Play your {chip}" in `transfer`, `chip` empty

## 4. Verify

- [x] 4.1 Green gate: `tsc`, eslint, `vitest` pass
- [x] 4.2 Manually verify (GW38 team: Bench Boost play-now + João Pedro → Watkins): This Week shows Transfer (João Pedro → Watkins), Captaincy, Chip (Play your Bench Boost), Restructure — in that order, in separate sections; the verdict bar reads "João Pedro → Watkins · Captain Haaland · Play your Bench Boost"; confirm a Wildcard/Free-Hit scenario shows the draft in the Transfer section and "Play your {chip}" in the Chip section
