# Tasks — N-move free-transfer strategy

### Task 1: `freeMoves` on the result type
**Capability:** free-transfer-nmove-strategy
- `lib/optimizer/types.ts`: add `freeMoves: ValidTransfer[]` to `SingleTransferResult`. Keep
  `bestSingle`/`bestSecond` as the first two elements (`freeMoves[0] ?? null` / `freeMoves[1] ?? null`)
  for existing consumers (`lib/scout/*`, synthesis prompt).

### Task 2: Greedy N-move builder
**Capability:** free-transfer-nmove-strategy
- `lib/optimizer/single-transfer.ts`: replace `findBestSecond` with `buildFreeMoves` — iteratively pick
  the best legal move and apply it to a running bank/team-count snapshot, up to `freeTransfers` moves.
  Each move must clear `TRANSFER_THRESHOLDS.freeTransferEp` (via `candidate.epNext − weak.epNext`),
  have `gw1Gain > 0`, not reuse a used weak/candidate id, and pass `validateTransfer` against the running
  budget/counts. Stop early when no qualifying move remains.
- Populate `freeMoves` on the returned result; leave the FT=0 hit-bar gate and `alternatives` untouched.

### Task 3: Exclude all free moves from the hit pool
**Capability:** free-transfer-nmove-strategy
- `lib/optimizer/hit-transfer.ts`: build `usedIds` from the full `singleResult.freeMoves` set
  (not just `bestSingle`/`bestSecond`).

### Task 4: Synthesis carries the full free set
**Capability:** free-transfer-nmove-strategy
- `lib/optimizer/synthesis.ts`: `mapTransferAction` `FREE` → `transfers: singleResult.freeMoves`,
  `netGain` = Σ `gw1Gain`; apply the same in `buildFailSafe`.
- Update the prompt to be N-aware: pass the full `freeMoves` list, state `freeTransfers` available, and
  reframe the "rolling for 2 FTs" instruction so the remainder is banked/rolled.

### Task 5: Plural headlines
**Capability:** free-transfer-nmove-strategy
- `components/panel/ThisWeekDetail.tsx`: `primaryHeadline` `FREE` →
  `Make ${n} free transfer${n === 1 ? "" : "s"}` from `action.transfers.length`.
- `lib/scout/brief.ts`: `transferHeadline` `FREE` → same, from `BriefTransfer.moves.length`.

### Task 6: Tests + verify
**Capability:** free-transfer-nmove-strategy
- Update `lib/__tests__/optimizer/setup-single.test.ts`: FT=2 now asserts both moves land in `freeMoves`.
- Add cases: FT=3/4/5 stacks up to N moves and stops early when moves run out; each stacked move clears the
  bar (a marginal 4th is excluded); FT=0 produces no free move (hit path); a free move never reappears in the
  hit recommendation.
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run`.
- Manual (dev server): Re-analyze at FT=5 → up to five stacked free moves in This Week with a plural
  headline; FT=1 → single move, singular headline.
