# Design — docs refresh for demo mode

Docs-only. Each edit is a concrete, checkable change tied to a shipped behavior. The bar (from `docs-refresh-actionability`): accurate, internally consistent, links/mermaid/images all valid.

## README.md — specific edits
- **Lead paragraph / "What it does":** add a demo-mode bullet — "**No FPL ID? Explore without a team** — Pocket Scout builds a season-aware sample 'dream team' and you can ask the Scout anything; the chat is the whole point, no personalized transfer plan." Keep the ID-based pitch as the primary.
- **"Architecture at a glance" mermaid:** the entry node is `U([Manager ID]) --> BASE`. Add a demo entry, e.g. `D([No ID · Explore]) --> BASE` (or a note that BASE accepts a synthesized demo squad). Update the knowledge node `KB[(Knowledge: chips · rank)]` → `chips · rank · rules`.
- **Quickstart:** after "enter any public FPL manager ID" add "— or click **Explore without a team** to try a sample squad."
- **Tech stack line:** `Vitest (263 tests)` → `Vitest (317 tests)` (verify the live count at apply time and use the actual number).
- Optional: the **Status** line mentions "feature-complete demo" — clarify that demo *mode* (ID-less explore) now ships, distinct from "demo build."

## docs/ARCHITECTURE.md — specific edits
- **Curated-knowledge bullet** (LLM layer): add `rules.md` → `lib/knowledge/chips.md`, `rank-strategy.md`, **`rules.md`**.
- **"Knowledge & grounding" table:** add a row — `FPL rules | lib/knowledge/rules.md | static mechanics | the demo Scout chat` (and note chips/rank also feed the demo chat). 
- **Agentic Scout chat paragraph:** add a sentence on demo mode — same Scout persona, but general advice about a *sample* squad (no manager/rank/held chips), grounded in **current FPL rules** (so it never answers rules from stale training data), tuned for brevity (~2 sentences, lower `max_tokens`).
- **Request flow (two phases):** add a short **Demo mode** note/branch — with no manager ID, `buildDemoSquad` synthesizes a season-aware (calendar-determined) budget-valid dream team; the base phase returns the pitch/ratings + deterministic captain; demo insights run **captaincy only** (the optimizer — transfers, long-term horizon, chips — is never invoked); the chat/brief run with demo grounding. Mention graceful no-LLM degradation (deterministic spine + welcome brief).
- **Caching & state:** note the demo chat's system prefix is **constant across visitors**, so its prompt cache is shared (vs the per-manager prefix), and demo replies use a lower token cap.

## Screenshots
- Capture a **demo-mode** screenshot (the Explore view: DEMO header, season banner, the sample XI with armbands/ratings, the demo starter chips) → `docs/images/fpl-advisor-demo-mode.png` (name to match the existing `fpl-advisor-*` set).
- Add it to the README screenshot grid (or the "What it does" area) and list it in `docs/images/README.md`.
- Capture on the same footing as the rest of the set (consistent viewport).

## EVALUATION.md
Reviewed — no change. Demo mode adds no model/methodology; the dream-team builder ranks by `ep_next`/last-season points and is a display heuristic, not an evaluated component. (Recorded here so the omission is deliberate, per the request to cover evaluation.)

## Validation (done at apply time)
- All README/ARCHITECTURE internal anchors and cross-links resolve.
- Mermaid diagrams still parse (the edited "Architecture at a glance" and any ARCHITECTURE diagrams).
- Every image referenced exists in `docs/images/`; the inventory matches the files.
- The stated test count matches `npx vitest run`.
