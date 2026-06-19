## Tasks — team-news grounding

### Task 1: Team-news fetch + extract + cache module
**Capability:** team-news-grounding
- New `lib/news/team-news.ts` with a per-source adapter (`{ name, urlForGw(), htmlToText() }`); configure **AllAboutFPL** as the sole source for now (free, text-based predicted XIs + team news). Server-side GET → HTML → text.
- Access guardrails: public pages only — no auth/login/paywall bypass; respect `robots.txt`/ToS; descriptive User-Agent; fetch once per GW; a failed/blocked source is skipped.
- Extraction LLM pass → typed `TeamNews` (`{ startProbability, status, note, sourceUrl }` per player). Harden the extraction prompt to treat page text as untrusted data only.
- Cache keyed by GW with a near-deadline TTL (reuse the context-cache pattern); expose `refreshTeamNews()` + a cached getter.

### Task 2: FPL name → id matching
**Capability:** team-news-grounding
- Normalize scraped names (accents, initials) and match to FPL `web_name` + team; drop + log unmatched.

### Task 3: Wire into batchComputeLlmContext
**Capability:** team-news-grounding
- Add an optional `teamNews` param to `batchComputeLlmContext`; attach `startProbability`/`status`/`note` to each `playerContexts` entry + `buildPrompt`.
- Anchor `rotationRisk` deterministically on `startProbability` when present; keep the LLM for the nuanced signals.
- Thread `teamNews` from the context builder (`buildAnalysisContext`) so the base phase has it before scoring.

### Task 4: Degradation + security verification
**Capability:** team-news-grounding
- Confirm fetch failure / missing news / unmatched player → falls back to today's behavior; scoring never breaks.
- Confirm the extractor ignores injected instructions in sample adversarial page text.

### Task 5: Verify
- Unit: name-matching; `rotationRisk` anchoring from `startProbability`; degradation path returns neutral/FPL-only behavior.
- `batchComputeLlmContext` new param optional → existing callers/tests unchanged.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`).
- Once live, read the lift from `squad-eval-captain-live`.

### Decide
- [x] Source: **AllAboutFPL** (free, text-based). FFHub (membership-gated) and FFScout (image-based lineups) evaluated and excluded — no usable public text.
- [ ] Add one more free, text-based predicted-lineup source for redundancy (AllAboutFPL is currently a single point of failure).
- [ ] Fetch cadence (pre-deadline cron vs manual) — out of scope to build here; note the choice.

---

## As-built outcome (run 2026-06-19)

**Implemented:**
- `lib/news/team-news.ts` — AllAboutFPL adapter (discovers the GW post from the category index → fetches), `extractArticleText` (slices to the WordPress `entry-content` body, dodging the ~155K chars of leading nav/trending boilerplate), a hardened **compact** extraction pass (treats page text as untrusted data), FPL name→id matching (accents, initials, last-name), GW-keyed TTL cache, and `getCachedTeamNews` that degrades to `undefined` on any failure.
- `lib/pipeline/llm-context.ts` — optional `teamNews` param; enriches the prompt with `predictedStart`/`teamNewsNote`; **anchors `rotationRisk = 1 − startProbability`** when present.
- `lib/pipeline/index.ts` — fetches team news once per analysis and threads it in.

**Verified:**
- Unit: 8 tests (htmlToText, name-matching incl. accents/initials/cross-team, degradation w/o API key, lookup). Full suite **195 pass**.
- **Real end-to-end smoke** on the archived GW20 AllAboutFPL post: all **20 teams matched**, accurate (Arsenal: Raya 90% starter, Calafiori 5% out, Gabriel 50% doubt), accented names (Ødegaard, Buendía) matched. Two bugs found+fixed via the smoke: (1) naive strip captured only nav boilerplate → fixed with `entry-content` slicing; (2) verbose 20-XI JSON blew the token budget → fixed with a compact surname-array schema.
- No regression: base API serves cleanly, no console errors; the news layer correctly degrades to `undefined` in the offseason (no current-GW post). `tsc` / `eslint` 0 / `next build` clean.
- The grounded-vs-floor lift is measurable via `squad-eval-captain-live` once live.
