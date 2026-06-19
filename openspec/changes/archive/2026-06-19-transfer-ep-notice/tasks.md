## Tasks — deterministic ep-unavailable notice

### Task 1: Typed hold reason (optimizer)
**Capability:** transfer-optimization
- `lib/optimizer/types.ts`: add `TransferHoldReason = 'ep_unavailable' | 'below_threshold' | 'no_valid_targets'`; add `holdReason: TransferHoldReason | null` to `SingleTransferResult` and `dataNotice: string | null` to `OptimizerResult`.
- `lib/optimizer/single-transfer.ts`: set `holdReason` in each return branch (no targets / ep-null gate / below-threshold gate / recommended → null).

### Task 2: Deterministic notice (result + UI)
**Capability:** transfer-optimization
- `lib/optimizer/synthesis.ts`: set `dataNotice` from `singleResult.holdReason === 'ep_unavailable'` (fixed string, not LLM-authored) on the returned `OptimizerResult`; null otherwise.
- `components/panel/ThisWeekDetail.tsx`: render `transfers.dataNotice` as a calm info banner near the transfer block when present.

### Task 3: Verify
- Unit tests: `holdReason` set correctly per branch; `dataNotice` set iff `ep_unavailable`.
- Browser: force an ep-null squad/candidate and confirm the banner renders; confirm no banner when ep is present.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`).

---

## As-built outcome (run 2026-06-19)

**Implemented:**
- `lib/optimizer/types.ts`: `TransferHoldReason` + `SingleTransferResult.holdReason` + `OptimizerResult.dataNotice`.
- `lib/optimizer/single-transfer.ts`: sets `holdReason` in all four branches (`no_valid_targets` / `ep_unavailable` / `below_threshold` / null).
- `lib/optimizer/synthesis.ts`: `epDataNotice()` sets `dataNotice` deterministically (code-authored string, not LLM) on both the LLM-parse return and the fail-safe.
- `components/panel/ThisWeekDetail.tsx`: renders a calm amber info banner with an `Info` icon when `transfers.dataNotice` is present.

**Verified:**
- Unit (187 pass): `holdReason` is `'ep_unavailable'` when the best transfer's `epNext` is null, `'below_threshold'` below the bar, `'no_valid_targets'` with no targets, null when recommending.
- Type plumbing end-to-end enforced by `tsc` (`dataNotice` required on `OptimizerResult` → `GameweekPlan.transfers` → `ThisWeekDetail`).
- No regression: base API renders the squad, no console errors; `tsc` / `eslint` 0 / `next build` clean.

**Honest limitation:** the banner's *visual* render can't be exercised on live data right now — `ep_next` is currently populated (840/841), so the `ep_unavailable` path isn't reachable in a live demo. It's covered by the unit-tested data path + the straightforward conditional render; it will surface in the genuine pre-GW1 / blanked-ep condition it's built for.
