# Design

## Context

`evaluateChipInteractions` ([chip-interaction.ts](../../../lib/optimizer/chip-interaction.ts)) is the deterministic generator. Post-`chip-single-source-of-truth` it emits `window`/`hold` entries. The app already computes the inputs these better triggers need: `detectDGW`/`detectBGW` (gameweek flags), `computeFdrRun` (per-team FDR runs), the fixture list, chip state, and `currentGw`.

## Key Decisions

### 1. Wildcard ← fixture swing or DGW setup (not "≥3 upgrades")
Replace the upgrade-count trigger with the `chips.md` principle: a Wildcard window opens when a meaningful **fixture swing** is detected for several of the manager's teams (FDR run improving past a threshold via `computeFdrRun`) **or** to set up a near-term **Double Gameweek** squad. The window's gameweek is the swing/DGW gameweek, not unconditionally `currentGw`.

### 2. Expiry / half-awareness as deterministic calendar rules
Encode the season structure (configurable per season, mirroring `chips.md`): first set expires at the GW19 deadline; second set unlocks GW20 and expires GW38; one chip per gameweek. Derive **deadline pressure** — as a chip's half-deadline nears with an unused chip, raise the urgency on the best remaining `window` ("use-it-or-lose-it"). This is the deterministic half of `chips.md`'s "don't hoard."

### 3. Season-wide window detection
Detect Double/Blank windows across the remaining half (bounded by the season), not just `currentGw + 3`, so the Chips tab and orchestrator can see a Bench Boost three doubles away.

### 4. Minor principle coverage
Free Hit also opens on a big Double (one-week ceiling), not only a Blank; Triple Captain may open on a single great home fixture, not only a Double.

## Design constraints
- **Deterministic + grounded in confirmed fixtures** — windows reference real scheduled Doubles/Blanks/swings; nothing invented.
- **Still `window`/`hold` only** — no `play-now` (N2).
- **Season rules are data** — the GW19/GW20/GW38 boundaries live in config (like the existing `chips.md` "update each season" note), not hard-coded magic.
- **Testable** — each trigger is a pure function over fixtures/flags/chip-state.

## Files (indicative)
```
lib/optimizer/chip-interaction.ts   // reworked evaluators: wildcard (fixture-swing/DGW), expiry pressure, wider look-ahead, FH/TC tweaks
lib/config.ts                        // season chip calendar (GW19/GW20/GW38, one-per-GW)
lib/gameweek.ts (reuse)              // computeFdrRun / detectDGW / detectBGW
```

## Tests
- Wildcard: opens on a detected fixture swing / DGW setup; does NOT open merely because ≥3 upgrades exist.
- Expiry pressure: with an unused first-half chip and GW19 approaching, the best window's urgency rises.
- Look-ahead: a DGW beyond +3 gameweeks is detected.
- Confirmed-only: no window is emitted for an unscheduled (no-fixture) gameweek.
