# Design — deadline brief email

## Context
The 2026-27 forward eval (`squad-eval-captain-live`) needs a pre-deadline capture every gameweek; the manager separately wants the app's weekly advice pushed to their inbox at the moment team news is final (~5h before deadline). FPL deadlines move week to week, so any fixed schedule is wrong; the deadline calendar is public in `bootstrap-static`. The app already computes the fully-merged weekly plan in one call (`runGameweekPlan`, the function behind `/api/plan`) and already distills it for prose grounding (`buildBriefGrounding`).

## Goals / Non-Goals

**Goals:**
- One scheduled runner that, inside the `deadline − 5h → deadline` window: refreshes the live-eval capture and emails the recommended transfers + captain, exactly once per gameweek.
- Deterministic end to end ("script the mechanical"): no model calls introduced — the LLM prose inside the plan is whatever the app produces (and degrades keylessly, as the app does).
- Honest email: derived free-transfer count stated as an assumption; anything unavailable is labeled, never invented.

**Non-Goals:**
- No in-app/runtime change, no new API route, no email infrastructure beyond one Resend HTTP call.
- Not a general notification system — one recipient, one message shape, weekly cadence.
- No auth-only data (`my-team`); public API only, so the analyzed squad is the last locked one (same as the app).

## Decisions

1. **Hourly launchd LaunchAgent + self-gating script — not a per-deadline schedule.** An hourly tick reads `bootstrap-static` and exits unless `deadline − 5h ≤ now < deadline` for the next gameweek. Tracks moving deadlines with zero maintenance; launchd (unlike cron) coalesces missed ticks on wake, so a sleeping Mac still fires if it wakes inside the window. Late wake inside the window still sends (a 2h-early brief beats none); past the deadline it skips — a post-deadline email is noise and a post-deadline capture is contaminated by design.
2. **Once-per-GW via a state file** (`scripts/.deadline-brief-state.json`, gitignored): records the last emailed GW; written only after a successful send, so a failed send retries on the next hourly tick. Capture needs no state — it's idempotent and pre-deadline re-runs are a feature (fresher snapshot).
3. **Capture runs as a child process** (`npx tsx research/squad-eval/capture.ts <teamId>`), not an import — keeps the eval harness's CLI contract and isolates its failure from the email path (capture failing must not kill the brief, and vice versa).
4. **Email content = `runGameweekPlan` → `buildBriefGrounding` + plan detail.** The grounding gives the merged headline (transfer moves, captain/vice, chip, top alert, deadline); the email adds the optimizer's expected-points reasoning (primary/secondary recommendation, restructure option if pitched) straight from the plan object. No new decision logic — the email can never disagree with the app.
5. **Free transfers derived, not asked.** `deriveFreeTransfers(history, transfers, targetGw)`: 1 FT after GW1, +1 per GW, cap 5, each transfer consumes 1 (floor 0 — hits), wildcard/Free Hit gameweeks consume nothing. Lives in `lib/` with unit tests (pure function). The email prints "assuming N free transfers (derived from your transfer history)" — a wrong derivation is visible and correctable, not silent.
6. **Resend via bare `fetch`** — `POST https://api.resend.com/emails`, `Authorization: Bearer $RESEND_API_KEY`, from `Pocket Scout <onboarding@resend.dev>`, to `$BRIEF_EMAIL_TO`. Zero dependencies. Missing key/recipient → the runner logs `unavailable — RESEND_API_KEY not set` (still captures) and exits non-zero.
7. **Config in `.env.local` only** (loaded by the runner the same way `capture.ts` does): `RESEND_API_KEY`, `BRIEF_EMAIL_TO`, `BRIEF_TEAM_ID` (default 2558300). The repo is public — the address and key never appear in tracked files; `.env.example` documents the names.

## Risks / Trade-offs
- **Mac powered off through the whole window** → no capture, no email that GW. Accepted: this is a personal-machine safety net, not hosted infra. (The parked `deploy` change is the eventual home for an always-on runner.)
- **FT derivation drift** (odd chip sequences, FPL rule tweaks) → wrong plan constraint. Mitigated by unit tests + the derived count stated in the email; the manager can always re-run the app with the true count.
- **Resend deliverability** (`onboarding@resend.dev` sender may land in spam) → first-run instruction: check spam, mark as not-spam. Domain verification is out of scope.
- **Two sources of truth for "the week's advice"** (app UI vs email) is avoided by construction — both call `runGameweekPlan`; but a plan computed 5h early can differ from one computed at deadline-minus-minutes. Accepted: 5h is the manager's chosen team-news sweet spot, and the email timestamps itself.
