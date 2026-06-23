## ADDED Requirements

### Requirement: README documents demo mode
The root `README.md` SHALL describe demo mode — that a visitor can explore without an FPL manager ID via a season-aware sample squad and the Scout chat (no personalized transfer plan) — and SHALL keep its facts current.

#### Scenario: Demo mode appears in "What it does"
- **WHEN** a reader reads the README "What it does" section
- **THEN** it states that the app can be explored without a manager ID (a sample "dream team" + chat), distinct from the ID-based personalized flow

#### Scenario: Diagram and knowledge are current
- **WHEN** a reader views the "Architecture at a glance" diagram and the tech-stack line
- **THEN** the diagram shows a no-ID/demo entry alongside the Manager ID entry, the knowledge node reads `chips · rank · rules`, and the test count matches the current suite (not the stale 263)

#### Scenario: Quickstart mentions Explore
- **WHEN** a reader follows the quickstart
- **THEN** it notes they can click "Explore without a team" to try a sample squad instead of entering an ID

### Requirement: ARCHITECTURE documents the demo path and rules grounding
`docs/ARCHITECTURE.md` SHALL document the demo request path, the demo chat, and the `rules.md` knowledge file.

#### Scenario: rules.md is listed
- **WHEN** a reader reads the LLM-layer knowledge bullet and the "Knowledge & grounding" table
- **THEN** `lib/knowledge/rules.md` is listed as curated knowledge feeding the demo chat (alongside chips and rank)

#### Scenario: Demo request path is described
- **WHEN** a reader reads the request-flow section
- **THEN** it describes that with no manager ID a season-aware sample squad is synthesized (`buildDemoSquad`), the base phase returns the pitch/ratings + deterministic captain, and demo insights run captaincy only (the optimizer — transfers, long-term horizon, chips — is not invoked)

#### Scenario: Demo chat is described
- **WHEN** a reader reads the agentic-chat / caching sections
- **THEN** the demo chat is described as the same Scout persona giving general advice about a sample squad, grounded in current FPL rules, tuned for brevity (lower token budget), with a visitor-independent (shared) cache prefix, and degrading gracefully without the LLM

### Requirement: A demo-mode screenshot slot is documented
The docs SHALL reserve a demo-mode screenshot slot — referenced in the README and listed in the `docs/images/README.md` inventory — pending a maintainer-supplied image.

#### Scenario: Demo screenshot is referenced with a placeholder
- **WHEN** the README images and `docs/images/README.md` are viewed
- **THEN** a demo-mode screenshot slot (the Explore view — DEMO header, season banner, sample XI, demo starter chips) is referenced and listed, with a clear placeholder marker until the actual image is supplied

### Requirement: EVALUATION notes the demo squad is not an evaluated model
`docs/EVALUATION.md` SHALL carry a one-line note that the demo dream-team builder is a display heuristic, not part of the evaluated model.

#### Scenario: Demo heuristic is noted in EVALUATION
- **WHEN** a reader reads `docs/EVALUATION.md`
- **THEN** a one-line note states the demo squad is selected by a simple season-aware heuristic (ep_next / last-season points) and is not an evaluated/backtested component

### Requirement: Docs remain valid
The updated docs SHALL keep valid internal links/anchors, render their mermaid diagrams, and reference only image files that exist.

#### Scenario: No broken references
- **WHEN** the updated README and ARCHITECTURE are reviewed
- **THEN** every internal link/anchor resolves, mermaid diagrams parse, and each referenced image exists in `docs/images/`
