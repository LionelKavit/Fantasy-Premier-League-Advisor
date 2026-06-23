## 1. Client plumbing for the demo signal

- [ ] 1.1 `lib/client/plan.ts`: add `demo?: boolean` to `fetchPlanBase` / `fetchPlanInsights`; when true, send `demo=1` and omit `team_id` (keep signatures backward-compatible)
- [ ] 1.2 `lib/client/ask.ts` + `lib/client/brief.ts`: add `demo?: boolean`; when true, send `demo: true` in the body and omit `team_id`

## 2. Demo mode in the page

- [ ] 2.1 `app/page.tsx`: add `mode: "manager" | "demo"`; add `loadDemo()` (demo base → captaincy-only insights → `briefNonce` bump) that never writes `localStorage`
- [ ] 2.2 Ensure the mount-time auto-recall restores only a real saved ID, never demo
- [ ] 2.3 Add an exit-demo handler ("Enter your ID") → `mode = "manager"`, `status = "idle"`, clear `plan`
- [ ] 2.4 Pass a `demo` flag down to the panels and the chat

## 3. Entry CTA

- [ ] 3.1 `components/ManagerIdForm.tsx`: add `onExplore` prop + a secondary "Explore without a team" CTA with honest copy (sample squad, chat-only advice)

## 4. Verdict banner

- [ ] 4.1 `components/panel/VerdictBar.tsx`: demo branch → season-aware banner (draft-2026-27 off-season / Dream-XV-for-GW{n} in-season); drop the "Open FPL Transfers" deep link; no personalized recommendation line

## 5. Panel gating

- [ ] 5.1 `components/panel/FullBreakdown.tsx`: in demo hide the transfer section, the Chips tab, **and** the Long Term tab; keep Captaincy; ensure the active lens never lands on a hidden tab
- [ ] 5.2 `components/Header.tsx`: hide FT toggle + Re-analyze in demo; relabel "Change manager" → "Enter your ID"; show a demo marker instead of manager name/rank
- [ ] 5.3 `components/panel/AlertsCard.tsx`: render nothing / neutral note in demo (no personalized risk)
- [ ] 5.4 `components/pitch/Pitch.tsx`: empty `transferOutIds` in demo (no highlight)
- [ ] 5.5 Guard every demo-visible panel against `transfers === null`

## 6. Demo starter chips

- [ ] 6.1 `lib/client/scoutStarters.ts`: add `buildDemoStarters(plan)` (captain "why", best value, a head-to-head, a season-aware draft question)
- [ ] 6.2 `components/panel/AskTheScout.tsx`: select the starter set by `demo`; thread `demo` into `streamAsk` / `streamBrief`; reuse existing chip rendering + click-to-send + auto-hide

## 7. Conversion CTA

- [ ] 7.1 Add a persistent, non-blocking "Want advice for YOUR squad? Enter your ID →" affordance in the demo layout → exit-demo handler

## 8. Verify & green-gate

- [ ] 8.1 Run the app: Explore → pitch paints → demo brief streams → a starter chip fires a tool-grounded answer → no transfer/chip/long-term UI → "Enter your ID" returns to form → refresh shows form (no demo recall)
- [ ] 8.2 Audit panels for leaked "your squad"/rank/chip copy in demo
- [ ] 8.3 `tsc` / `eslint` / `vitest` clean

## Notes

- Depends on `demo-mode-engine` (the `demo` route signal + `transfers: null` plan shape). Implement engine first.
- The season basis ("live" vs "off-season") drives the banner/starter copy; coordinate the exact field surfaced on the demo plan with `demo-mode-engine`.
