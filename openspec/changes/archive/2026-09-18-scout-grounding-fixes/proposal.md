# Scout grounding fixes — accent-insensitive names, honest misses, squad-aware search

## Why

Two failures from GW4 chat usage (2026-09-12 screenshots), both in the Scout's grounding layer rather than its judgment:

1. **"Odegaard" did not resolve.** `resolvePlayer` (`lib/scout/context.ts`) lowercases both sides and compares; it never folds diacritics, so `odegaard` cannot match `Ødegaard`, `gross` cannot match `Groß`, `joao pedro` cannot match `João Pedro`. Worse, when the tool returned "no player found", the model told the manager Ødegaard "may be injured/unavailable in the data" — an invented explanation for an empty result. The prompt forbids inventing numbers; it says nothing about inventing reasons.
2. **A transfer target the manager already owns.** Asked for a Wissa replacement within budget, the Scout listed João Pedro — on the manager's bench — as an option, then reconciled the contradiction by turning a transfer question into a lineup change. `search_players` (`lib/scout/tools.ts`) searches every player in the game, never excludes the squad, and its result rows carry no owned-or-not field; the model has to remember on its own that a transfer target cannot be a player already owned.

## What Changes

- **Name folding.** A pure `foldName()` helper: Unicode NFD + strip combining marks, plus a small fold table for letters decomposition cannot reach (`ø→o`, `æ→ae`, `ß→ss`, `œ→oe`, `ð→d`, `þ→th`, `ł→l`, `đ→d`), then lowercase and collapse punctuation/whitespace. `resolvePlayer` matches folded query against folded `webName` **and** folded `fullName` (exact, then prefix, then substring; ties → higher `totalPoints`), so `odegaard`, `martin odegaard`, `gross`, `joao pedro`, `sangare` all resolve.
- **Honest misses.** Every tool that resolves a name (`score_player`, `compare_players`, `simulate_transfer`, `simulate_captain`) returns a structured `{ notFound: true, query, suggestions: [...] }` (up to five nearest names by folded prefix/substring) instead of a bare error string. The system prompt gains a rule: a not-found result means the spelling did not match — say so, offer the suggestions, ask for the name; never infer injury, absence, transfer or unavailability from a miss.
- **Squad-aware results.** Every player row the tools return (`fmtPlayer`) carries `owned: "xi" | "bench" | null`. `search_players` gains `excludeOwned` (default **true**) and states in its description that it finds **transfer targets**; when the manager asks about a player they own, the model uses `get_squad`/`score_player`, not search. The system prompt gains: a transfer target is never a player already owned; if an owned player is the better answer, say it is a lineup call, not a transfer, and never count their price against a transfer budget.
- **Tests** for folding (the four names above plus ASCII names unchanged), resolution precedence, not-found payload, `owned` tagging, and `excludeOwned`.
- No change to scoring, the pipeline, or any deterministic recommendation; the demo chat inherits the same rules (no squad ⇒ `owned` is always null and `excludeOwned` is a no-op).

## Capabilities

### New Capabilities
- `player-name-resolution`: player lookup by name is accent- and case-insensitive across web name and full name, and a miss is reported as a structured not-found with suggestions, never explained away.
- `scout-squad-awareness`: every player the Scout's tools return is tagged with squad membership, transfer-target search excludes owned players by default, and the Scout never presents an owned player as a transfer target.

### Modified Capabilities
<!-- None under openspec/specs/. Touches the archived team-news-grounding / scout changes only at the prompt level. -->

## Impact

- `lib/scout/context.ts` (`foldName`, `resolvePlayer`, suggestions), `lib/scout/tools.ts` (`fmtPlayer` gains `owned`; not-found payloads; `search_players` `excludeOwned` + description), `lib/scout/system-prompt.ts` (two grounding rules, manager and demo prompts), tests under `lib/__tests__/scout/`.
- No API/UI/config change. Behaviour visible only in chat answers.
