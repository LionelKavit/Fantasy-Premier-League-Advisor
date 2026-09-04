## Tasks — deadline brief email

### Task 1: Free-transfer derivation helper
**Capability:** deadline-brief
- [x] `lib/free-transfers.ts`: pure `deriveFreeTransfers(transfers, chipPlays, targetGw)` implementing the banking rules (1 after GW1, +1/GW, cap 5, consume 1 per transfer floor 0, wildcard/FH gameweeks consume none).
- [x] Unit tests (`lib/__tests__/free-transfers.test.ts`) covering: no-transfer banking to the cap, consumption, hits (floor 0), wildcard/FH non-consumption, GW1/GW2 boundary.

### Task 2: Runner + email
**Capability:** deadline-brief
- [x] `scripts/deadline-brief.ts`: hourly-tick entry — env from `.env.local`; window gate (`deadline − 5h ≤ now < deadline`) off live `bootstrap-static`; capture via child `npx tsx research/squad-eval/capture.ts <teamId>` (failure logged, non-blocking); plan via `runGameweekPlan(teamId, { freeTransfers: derived })`; email body from `buildBriefGrounding` + plan detail (transfers with ep reasoning, captain/vice, chip, alerts, derived-FT assumption line); send via Resend `fetch`; once-per-GW state file written only after a successful send.
- [x] `.env.example`: add `RESEND_API_KEY`, `BRIEF_EMAIL_TO`, `BRIEF_TEAM_ID`. `.gitignore`: add `scripts/.deadline-brief-state.json`.

### Task 3: Scheduler (launchd)
**Capability:** deadline-brief
- [x] `scripts/com.pocketscout.deadline-brief.plist`: hourly LaunchAgent template running the script from the main checkout via a login shell (`zsh -lc`), logging to `~/Library/Logs/pocketscout-brief.log`.
- [x] Install/uninstall instructions (in the plist header or `scripts/README` note): copy to `~/Library/LaunchAgents`, `launchctl load`; note that install happens on the main checkout after this branch merges.

### Task 4: Verify
- [x] App gate clean (`tsc`/`eslint`/`vitest`) — scripts/ excluded from the Next build like `research/`.
- [x] Dry-run the runner with a forced window (env override or temporary flag): confirm quiet-tick exit, capture invocation, derived-FT value, email compose; a real Resend send once Kavit adds `RESEND_API_KEY` (needs their key — cannot be tested before).
- [x] Confirm no personal data/secrets in tracked files (`git diff` scan).

> **As-built (2026-08-02):** derivation helper + 7 unit tests green; gate clean (341 tests). Dry-run (window forced, picks stubbed — real picks aren't public pre-GW1): capture failure logged without blocking, FT derived 0 for GW1, GW1 unlimited-changes copy, real-pipeline captain (Haaland, vice B.Fernandes), honest `unavailable` markers when keyless. Secret scan clean — recipient/keys live only in `.env.local`.
>
> **Open (owner: Kavit):** (1) add `RESEND_API_KEY` + `BRIEF_EMAIL_TO` to `.env.local` — the real send is untestable before that; (2) install the LaunchAgent on the main checkout after merge; (3) structural: no GW1 capture/brief exists via the public API — the first scheduled brief fires in the GW2 window.
