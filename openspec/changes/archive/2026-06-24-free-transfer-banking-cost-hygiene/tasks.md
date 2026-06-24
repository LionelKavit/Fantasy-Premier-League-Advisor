# Tasks — free-transfer banking & restructure-cost hygiene

### Task 1: Banking copy cap → 5
**Capability:** free-transfer-banking-cost-hygiene
- `lib/optimizer/single-transfer.ts`: in the roll branch, replace
  `const banked = freeTransfers + 1 > 2 ? 2 : freeTransfers + 1;` with
  `const banked = Math.min(FREE_TRANSFER_RANGE.max, freeTransfers + 1);` (import `FREE_TRANSFER_RANGE`
  from `lib/config`). Roll-reason wording otherwise unchanged.

### Task 2: Restructure cost → max(0, 2 − FT) × 4
**Capability:** free-transfer-banking-cost-hygiene
- `lib/optimizer/restructure.ts`: replace `const totalCost = freeTransfers >= 2 ? 0 : 4;` with
  `const totalCost = Math.max(0, 2 - freeTransfers) * 4;`. No type/UI change — `ThisWeekDetail` already
  renders `totalCost === 0 ? "free" : "−{n} pts"`.

### Task 3: Tests + verify
**Capability:** free-transfer-banking-cost-hygiene
- Add cases: banked figure is 4 at FT=3, 5 at FT=5, 2 at FT=1; restructure `totalCost` is 8 at FT=0,
  4 at FT=1, 0 at FT≥2.
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run`.
- Manual (dev server): roll recommendation at FT=3 reads "bank 4"; a restructure option at FT=0 shows
  "−8 pts".
