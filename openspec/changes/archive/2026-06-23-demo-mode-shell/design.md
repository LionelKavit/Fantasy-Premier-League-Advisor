# Design — demo-mode shell

## 1. Mode in `app/page.tsx`
Introduce an explicit `mode: "manager" | "demo"`. Today the page keys everything off `managerId` + `status`; demo adds a parallel load path.

- `loadDemo()`: mirrors `load()` but calls the demo route variants (no `team_id`), sets `mode = "demo"`, and runs base → trimmed insights → `briefNonce` bump (so the chat fires the demo brief). Reuses the same `plan` state and the two-phase merge; the merged plan simply has `transfers.primaryRecommendation`/`chipPlan` absent.
- **No persistence:** `loadDemo()` never writes `LS_ID`/`LS_FT`; the mount-time `useEffect` that auto-recalls only ever restores a real saved ID, never demo. Refresh → back to the form.
- `mode` is passed to the child panels (or a `demo` boolean derived from it) so each can adapt. Keep it a single source of truth on the page, not duplicated in `plan`.
- Exiting demo ("Enter your ID") → `setMode("manager")` + `setStatus("idle")` + clear `plan`, returning to `ManagerIdForm`.

## 2. Entry point (`components/ManagerIdForm.tsx`)
Add an `onExplore: () => void` prop and a secondary CTA under the primary button:
```
[ Analyze my team ]
      ── or ──
[ Explore without a team ]   ← secondary/ghost styling
```
Keep the copy honest about what demo is (a sample squad, chat-only advice). The primary ID flow is unchanged.

## 3. Verdict banner (`components/panel/VerdictBar.tsx`)
A `demo` branch that replaces the personalized line with a season-aware banner:
- off-season → "The Scout's draft pick for 2026-27"
- in-season → "Dream XV for GW{currentGw} — enter your ID for yours"

The `season` basis is conveyed by the plan/brief from the engine; the banner reads from the plan (e.g. presence/absence of a live projection, or a `season` field surfaced on the demo plan — coordinate the exact field with `demo-mode-engine` if needed). Drop the "Open FPL Transfers" deep link (per-manager URL, meaningless in demo). The captain may still be named (it's squad-derived, not personalized).

## 4. Panel gating (`FullBreakdown`, `Header`, `AlertsCard`, `Pitch`)
- **FullBreakdown:** in demo, hide the Transfer section within "This Week", hide the **Chips** tab, and hide the **Long Term** tab (it renders `plan.transfers.horizon`, which is the optimizer's transfer horizon — null in demo). Keep Captaincy. The drawer still starts collapsed. Ensure the lens state can't land on a hidden tab in demo (default to This Week / Captaincy).
- **Header:** in demo, hide the Free-transfers toggle and the Re-analyze button; relabel "Change manager" → "Enter your ID" (calls the exit-demo handler). The demo plan has no real manager name/rank to show — render a "Demo" marker instead.
- **AlertsCard:** demo has only generic/empty risk alerts (no personalized risk); render nothing or a neutral note rather than an empty card.
- **Pitch:** unchanged except `transferOutIds` is empty in demo (no transfer-out highlight, since there's no recommended move).

## 5. Starter chips (`lib/client/scoutStarters.ts` + `AskTheScout`)
Add `buildDemoStarters(plan)` — a demo sibling of `buildScoutStarters`:
- "Why is {captain} in this team?" (captain from the plan)
- "Best value pick in this squad?"
- "Salah or Saka?" (an evergreen head-to-head that shows `compare_players`/`score_player`)
- "Who'd you draft for 2026-27?" (leans into the season-aware angle)

`AskTheScout` chooses the starter set by mode (a `demo` prop), and threads `demo` into `streamAsk`/`streamBrief`. All existing chip rendering, click-to-send, and auto-hide-after-first-question logic is reused unchanged — this is the cheap win: the seeded-conversation hook is already built.

## 6. Client plumbing (`lib/client/{plan,ask,brief}.ts`)
Thread an optional `demo` flag:
- `fetchPlanBase` / `fetchPlanInsights`: add `demo?: boolean`; when true, send `demo=1` and omit `team_id`.
- `streamAsk` / `streamBrief`: add `demo?: boolean` to the body; when true, send `demo: true` and omit `team_id`.
Keep the signatures backward-compatible (optional param) so the ID flow is untouched.

## 7. Conversion CTA
A persistent, low-pressure affordance in the demo layout (e.g. under the breakdown, or in the header marker): "Want advice for YOUR squad? Enter your ID →" → exit-demo handler → form. It is the funnel's close; keep it visible but not nagging.

## Risks & notes
- **Shape coupling:** the UI must tolerate `transfers === null`/horizon-only and `chipPlan` absent without throwing. Much of this already holds (base phase ships with `transfers: null`), but verify every demo-visible panel guards the missing fields.
- **Don't leak personalization:** audit each panel for "your squad"/rank/chip copy that should be suppressed in demo.
- **Verify** with the running app: demo entry → pitch paints → demo brief streams → a starter chip fires a tool-grounded answer → no transfer/chip UI present → "Enter your ID" returns to the form → refresh shows the form (no demo recall).
