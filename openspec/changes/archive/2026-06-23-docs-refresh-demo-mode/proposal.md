# Docs refresh — document demo mode

## Why
Three changes shipped demo mode this session — `demo-mode-engine` (season-aware sample squad + captaincy-only plan), `demo-mode-shell` (the "Explore without a team" experience), and `demo-chat-knowledge-and-brevity` (rules grounding + tighter tokens). The docs still describe an **ID-only** product and have drifted on specifics:

- **README** opens "Enter your FPL manager ID and Pocket Scout scouts your squad" with **no mention of demo mode**; the architecture diagram entry is `Manager ID` only; the knowledge box reads `chips · rank`; the quickstart says only "enter any public FPL manager ID"; the tech-stack line says **"Vitest (263 tests)"** — it's now **317**.
- **ARCHITECTURE** lists curated knowledge as `chips.md, rank-strategy.md` (missing **`rules.md`**), describes the Scout chat as grounded only in the chip plan + held chips + chips/rank (no demo path: general advice, rules grounding, tighter brevity, a visitor-independent shared cache), and the request-flow section has no demo branch (no-ID → synthesized dream team → captaincy-only insights, optimizer never run).
- **Screenshots** (`docs/images/`) show only the ID-based UI; there's no demo capture.

A reader (recruiter, contributor) landing on the repo should see that the app is explorable without an ID, and the docs should be accurate. This change refreshes them.

## What changes
- **README.md** — add demo mode to "What it does" (explore without an ID → a season-aware sample squad + chat, no personalized plan); add the demo entry to the "Architecture at a glance" diagram and put **rules** in the knowledge box; add "or click **Explore without a team**" to the quickstart; correct the test count (263 → **317**); reflect `chips · rank · rules`.
- **docs/ARCHITECTURE.md** — add `rules.md` to the curated-knowledge list and the "Knowledge & grounding" table; document the **demo path** in the request-flow section (no manager ID → `buildDemoSquad` season-aware dream team → base pitch/ratings + captaincy-only insights, optimizer skipped); document the **demo chat** (Scout persona, general advice on a sample squad, current-rules grounding, ~2-sentence brevity / lower `max_tokens`, and a constant, visitor-independent cache prefix). Note the demo's graceful no-LLM degradation.
- **Screenshots** — add a demo-mode capture to `docs/images/` and update the `docs/images/README.md` inventory.
- **Validity** — keep all internal links/anchors valid, mermaid diagrams rendering, and image references pointing at files that exist.

## Out of scope
- **docs/EVALUATION.md** — reviewed; demo mode does **not** touch the model, weights, or backtests (the dream-team builder is a display heuristic, not an evaluated model), so it needs no change. Called out so "did we forget evaluation?" is answered.
- Dev-facing files (`AGENTS.md`, `CLAUDE.md`) — not user docs.
- Any code change — this is docs-only.
- A new demo video (`.mov`) — the existing demo video stays; only still screenshots are added.

## Depends on
Archived `demo-mode-engine`, `demo-mode-shell`, `demo-chat-knowledge-and-brevity` (the shipped behavior these docs describe). Follows the pattern of `[[docs-refresh-actionability]]`.
