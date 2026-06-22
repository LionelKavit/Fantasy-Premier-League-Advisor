## Tasks

> Deterministic. Improves the candidate windows; still emits `window`/`hold` only.

### Task 1: Real Wildcard trigger
**Capability:** chip-windows
**File:** `lib/optimizer/chip-interaction.ts`

Replace the "≥3 upgrades" trigger with fixture-swing detection (`computeFdrRun` improving past a threshold for several squad teams) and/or DGW-setup. Window gameweek = the swing/DGW gameweek.

### Task 2: Expiry / half-awareness + don't-hoard pressure
**Capability:** chip-windows
**Files:** `lib/optimizer/chip-interaction.ts`, `lib/config.ts`

Encode the season chip calendar (GW19 first-set expiry, GW20 unlock, GW38, one-per-GW) in config. Raise urgency on the best remaining window as a half-deadline nears with an unused chip.

### Task 3: Season-wide detection + minor principles
**Capability:** chip-windows
**File:** `lib/optimizer/chip-interaction.ts`

Detect Double/Blank windows across the remaining half (not just +3 GW). Free Hit also on a big Double; Triple Captain on a single great fixture.

### Task 4: Tests + verify
- Wildcard opens on a fixture swing/DGW, not on upgrade count.
- Expiry pressure raises urgency near GW19/GW38 with an unused chip.
- DGW beyond +3 GW detected; no window for an unscheduled gameweek.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.

## Verification
- In-app: chip windows in the Chips tab reflect real fixture swings/Doubles/Blanks and show urgency as a half-deadline nears.
