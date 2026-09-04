# Deadline brief email — scheduled capture safety net + actionable inbox brief

## Why
Two per-gameweek rituals now depend on a human remembering a deadline that moves around (Friday evenings, Saturday lunchtimes, blank/double reshuffles): the live-eval capture (a missed pre-deadline capture is a permanently lost data point — ~37 exist all season) and actually *acting* on the app's advice. The manager wants both automated at the moment team news is in: **5 hours before each deadline**, run the capture as a safety net (manual stays primary) and email the recommended transfers + captain so the moves can be made straight from the inbox.

## What Changes
- **Scheduled runner** (`scripts/deadline-brief.ts`): fires hourly via a user-level scheduler (launchd), self-gates against the live FPL deadline calendar — acts only inside the `deadline − 5h → deadline` window, once per gameweek. A fixed cron time can't track FPL's moving deadlines; reading `bootstrap-static` each run can.
- **Capture safety net**: inside the window, runs the existing `research/squad-eval/capture.ts` (idempotent — a manual capture already made simply gets refreshed; the eval's capture-timing rules are unchanged).
- **Email brief**: runs the app's real `runGameweekPlan` (the same function behind `/api/plan` — no new decision logic) and emails the recommended transfers, captain/vice, chip call, and alerts via **Resend** (single HTTP call, zero new dependencies) to the manager's inbox.
- **Free-transfer derivation**: the plan needs the manager's free-transfer count, which the app normally asks for interactively; the runner derives it deterministically from the public transfer/chip history (standard banking rules), and the email **states the derived number as an assumption** so a wrong derivation is visible, not silent.
- **Config via env** (`.env.local`, never committed): `RESEND_API_KEY`, `BRIEF_EMAIL_TO`, optional `BRIEF_TEAM_ID` (defaults to the harness manager, 2558300).

## Capabilities

### New Capabilities
- `deadline-brief`: the scheduled window-gated runner, the capture safety net, free-transfer derivation, and the Resend email brief.

### Modified Capabilities
<!-- none — capture semantics (captain-live-eval) are unchanged; the runner only invokes the existing command -->

## Impact
- New: `scripts/deadline-brief.ts` (runner + email), `scripts/derive-free-transfers.ts` (or a `lib/` helper with unit tests), `scripts/com.pocketscout.deadline-brief.plist` (launchd template + install instructions), `.env.example` entries.
- Reused, unchanged: `runGameweekPlan` (`lib/plan`), `buildBriefGrounding` (`lib/scout/brief.ts`), `research/squad-eval/capture.ts`, `lib/fpl-api.ts` fetchers.
- No app/runtime change; the Next.js build and Docker image are untouched. App gate (`tsc`/`eslint`/`vitest`) must stay clean.
- **Assumptions / open questions (owner: Kavit):** the Mac must be awake (or wake) during the 5-hour window — launchd runs missed jobs on wake, but a powered-off Mac sends nothing; Resend's free-tier `onboarding@resend.dev` sender is acceptable for a personal notification; the email address lives only in `.env.local` (public repo — no personal data committed).
