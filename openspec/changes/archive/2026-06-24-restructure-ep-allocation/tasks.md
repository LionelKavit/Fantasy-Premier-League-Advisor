# Tasks — restructure ep-native + optimal allocation

### Task 1: ep-native restructure
**Capability:** restructure-ep-allocation
- `lib/optimizer/restructure.ts`: compute `netEp = (dream.epNext − weak.epNext) + (replacement.epNext −
  funder.epNext)`; skip a chain if any `epNext` is null. Replace the composite `netScoreChange` decision
  with `netEp` on `RestructureOption` (`lib/optimizer/types.ts`).
- Build a real downgrade-leg `ValidTransfer` (funder → replacement) alongside the dream transfer; keep
  `gw1Gain` composite on both. Keep `findCheapestReplacement`'s composite floor only as a sanity filter.

### Task 2: shared ep-bar gate helper
**Capability:** restructure-ep-allocation
- Add a small helper for the two-move bar: `bar(freeCount) = min(2,freeCount)·1.5 + max(0,2−freeCount)·4`
  and `cost(freeCount) = max(0, 2−freeCount)·4` (reuse `TRANSFER_THRESHOLDS`). Apply `netEp > bar` when
  deciding/keeping a restructure.

### Task 3: optimal allocator
**Capability:** restructure-ep-allocation
- New `lib/optimizer/allocate.ts`: `allocateFreeTransfers(swaps, restructures, freeTransfers, bank, counts)
  → { freeMoves, chosenRestructureKeys }`. Candidate `Move` = swap (cost 1, `epGain = epDelta`) or
  restructure (cost 2, `epGain = netEp`). Maximize surplus `Σ epGain − 1.5·(transfers used)` over
  conflict-free sets with `Σ cost ≤ freeTransfers`; bounded DFS/branch-and-bound; feasibility = distinct
  sold/bought ids, sells-first bank ≥ 0, ≤ 3 per club. Deterministic tie-break.
- `lib/optimizer/single-transfer.ts`: replace `buildFreeMoves` with a call to the allocator; preserve the
  seed gate, roll/hold, `holdReason`, and FT=0 hit framing. `bestSingle`/`bestSecond` derive from `freeMoves`.

### Task 4: wiring
**Capability:** restructure-ep-allocation
- `lib/optimizer/index.ts`: compute restructure candidates before allocation and pass them in; set
  `restructureOptions` = candidates not in `chosenRestructureKeys`, re-priced/gated at
  `remainingFT = freeTransfers − transfers used by freeMoves`.
- `lib/optimizer/synthesis.ts`: minor prompt note that restructure net is ep.

### Task 5: display
**Capability:** restructure-ep-allocation
- `components/panel/ThisWeekDetail.tsx`: Restructure section renders non-chosen chains only; row shows
  `net +X.X pts` (ep) and the `remainingFT`-aware cost (`free` / `−4 pts` / `−8 pts`).

### Task 6: tests + verify
**Capability:** restructure-ep-allocation
- New `allocate` tests: swap-only matches prior greedy; restructure chosen over two swaps when its surplus
  is higher (and not chosen when two swaps win); budget respected; feasibility (budget/club/distinct
  player); FT=0 selects nothing free; FT=1 selects no restructure.
- `restructure` tests: net in ep; ep-bar gate excludes marginal chains; section cost/gate reflect
  `remainingFT` (FT=5 with 4 moves used → −4, not free); FT=0/1/2 standalone cost = 8/4/0.
- Update existing composite-based restructure/synthesis assertions to ep.
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` clean.
- Dev server (manager ID, FT 2–5): a restructure that beats straight swaps appears in the Transfer plan;
  the Restructure section lists the remaining chains with ep net and correct free/−4/−8 cost.
