# Design — free-transfer input range (0–5)

## 1. Shared range constant
**Current:** the bounds `1` and `2` are hardcoded in ~8 places (7 route clamps + 2 UI toggles), with no
single definition. Widening means touching each independently and risking drift.

**Design:** add to `lib/config.ts`:
```ts
export const FREE_TRANSFER_RANGE = { min: 0, max: 5, default: 1 } as const;
```
Every clamp and the UI import this. A tiny helpers pair keeps call sites honest:
```ts
export const isValidFt = (n: number) =>
  Number.isInteger(n) && n >= FREE_TRANSFER_RANGE.min && n <= FREE_TRANSFER_RANGE.max;
export const clampFt = (n: number) =>
  Math.min(FREE_TRANSFER_RANGE.max, Math.max(FREE_TRANSFER_RANGE.min, n));
```
(`clampFt` for the server/persistence boundary where we coerce; `isValidFt` for the UI where we *block*.)

## 2. Validated numeric field (replaces the toggle)
**Current:** both `Header.tsx` and `ManagerIdForm.tsx` render `{[1, 2].map((n) => <button …>)}`.

**Design:** replace with a numeric `<input inputMode="numeric">` bound to the FT value.
- **Validation = block, not clamp** (per the product decision). The field holds raw text; it is valid
  only when it parses to an integer in range. While invalid: show inline `Enter a value between 0 and 5`
  in the existing invalid-text style (`text-fpl-pink`), set `aria-invalid`, and **disable the action**
  (Header: the Re-analyze button; Form: the Submit button). This mirrors `ManagerIdForm`'s existing
  `touched && !valid` manager-ID treatment, so the pattern is already in the file.
- **Header nuance:** Header already separates *selection* from *applied* (`freeTransfers` vs `appliedFt`,
  with a `dirty`/pending highlight on Re-analyze). Keep that: the field updates the selection; an invalid
  selection both blocks Re-analyze and should not be persisted. Keep `onFreeTransfersChange` firing only
  for valid integers so `localStorage`/state never holds an out-of-range value.
- **Keyboard/spinner:** allow empty-string mid-edit (don't coerce to 0 on backspace); treat empty as
  invalid-but-not-error until `touched`. `min={0} max={5} step={1}` for native affordance, but the JS
  guard is the source of truth (native clamping alone wouldn't *block*).

## 3. Range-widened API clamps
**Current:** `const n = nParam ? Math.min(2, Math.max(1, parseInt(nParam))) : 1;` (and the `body.n`/
`body.freeTransfers` variants in `brief`/`ask`). `app/api/squad/route.ts` does a raw
`parseInt(searchParams.get("free_transfers") ?? "1")` with **no** clamp.

**Design:** replace each clamp with `clampFt(parseInt(...))`, keeping the missing-param default at
`FREE_TRANSFER_RANGE.default` (1). Add `clampFt` to `squad/route.ts` so a hand-crafted `?free_transfers=99`
can't reach the engine. `parseInt` of a non-numeric still yields `NaN` → guard: `clampFt(Number.isNaN(x) ? default : x)`.
Routes touched: `plan`, `plan/base`, `plan/insights`, `optimize`, `ask`, `brief` (×2), `squad`.

## 4. Persistence fix (`app/page.tsx`)
**Current:** `const savedFt = Number(localStorage.getItem(LS_FT)) || 1;` — `Number("0")` is `0`, which is
falsy, so `|| 1` rewrites a legitimately-saved **0** to **1**.

**Design:** parse explicitly and clamp: read the raw string, `parseInt`, and pass through `clampFt` with the
default when missing/NaN — so 0 round-trips. `useState(FREE_TRANSFER_RANGE.default)` for the initial
selection and `appliedFt`.

## Sequencing / safety
- This change is **strategy-inert**: it only changes what value can be entered and accepted. With the
  engine unchanged, FT=3–5 flows in and is handled by the existing `>= 2` branch (i.e. behaves like 2),
  FT=0 routes through the already-present `needsHit = freeTransfers < 1` path. Nothing crashes.
- Land before `free-transfer-nmove-strategy` so the strategy work has a real 0–5 input to exercise.
