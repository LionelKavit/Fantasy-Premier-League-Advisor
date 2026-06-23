## Why

This branch shipped a wave of user-facing work — the glanceable verdict bar, the player detail dialog, the "Open FPL Transfers" / "View on Premier League" handoffs, knowledge-grounded chat, the chip-verdict authority fix, the restructured This Week tab, and rotating brief placeholders — but the docs and screenshots still describe the *previous* version. The README's "What it does" omits the verdict bar, the dialog, and the actionability handoffs; `ARCHITECTURE.md` predates the `/api/player/[id]` route and still says the chat is grounded only in the committed chip plan + held chips (it is now also grounded in the curated knowledge base, with the committed plan authoritative over it); and every screenshot predates the verdict bar, the dialog, and the new This Week sections. A merged branch whose docs lie about the product is worse than no docs.

## What Changes

- **README** — add the verdict bar, the player detail dialog, and the actionability handoffs to "What it does"; refresh the "Architecture at a glance" mermaid (verdict bar in the UI; knowledge now also feeds the chat); update the Screenshots table to the current UI.
- **ARCHITECTURE** — add the `/api/player/[id]` cache-warm detail route to the request flow; update the "Agentic Scout chat" + "Knowledge & grounding" sections so the chat is described as knowledge-grounded (chips.md + rank-strategy.md) with the committed chip plan authoritative over the principles; note the verdict bar / dialog / deep-link surfaces.
- **Screenshots & media inventory** — re-capture the stale shots on the same GW38 demo manager (for one coherent story): the hero (now with the verdict bar), This Week (now Transfer · Captaincy · Chip · Restructure sections), and a new player-dialog shot; update `docs/images/README.md` inventory accordingly.

Out of scope: `EVALUATION.md` (model/backtest content, unchanged by this branch) and the demo `.mov` (separate, heavier re-record — note it as a follow-up, don't block on it).

## Capabilities

### New Capabilities
- `current-documentation`: The README, ARCHITECTURE, and screenshot set accurately reflect the shipped feature set on this branch — the verdict bar, the player detail dialog, the FPL/Premier-League handoffs, and the knowledge-grounded chat with chip-verdict authority.

### Modified Capabilities
<!-- None — docs are not a tracked behavioural capability; this is a new documentation-accuracy capability. -->

## Impact

- **Docs**: `README.md` (What it does, Architecture mermaid, Screenshots), `docs/ARCHITECTURE.md` (request flow, LLM layer, Knowledge & grounding), `docs/images/README.md` (inventory).
- **Media**: re-captured PNGs under `docs/images/` (hero, this-week, new dialog); the rotating brief placeholder is transient and not a screenshot target.
- **Code/Deps**: none — documentation + images only. No behavioural change.
