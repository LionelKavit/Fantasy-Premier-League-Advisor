# Design

## Context

Everything the UI needs arrives in one `GET /api/plan?team_id=X&free_transfers=N` response (`GameweekPlan`): `squad` (15 `SquadPlayerView` in pick-slot order with `isStarting`, `position`, `teamCode`, `score`, `availability`, and `isCaptainRec`/`isViceRec`/`isWeakSpot`), `transfers`, `captaincy`, `manager`, `bank`, `chipsRemaining`, `alerts`. The UI is a thin rendering layer over this shape. This change additionally surfaces `form`, `pointsPerGame`, and `epNext` on `SquadPlayerView` for FPL-familiar per-player stats.

The **official FPL team page is the visual reference** — we adapt its layout, palette, and player-token anatomy.

## Key Decisions

### 1. FPL-authentic palette as CSS variables
Define the FPL brand palette in `app/globals.css` and consume via Tailwind:
- `--fpl-purple: #37003C` (headers, name bars, primary surfaces) · white text on it
- `--fpl-green: #00FF87` (accents, positive fills) · `--fpl-cyan: #04F5FF` (secondary accent) · `--fpl-magenta: #E90052` (alerts/sell)
- `--pitch-green` gradient for the pitch; neutral light surfaces for the recommendation panel
Bright green/cyan are reserved for large fills/accents, **never small text** (contrast).

### 2. Player token — frosted FPL card (refined via design review)
A single **frosted, translucent card** (semi-transparent white + `backdrop-blur`, translucent `--fpl-purple` footer) so the pitch shows through — *not* an opaque white tile.
- **Shirt:** `<img src={shirtUrl(teamCode, isGk)}>` from the FPL CDN (`shirt_<teamCode>-110.png`, GK `_1`); `onError` → stylized team-tinted jersey SVG. Always has descriptive `alt`.
- **Footer:** translucent purple; the **web name on a single line** (card widened so common names fit without an ellipsis), then the metric.
- **Metric = rating as coloured text, not a filled box:** the composite `score` as a **0–10 rating** rendered as coloured text (green strong / white mid / red weak) — number always present (dual-encoded). Price `£x.x` beside it; `epNext`/PPG available.
- **Markers (corner-placed, small, non-overlapping):** (C)/(V) circle **top-right** (filled green C / outlined white V); weak/transfer-out chip **top-left** (small "▲" amber / "OUT" pink) plus a coloured card ring; availability flag **bottom-left** (colour + "INJ"/"SUS"/"N/A"/chance %).

> Design-review note: the first cut used opaque white cards, filled colour-block rating pills, and a bulky "▲ UPGRADE" frame that overlapped the shirt/name. These were revised to the frosted card, coloured-text rating, and small top-left corner chip above.

### 3. Pitch + bench like FPL
Derive the formation from the starting XI (`squad.filter(isStarting)` grouped by `position`): GK row, then DEF/MID/FWD sized to counts, over a green gradient field (`#00a651` → `#008a45`) with subtle markings. The **formation label (e.g. "3-4-3") is a centred pill at the top of the pitch.** The 4 bench players (`!isStarting`) sit in a separated darker-green (`#007a3d`) strip below, under a **centred "SUBSTITUTES"** heading, GK first then bench order.

### 4. Centred FPL-style header
A `--fpl-purple` summary bar with everything **centre-aligned** on one axis: team name + manager name, a centred stats row (GW, Overall rank, Bank — value over label), then a centred controls row (free-transfers toggle, **Re-analyze**, **Reset** → back to onboarding).

### 5. Recommendation panel: neutral surface, FPL accents
Sections map `GameweekPlan` 1:1 (primary move + `narrativeSummary` + `confidence`, hit verdict, captain card, merged alerts). On a calm neutral surface so the purple pitch stays the anchor; positive actions use `--fpl-green`, sells/warnings use `--fpl-magenta`. `confidence === "low"` → an "AI synthesis offline" chip with deterministic picks still shown; a null side → a soft empty state.

### 6. Accessibility & usability (first-class, not an afterthought)
- **Dual encoding everywhere:** every score, status, and flag carries text/number + icon, never color alone.
- **Contrast:** white-on-purple and dark-on-white meet WCAG AA; bright accents only for large elements.
- **Touch targets** ≥ 44px; tokens are tappable for future drill-down.
- **Alt text** on every shirt ("{name}, {club}"). Respect `prefers-reduced-motion`.
- **Loading honesty:** `/api/plan` takes ~2s+ → skeleton pitch with progress copy, not a frozen screen.

### 7. One client-owned dashboard, one fetch
A single client component owns `{ managerId, freeTransfers, status, plan, error }` (`status ∈ idle | loading | loaded | error`); no global state lib, no recomputation, one request.

## Component map

```
app/page.tsx                       // dashboard shell + state machine (client)
app/globals.css                    // FPL palette CSS variables
components/ManagerIdForm.tsx        // "Pocket Scout" onboarding (name+tagline, id, free-transfers, hint)
components/Header.tsx               // centred FPL-purple bar: team/manager/rank/gw/bank + FT + Re-analyze + Reset
components/pitch/Pitch.tsx          // formation label (top-centre) + rows + centred "Substitutes" strip
components/pitch/PlayerToken.tsx    // frosted card: shirt(+fallback), purple footer (name + coloured rating + price), C/V, flag, weak/OUT chip
components/RecommendationPanel.tsx  // primary move, hit verdict, captain, alerts
components/states/{Skeleton,ErrorCard}.tsx
lib/client/plan.ts                  // typed fetch('/api/plan')
lib/client/formation.ts            // formation derivation + shirtUrl(teamCode, isGk) + score→rating
```

## Reused
- `components/ui/button.tsx` (shadcn), `lucide-react` icons, `cn()` in `lib/utils.ts`, Tailwind + `@base-ui/react`.
- Types from `lib/plan/types.ts` (`GameweekPlan`, `SquadPlayerView`), `lib/optimizer/types.ts`, `lib/captain/types.ts`.
