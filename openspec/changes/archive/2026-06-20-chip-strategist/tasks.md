## Tasks — chip strategist (scope B: narrative grounding)

### Task 1: Knowledge loader + chips.md
**Capability:** chip-strategy
- `lib/knowledge/index.ts`: `loadKnowledge(name)` — read `lib/knowledge/<name>.md` once, cache the string in-process (server-side `readFileSync`); embedded-string fallback if `next build` drops the file.
- `lib/knowledge/chips.md`: curated principles from the sources — the 2025/26 two-halves rule (8 chips, GW19 first-set expiry, GW20 second set, one chip/GW), canonical per-half timing (WC before the swing, BB on a DGW, FH on a blank, TC on a premium's DGW), and the FFScout "roughly-right-beats-perfect" + sequencing/hit-stacking/second-WC judgment. Dated facts in a labelled "season-specific" section.

### Task 2: Ground the long-term narrative
**Capability:** chip-strategy
- `lib/optimizer/long-term-synthesis.ts`: load `chips.md` and inject it into `buildLongTermPrompt` as expert-principle context; keep the deterministic facts as the case data. No change to `chipPlan`/ChipTimeline.

### Task 3: Verify
**Capability:** chip-strategy
- Unit: loader reads + caches `chips.md`; the long-term prompt contains a known principle marker.
- Qualitative smoke (live key): narrative references the two-halves/GW19 rule + per-half timing, not generic advice.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`); `longTermNarrative` still produced; ChipTimeline unchanged (deterministic).

### Decide
- [x] Scope: **B** (narrative-only); deterministic ChipTimeline untouched.
- [x] Loader form: **markdown file via `readFileSync`** (`process.cwd()/lib/knowledge/<name>.md`) — confirmed it resolves under `next build` and from a tsx runtime; embedded-string fallback not needed (graceful "" on read failure).

---

## As-built outcome (run 2026-06-20)

**Implemented (scope B, narrative-only):**
- `lib/knowledge/index.ts` — cached `loadKnowledge(name)` (server `readFileSync`; returns "" and never throws if absent — grounding is strictly additive).
- `lib/knowledge/chips.md` — curated principles from the cited sources: the 2025/26 two-halves rule (8 chips, GW19 first-set expiry, GW20 second set, one chip/GW), canonical per-half timing, and the FFScout roughly-right / sequencing / don't-hoard judgment, with dated facts in a labelled season-specific section.
- `lib/optimizer/long-term-synthesis.ts` — injects `chips.md` into `buildLongTermPrompt` as expert-principle context; `chipPlan`/ChipTimeline untouched (deterministic).

**Verified:**
- Unit (4 new): loader reads + caches `chips.md`, returns "" for a missing file, and the long-term prompt embeds the principles. Full suite **199 pass**.
- **Qualitative smoke (live)**: the grounded narrative correctly cited *"GW19 is the hard expiry for all first-half chips,"* use-it-or-lose-it Wildcard, Free-Hit-the-blank, the per-half WC→BB→TC sequence, and the don't-hoard judgment — expert-level, not generic.
- `tsc` / `eslint` 0 / `next build` clean; `chips.md` resolves at runtime.

**Incidental fix (test isolation):** the e2e `flow.test.ts` was hitting the live AllAboutFPL fetch via the pipeline's `getCachedTeamNews` (introduced by `team-news-grounding`), causing a flaky timeout. Added a `vi.mock("../../news/team-news")` stub so e2e stays offline/fast/deterministic.
