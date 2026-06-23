## ADDED Requirements

### Requirement: README reflects the shipped surfaces

The root `README.md` SHALL describe the user-facing surfaces shipped on this branch: the glanceable verdict bar (the week's decision above the fold, with the "Open FPL Transfers" handoff), the player detail dialog (opened from a pitch token or a This-Week transfer name, with the "View on Premier League" link), and the restructured This Week tab. The "Architecture at a glance" diagram SHALL include the verdict bar and show the curated knowledge feeding the chat.

#### Scenario: Verdict bar and dialog are documented

- **WHEN** a reader reads the README "What it does" section
- **THEN** it mentions the glanceable verdict bar, the player detail dialog, and the FPL / Premier-League handoffs

### Requirement: ARCHITECTURE reflects the current pipeline and grounding

`docs/ARCHITECTURE.md` SHALL document the `/api/player/[id]` cache-warm player-detail route, and SHALL describe the agentic Scout chat as grounded in the curated knowledge base (`chips.md`, `rank-strategy.md`) with the committed chip plan authoritative over those principles for the chip decision. The "Knowledge & grounding" table SHALL show the chip and rank knowledge feeding the chat (not only the syntheses).

#### Scenario: Chat grounding is described correctly

- **WHEN** a reader reads the ARCHITECTURE "LLM layer" / "Knowledge & grounding" sections
- **THEN** the chat is described as knowledge-grounded, with the committed chip plan taking precedence over the principles for the chip verdict

#### Scenario: Player-detail route is documented

- **WHEN** a reader reads the ARCHITECTURE request-flow section
- **THEN** the `/api/player/[id]` route (reusing the warm bootstrap + element-summary caches) is described

### Requirement: Screenshots reflect the current UI

The screenshot set under `docs/images/` SHALL reflect the current UI — the hero shows the verdict bar, the This Week shot shows the Transfer · Captaincy · Chip · Restructure sections, and a player-dialog screenshot exists — captured on the same demo manager as the rest of the set. The `docs/images/README.md` inventory SHALL be updated to match.

#### Scenario: Current screenshots and inventory

- **WHEN** the README screenshots are viewed and `docs/images/README.md` is read
- **THEN** the images show the current UI (verdict bar, the four This-Week sections, the player dialog) and the inventory table lists them accurately

### Requirement: Docs remain valid

The updated docs SHALL keep valid internal links/anchors, render their mermaid diagrams, and reference only image files that exist.

#### Scenario: No broken references

- **WHEN** the docs are rendered (e.g. on GitHub)
- **THEN** internal links resolve, the mermaid diagrams parse, and every referenced image exists
