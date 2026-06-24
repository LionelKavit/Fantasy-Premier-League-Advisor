# Tasks — free-transfer input range (0–5)

### Task 1: Shared range constant + helpers
**Capability:** free-transfer-input-range
- `lib/config.ts`: add `FREE_TRANSFER_RANGE = { min: 0, max: 5, default: 1 } as const` plus `isValidFt(n)`
  and `clampFt(n)` helpers (integer-aware; `clampFt` falls back to `default` on `NaN`).

### Task 2: Validated numeric field — Header
**Capability:** free-transfer-input-range
- `components/Header.tsx`: replace the `{[1,2].map(...)}` toggle with a numeric `<input inputMode="numeric"
  min={0} max={5} step={1}>` bound to `freeTransfers`.
- Invalid (out-of-range / non-integer / empty-after-touch) → inline "Enter a value between 0 and 5"
  (`text-fpl-pink`), `aria-invalid`, and **disable Re-analyze**. Only fire `onFreeTransfersChange` for
  valid integers so state/localStorage never holds an illegal value. Preserve the existing
  selection-vs-applied `dirty` pending highlight.

### Task 3: Validated numeric field — ManagerIdForm
**Capability:** free-transfer-input-range
- `components/ManagerIdForm.tsx`: replace the `{[1,2].map(...)}` toggle with the same numeric field,
  reusing the file's `touched && !valid` pattern; block `onSubmit` while the FT value is invalid.

### Task 4: Persistence fix
**Capability:** free-transfer-input-range
- `app/page.tsx`: read `savedFt` via `parseInt` + `clampFt` (not `Number(...) || 1`) so a stored `0`
  survives; initialise `useState`/`appliedFt` from `FREE_TRANSFER_RANGE.default`.

### Task 5: Widen API clamps to 0–5
**Capability:** free-transfer-input-range
- Replace `Math.min(2, Math.max(1, …))` with `clampFt(...)` (default 1 when the param is absent) in
  `app/api/plan/route.ts`, `app/api/plan/base/route.ts`, `app/api/plan/insights/route.ts`,
  `app/api/optimize/route.ts`, `app/api/ask/route.ts`, and **both** clamps in `app/api/brief/route.ts`.
- `app/api/squad/route.ts`: wrap the raw `parseInt(... ?? "1")` in `clampFt` so it is bounded 0–5.

### Task 6: Verify
**Capability:** free-transfer-input-range
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (clean — no strategy assertions change here).
- Manual (dev server): FT field rejects `7` and `-1` (inline prompt, Re-analyze/Submit disabled), accepts
  `0`, `1`, `5`; reload with `0` stored restores `0`; `curl` a route with `free_transfers=99` and confirm
  it is bounded.
