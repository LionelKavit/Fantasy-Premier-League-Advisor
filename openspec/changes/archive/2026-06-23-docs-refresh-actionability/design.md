## Context

The docs were last refreshed for the "conversation-first" version (commit `6a12587`). Since then this branch added: the verdict bar (`VerdictBar`), the player detail dialog (`PlayerDialog` + `/api/player/[id]`), the actionability handoffs (`FPL_TRANSFERS_URL`, `plPlayerUrl`), knowledge-grounded chat (`expertKnowledgeBlock` in the scout system prompt), the chip-verdict authority clause, the restructured This Week tab (Transfer · Captaincy · Chip · Restructure), the chip+transfer coexist fix, and rotating brief placeholders. The docs describe none of these.

## Goals / Non-Goals

**Goals:**
- README and ARCHITECTURE accurately describe the current surfaces and the chat's knowledge grounding.
- Screenshots show the current UI, captured as one coherent story (same manager/GW as the existing set).
- Links/anchors stay valid; the docs build (mermaid renders, no broken image refs).

**Non-Goals:**
- Rewriting `EVALUATION.md` (model/backtest content is unchanged).
- Re-recording the demo `.mov` (heavier; note as a follow-up).
- Documenting internal-only changes that don't alter the product story (e.g. test factories).

## Decisions

**1. Keep the existing doc structure; edit in place.**
Add to the existing sections rather than reorganising — README "What it does" gains verdict-bar / dialog / actionability bullets; ARCHITECTURE's request-flow mermaid gains the `/api/player/[id]` node and a verdict-bar mention; the "Agentic Scout chat" + "Knowledge & grounding" sections are corrected. *Alternative:* a new "What's new" section — rejected; the docs should read as the current state, not a changelog.

**2. Correct the chat-grounding description precisely.**
The current text says the chat is "grounded in the committed chip plan and your held chips." Update to: also grounded in the curated knowledge base (`chips.md`, `rank-strategy.md`) via `loadKnowledge`, with the committed chip plan **authoritative over** those principles for the chip decision (the chip-verdict authority clause). Update the "Knowledge & grounding" table's *Feeds* column so chip + rank knowledge also feed **the chat**.

**3. Re-capture screenshots on the GW38 demo manager.**
Match the existing convention (`docs/images/README.md`: "all captured on the same manager (GW38) so the set reads as one coherent story"). Re-shoot: `fpl-advisor-hero.png` (now includes the verdict bar), `fpl-advisor-this-week.png` (now the four sections), and add `fpl-advisor-player-dialog.png` (token → dialog). The chat shots can stay unless the panel chrome changed materially. Capture via the running app + the preview screenshot tool, then update the `docs/images/README.md` inventory table.

**4. Verdict-bar restyle and rotating placeholders are minor.**
Mention the verdict bar's role (glanceable, above the fold, with the deep link); the rotating brief placeholders are a small loading affordance — a one-line mention at most, no screenshot (transient).

## Risks / Trade-offs

- **Screenshots drift again next change.** → Accept; this change brings them current. The inventory note already explains the capture convention for future refreshes.
- **Image diffs are large binaries.** → Only re-shoot the genuinely-stale frames (hero, this-week, + the new dialog), not the whole set.
- **Mermaid edits can break rendering.** → Verify the diagrams still parse (GitHub mermaid) before finishing.

## Migration Plan

Docs + images only; no code, no behaviour, nothing to roll back beyond reverting the files. Land it in the same branch before the PR so the merged history's docs match the merged code.

## Open Questions

- Whether to add a dedicated "Actionability" subsection to the README or fold it into "What it does" — leaning fold-in (one product story). Resolve in build; no spec impact.
