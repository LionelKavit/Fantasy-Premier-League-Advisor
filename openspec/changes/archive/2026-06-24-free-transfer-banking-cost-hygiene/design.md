# Design — free-transfer banking & restructure-cost hygiene

## 1. Banking copy cap (single-transfer.ts)
**Current:** in the roll branch of `evaluateSingleTransfer`:
```ts
const banked = freeTransfers + 1 > 2 ? 2 : freeTransfers + 1;
// → "Rolling to bank {banked} free transfers next week."
```
The `> 2 ? 2` clamp encodes the obsolete 2-transfer ceiling. Rolling from 3 banks 4, from 4 banks 5, from 5
stays 5 (already at cap, can't gain a 6th).

**Design:**
```ts
const banked = Math.min(FREE_TRANSFER_RANGE.max, freeTransfers + 1);
```
Import `FREE_TRANSFER_RANGE` from `lib/config`. At FT=5 this yields 5 (you don't lose the roll, but you
don't exceed the cap) — matches FPL's "use it or it stays at 5" rule. The surrounding sentence is unchanged.

## 2. Restructure cost (restructure.ts)
**Current:** inside `findRestructureOptions`, for each option:
```ts
const totalCost = freeTransfers >= 2 ? 0 : 4;
```
A restructure spends **two** transfers (downgrade a funder + buy the dream target). The binary `>= 2 ? 0 : 4`
is right at FT≥2 (both free) and FT=1 (one free + one −4 hit), but at FT=0 both are hits → it should be −8.

**Design:**
```ts
const totalCost = Math.max(0, 2 - freeTransfers) * 4;
```
- FT≥2 → `max(0, ≤0) * 4 = 0` (free)
- FT=1 → `1 * 4 = 4`
- FT=0 → `2 * 4 = 8`

This flows unchanged into the `RestructureOption.totalCost` field already rendered by `ThisWeekDetail`
(`o.totalCost === 0 ? "free" : "−" + o.totalCost + " pts"`), so the UI shows "−8 pts" at FT=0 with no
component change. The `netScoreChange > 0` gate above is untouched — note it compares composite score, not
points, so it does not double-count the cost; this fix only corrects the *displayed/where-consumed* cost.

## Why a separate change
Both are one-line corrections but they change *recommendation economics* (what the manager is told a move
costs / banks), so they deserve their own spec + tests rather than being buried in the N-move diff. They
share only the `FREE_TRANSFER_RANGE` constant with the other two changes.

## Edge cases
- FT already at 5 and rolling: `banked = 5` (correct — no phantom 6th).
- Restructure at FT≥2 unchanged (`0`), so no regression for the common case.
