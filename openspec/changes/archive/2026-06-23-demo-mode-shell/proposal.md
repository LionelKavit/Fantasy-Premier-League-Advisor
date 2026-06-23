# Demo-mode shell — the ID-less explore experience

## Why
`demo-mode-engine` makes the server able to produce a season-aware sample plan, brief, and chat without a manager ID. This change is the **UI half**: the entry point that lets a visitor choose to explore without an ID, and the panel-level adaptations that turn the standard manager view into a coherent **demo experience** whose job is to convince a stranger, in ~30 seconds, that there's a real engine inside.

The demo is not a stripped-down app — it's a different product with a different goal: showcase the pitch, the ratings, and (the hero) the knowledge-grounded chat, then hand the visitor a soft on-ramp to "enter your ID for your squad." Because this app is a portfolio piece, the most important demo visitor may not be an FPL manager at all — so the experience leads with the chat doing something visibly smart, via the seeded starter chips that already exist.

## What changes
- **An "Explore without a team" entry** on `ManagerIdForm` — a secondary CTA beside "Analyze my team" that starts demo mode. Forward-compatible: it's the same door a future build-a-squad sandbox would use.
- **A demo mode in `app/page.tsx`** — a `mode: "manager" | "demo"` distinction. Demo loads via the `demo` route signal (no `team_id`), runs base → trimmed insights → opening brief, and **does not persist**: it is never written to `localStorage` and never auto-recalled on refresh. Every fresh visit shows the form (the conversion funnel).
- **Season-aware verdict banner** — in demo, the `VerdictBar` becomes a banner ("The Scout's draft pick for 2026-27" off-season / "Dream XV for GW{n} — enter your ID for yours" in-season) instead of the personalized transfer·captain·chip line, and drops the per-manager "Open FPL Transfers" deep link.
- **Panel gating** — the transfer section, the Chips tab, and the Long Term tab are hidden in demo (the Long Term tab is the optimizer's transfer horizon, which demo does not produce); the pitch, 0–10 ratings, and captaincy remain. The header drops the Free-transfers toggle and Re-analyze; "Change manager" becomes "Enter your ID."
- **Demo-flavored starter chips** — a `buildDemoStarters` variant of the existing `buildScoutStarters` ("Why is {captain} in this team?", "Salah or Saka?", "Best value pick?", "Who'd you draft for 2026-27?"), reusing the existing chip rendering and click-to-send.
- **A soft conversion CTA** — a persistent, low-pressure "Want advice for YOUR squad? Enter your ID →" affordance that returns to the form.

## Impact
- Touches `app/page.tsx`, `components/ManagerIdForm.tsx`, `components/Header.tsx`, `components/panel/{VerdictBar,FullBreakdown,AlertsCard,AskTheScout}.tsx`, `components/pitch/Pitch.tsx` (transfer-out highlight off in demo), `lib/client/{plan,ask,brief}.ts` (thread the `demo` flag), and `lib/client/scoutStarters.ts`.
- Additive and gated on `mode === "demo"`; the ID-based flow is unchanged.
- No new backend; consumes the `demo-mode-engine` route contract and trimmed plan shape.

## Out of scope
- All server behavior (squad construction, demo context/plan/brief/chat) — that's `demo-mode-engine`.
- The interactive build-a-squad sandbox (future).
- Persisting or resuming a demo session.

## Depends on
- **`demo-mode-engine`** — the `demo` route signal, the demo plan/brief, and the trimmed `GameweekPlan` shape (`transfers` null — no transfer rec, long-term horizon, or chip plan) this UI renders.
