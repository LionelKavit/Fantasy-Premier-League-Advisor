## 1. README

- [x] 1.1 "What it does": add the glanceable verdict bar (above-the-fold decision + "Open FPL Transfers"), the player detail dialog (token / This-Week name → dialog, "View on Premier League"), and note the restructured This Week tab
- [x] 1.2 "Architecture at a glance" mermaid: add the verdict bar to the UI node and show curated knowledge feeding the chat (not only the syntheses)
- [x] 1.3 "Screenshots": update the table to the current shots (hero w/ verdict bar, This Week w/ four sections, + the new dialog shot)

## 2. ARCHITECTURE

- [x] 2.1 Request flow: add the `/api/player/[id]` cache-warm detail route (bootstrap + element-summary reuse); mention the verdict bar in the base-phase output
- [x] 2.2 "Agentic Scout chat": describe it as grounded in the curated knowledge base (`chips.md`, `rank-strategy.md`) with the committed chip plan authoritative over the principles (chip-verdict authority)
- [x] 2.3 "Knowledge & grounding" table: update the *Feeds* column so chip + rank knowledge also feed the chat
- [x] 2.4 Add a short mention of the actionability surfaces (verdict bar, player dialog, FPL/PL deep links)

## 3. Screenshots & inventory

- [x] 3.1 Re-captured hero (verdict bar) + this-week (four sections) on GW38
- [x] 3.2 Added fpl-advisor-player-dialog.png (B.Fernandes; flag-after-name); renamed the follow-up shot; dropped the redundant standalone opening-brief shot
- [x] 3.3 Update `docs/images/README.md` inventory to list the refreshed/added images; leave the demo `.mov` re-record as a noted follow-up

## 4. Verify

- [x] 4.1 Internal links/anchors resolve, mermaid fences balanced; all referenced images exist EXCEPT the two awaiting your capture (`fpl-advisor-player-dialog.png`) + the always-external `demo.mov`
- [x] 4.2 Skim the rendered README + ARCHITECTURE for accuracy against the shipped UI
