# Free-transfer math hygiene — banking cap & restructure cost

## Why
Widening the FT range to 0–5 (`free-transfer-input-range`) exposes two pieces of FT-count-dependent math
in the optimizer that were silently correct only within the old `{1,2}` world and are now wrong at the
edges. These are small, self-contained **bug fixes** — split out from the strategy change so the
correctness intent is reviewable on its own (the user explicitly asked for the affected spots to be
hygiene-checked).

1. **Banking copy caps at 2.** When the engine recommends a roll, `single-transfer.ts` tells the manager
   they'll "bank N free transfers next week" via `freeTransfers + 1 > 2 ? 2 : freeTransfers + 1` — hardcoded
   to the old 2-cap. FPL banks up to **5**, so a manager rolling from 3 or 4 is told the wrong (too low) number.
2. **Restructure cost is wrong at FT=0.** A restructure is a **two-move** chain (sell the dream's funder +
   buy the dream). `restructure.ts` prices it as `freeTransfers >= 2 ? 0 : 4` — correct at FT≥2 (free) and
   FT=1 (one hit, −4), but **at FT=0 it should cost −8** (two hits), not −4. The displayed "−4 pts" understates
   the cost and can make a restructure look worth it when it isn't.

## What changes
- **`free-transfer-banking-cost-hygiene`** — two corrections:
  1. `lib/optimizer/single-transfer.ts`: the banked-transfers figure caps at `FREE_TRANSFER_RANGE.max` (5)
     instead of 2 — `Math.min(FREE_TRANSFER_RANGE.max, freeTransfers + 1)`.
  2. `lib/optimizer/restructure.ts`: the restructure cost reflects the two moves it actually spends —
     `Math.max(0, 2 - freeTransfers) * 4` (FT≥2 → 0, FT=1 → 4, FT=0 → 8).

## Impact
- `lib/optimizer/single-transfer.ts` (roll-reason copy), `lib/optimizer/restructure.ts` (`totalCost`).
- Surfaces in the roll-reason string and in the This Week restructure rows ("free" / "−N pts") and the
  LLM context; no schema or type changes.
- Tests: add banking-cap and restructure-cost cases.

## Out of scope
- The N-move free-transfer logic itself (in `free-transfer-nmove-strategy`).
- The input field / API clamps (in `free-transfer-input-range`).

## Depends on
`free-transfer-input-range` (these errors only manifest once 0 and 3–5 are reachable). Independent of
`free-transfer-nmove-strategy` and can ship in the same batch; both reference the same `FREE_TRANSFER_RANGE`
constant added in `free-transfer-input-range`.
