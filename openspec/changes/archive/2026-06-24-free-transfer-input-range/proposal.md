# Free-transfer input — {1,2} toggle → validated 0–5 field

## Why
The free-transfer (FT) count is the single input that steers the whole transfer recommendation, yet the
UI only lets a manager pick **1 or 2** (a two-button toggle in `Header.tsx` and `ManagerIdForm.tsx`), and
every API route clamps the value to `[1,2]` (`Math.min(2, Math.max(1, …))`). FPL actually banks **0–5**
free transfers. A manager with 0 (just used both) or 3–5 (rolled several weeks) literally cannot tell the
Scout the truth, so the advice is computed against the wrong constraint. This change makes the **input**
honest across the full 0–5 range with explicit validation. It is the foundation the strategy work
(`free-transfer-nmove-strategy`) and the cost-math fixes (`free-transfer-banking-cost-hygiene`) build on.

## What changes
- **`free-transfer-input-range`** — the FT value accepts the integer range **0–5** end to end:
  1. **Shared range constant.** A single source of truth `FREE_TRANSFER_RANGE = { min: 0, max: 5, default: 1 }`
     in `lib/config.ts`, consumed by every clamp and the UI — no more scattered `1`/`2` literals.
  2. **Validated numeric field (replaces the toggle).** `Header.tsx` and `ManagerIdForm.tsx` swap the
     `[1,2]` two-button toggle for a free-entry numeric field. Out-of-range or non-integer input is
     **blocked** with an inline prompt ("Enter a value between 0 and 5") — Re-analyze (Header) and
     Submit (Form) are disabled while invalid. Mirrors the existing `touched && !valid` manager-ID pattern.
  3. **Range-widened API clamps.** All routes that read `free_transfers` clamp to `[0,5]` (default 1)
     instead of `[1,2]`: `app/api/{plan,plan/base,plan/insights,optimize,ask}/route.ts`, both clamps in
     `app/api/brief/route.ts`, and a newly-added clamp in `app/api/squad/route.ts` (today a raw `parseInt`).
  4. **Persistence fix.** `app/page.tsx` reads the saved FT as `Number(localStorage…) || 1`, which silently
     turns a stored **0** into **1**. Parse so 0 survives within range.

## Impact
- UI: `components/Header.tsx`, `components/ManagerIdForm.tsx`, `app/page.tsx`.
- API: the 7 route clamps above (`app/api/**`).
- Config: `lib/config.ts` (new constant).
- Behaviour: the value now reaches the engine as 0–5. The engine still treats ≥2 like 2 until
  `free-transfer-nmove-strategy` lands, so this change is **independently shippable and inert on strategy** —
  it only fixes what the manager can express and what the routes accept.

## Out of scope
- Any change to how the optimizer *uses* the FT count (N-move strategy, banking copy, restructure cost) —
  those live in `free-transfer-nmove-strategy` and `free-transfer-banking-cost-hygiene`.
- Captain/chip logic.

## Depends on
None. Prerequisite for `free-transfer-nmove-strategy` and `free-transfer-banking-cost-hygiene`.
