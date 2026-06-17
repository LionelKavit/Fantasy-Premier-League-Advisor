## Tasks

**Status: ✅ Complete (implemented + design-reviewed).** All 8 tasks built and verified in-browser. Shipped as **Pocket Scout**. tsc + lint + build clean; backend tests still 130 passing.

As-built refinements baked into the specs (from two `fpl-design-review` passes):
- Player tokens are **frosted translucent cards** (not opaque white), with the rating as **coloured footer text** (not filled colour-block pills), full names on one line, and small **top-left** corner weak/OUT chips (no shirt/name overlap).
- Header is **centre-aligned** (team/manager, GW/rank/bank, controls); the "Change" action is now **Reset**.
- Formation label sits at the **top-centre of the pitch**; "SUBSTITUTES" heading is centred.
- Shirts load at `-110.png` for crispness; pitch uses the FPL green gradient with a darker subs strip.

### Task 1: Surface FPL-familiar player stats
**Capability:** team-pitch (data dependency)
**Files:** `lib/plan/types.ts`, `lib/plan/index.ts`, `lib/__tests__/factories.ts`, `lib/__tests__/e2e/flow.test.ts`

Extend `SquadPlayerView` with `form`, `pointsPerGame`, and `epNext` (pass-throughs already on `Player`); populate in `buildSquadView`. Update the e2e assertion to expect the fields. Keep `npm test` green.

### Task 2: FPL theme + client helpers
**Capability:** app-shell
**Files:** `app/globals.css`, `lib/client/plan.ts`, `lib/client/formation.ts`

Add the FPL palette as CSS variables (`--fpl-purple #37003C`, `--fpl-green #00FF87`, `--fpl-cyan #04F5FF`, `--fpl-magenta #E90052`, `--pitch-green`). `plan.ts`: typed `fetchPlan(managerId, freeTransfers)` → `GameweekPlan`. `formation.ts`: formation derivation, `shirtUrl(teamCode, isGk)`, and `score → 0–10 rating` mapping.

### Task 3: Onboarding
**Capability:** manager-onboarding
**File:** `components/ManagerIdForm.tsx`

FPL-styled entry: numeric-guarded manager ID + "where to find it" hint + free-transfers segmented control (default 1) + submit; persist last ID / FT in `localStorage`.

### Task 4: Dashboard shell + states
**Capability:** app-shell
**Files:** `app/page.tsx`, `components/Header.tsx`, `components/states/Skeleton.tsx`, `components/states/ErrorCard.tsx`

`page.tsx` (client): owns `{ managerId, freeTransfers, status, plan, error }`. FPL-purple `Header` (manager/team/rank/GW/bank + FT control + re-analyze). Skeleton pitch + error card.

### Task 5: Pitch + player tokens (FPL-authentic)
**Capability:** team-pitch
**Files:** `components/pitch/Pitch.tsx`, `components/pitch/PlayerToken.tsx`

`Pitch`: formation rows + separated "Substitutes" strip. `PlayerToken`: shirt `<img>` (by `teamCode`, GK variant) + `onError` stylized jersey + alt text; purple name bar; dual-encoded metric bar (0–10 rating number + tiered pill, plus price/epNext/PPG); (C)/(V) badge; availability flag with text/percentage; weak-spot outline + tag; "OUT" marker.

### Task 6: Recommendation panel
**Capability:** recommendation-panel
**File:** `components/RecommendationPanel.tsx`

Neutral surface with FPL accents (green=buy, magenta=sell, always labelled). Primary move (+narrative+confidence), hit verdict, captain card (captain/vice/differential + reasons), merged alerts; "AI synthesis offline" chip when `confidence === "low"`; soft empty states when a side is null.

### Task 7: Wire, responsive, accessibility pass
**Capability:** app-shell
Compose in `page.tsx`; desktop two-column → mobile stacked; reuse shadcn `button.tsx`, `lucide-react`, `cn()`. Verify color+text dual-encoding, WCAG-AA contrast, alt text, ≥44px touch targets, `prefers-reduced-motion`.

### Task 8: Verify
- `npm run dev`, enter a real manager ID (e.g. `10815578`): pitch renders correct formation, XI vs "Substitutes" split, real shirts (+fallback when a URL is broken), purple name bars, dual-encoded rating/stats, (C)/(V) badges, availability flags, weak highlights; panel shows recommendation, captain, alerts in the FPL palette.
- Bad ID → error card; in-flight → skeleton; fail-safe (no/invalid `ANTHROPIC_API_KEY`) → "AI offline" chip + deterministic picks shown.
- `npx tsc --noEmit`, `npm run build`, and `npm test` all clean.
