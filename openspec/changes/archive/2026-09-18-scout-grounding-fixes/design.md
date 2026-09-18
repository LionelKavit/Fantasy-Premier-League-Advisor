# Design — scout grounding fixes

## Context

`resolvePlayer(query, sc)` (`lib/scout/context.ts:199`): numeric id → exact lowercase `webName` → substring on lowercase `webName` (single hit resolves; several → highest `totalPoints`). Five call sites in `lib/scout/tools.ts`: `score_player`, `compare_players` (per name), `simulate_transfer` (out + in), `simulate_captain`. Misses return `{ error: "No player found matching …" }` or `{ query, error: "not found" }`. `fmtPlayer` (`tools.ts:81`) is the one formatter every tool uses. `search_players` (`tools.ts:212`) filters `sc.ctx.players` by position/price/team, shortlists 40 by PPG, scores, ranks, returns up to 15 — with no squad awareness. `ScoutContext` already holds `ctx.analysis.picks` (element ids with position 1–15), which is all squad-membership needs. `Player.fullName` exists (`"first second"`, `lib/fpl-api.ts:66`).

Diacritics: NFD decomposition strips marks from `João`, `Sangaré`, `Calafiori`; it does **not** decompose `Ø`, `ß`, `æ`, `œ`, `ð`, `þ`, `ł`, `đ` (verified `"Ødegaard".normalize("NFD")` → `ødegaard`, `"Groß"` → `groß`).

## Goals / Non-Goals

**Goals:**
- Any reasonable ASCII spelling of a Premier League player's web or full name resolves.
- A miss is a structured, honest result with suggestions; the model relays it instead of rationalising it.
- The model can see ownership on every player row and cannot get an owned player from a transfer search unless it asks for one.
- Prompt rules that make both behaviours explicit, in the manager and demo prompts.

**Non-Goals:**
- Fuzzy/typo matching (Levenshtein) — folding + prefix/substring covers the observed failures; typos remain "not found + suggestions", which is the honest answer.
- Changing which players `search_players` can see beyond the owned filter, or its ranking.
- Any change to recommendations, scoring, or the deterministic plan.

## Decisions

**D1 — `foldName` is a pure function in `lib/scout/context.ts` (exported, unit-tested).** NFD → remove `\p{M}` → fold table → lowercase → replace non-alphanumerics with a single space → trim. Applied identically to the query and to both `webName` and `fullName`. *Alternative rejected:* a third-party transliteration library — eight letters cover every current Premier League name and the table is auditable.

**D2 — Resolution precedence: exact folded `webName` → exact folded `fullName` → prefix on either → substring on either; ties by `totalPoints`.** Full-name matching is new: it makes `martin odegaard` and `joao pedro` (full name `João Pedro …`) work and is what a manager types. Precedence keeps `saka` resolving to Saka, not to a substring elsewhere.

**D3 — Not-found is a payload, not an error string.** `{ notFound: true, query, suggestions: string[] }` where suggestions are up to five folded prefix/substring near-misses (by `totalPoints`, so the likely intended player is first). `compare_players` keeps per-name results so one miss does not fail the comparison; `simulate_*` return the payload for whichever side missed. The prompt rule then has something concrete to relay. *Alternative rejected:* keeping `error:` strings — the model treated one as a data statement about the player.

**D4 — `owned` on every row, from `analysis.picks`.** `fmtPlayer` looks up the element in a `Map<id, position>` built once on the `ScoutContext` (`ownedById`); `owned = position <= 11 ? "xi" : "bench"`, else `null`. Demo context: picks exist for the sample squad, but the demo prompt already says there is no manager — `owned` is still populated (it is true of the sample squad) and harmless.

**D5 — `search_players.excludeOwned` defaults to true.** The tool's description becomes "Find TRANSFER TARGETS … excludes the manager's own players unless excludeOwned is false." A manager asking "who's better on my bench" is a `get_squad`/`score_player` question, and the prompt says so. *Alternative rejected:* default false with an `owned` tag only — that is exactly the state that produced the João Pedro answer; the model had the information and still misused it.

**D6 — Two prompt rules, under Grounding, in both manager and demo prompts.** (a) "A `notFound` result means the name did not match the data — say so, list the suggestions, and ask for the spelling. Never infer injury, absence, a transfer or unavailability from a miss." (b) "A transfer target is never a player already owned (`owned` is set). If an owned player is the right answer, say it is a lineup call, not a transfer, and never count their price against a transfer budget."

## Risks / Trade-offs

- [Folding collides two distinct names] → precedence + `totalPoints` tie-break as today; the suggestions list surfaces the alternative. No current squad/pool names collide under the fold table.
- [`excludeOwned` hides a player the manager genuinely asked about] → the prompt routes owned-player questions to `get_squad`/`score_player`; `excludeOwned: false` remains available.
- [Prompt rules add tokens to every chat turn] → two sentences; negligible.

## Migration Plan

Single PR, no data or config change. Rollback is a revert.

## Open Questions

- None blocking. Fuzzy matching (typos) is deliberately out of scope; revisit if misses with suggestions prove common in the chat logs.
