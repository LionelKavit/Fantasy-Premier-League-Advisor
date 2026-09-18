import type { Player, ElementSummary } from "../types";
import type { ScoredPlayer, LlmContextSignals, TrendSignals } from "../pipeline/types";
import type { AnalysisContext } from "../plan/types";
import { getCachedAnalysisContext, getCachedDemoContext } from "../plan/context";
import { computeStatisticalSignals } from "../pipeline/statistical-scoring";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeMarketSignals } from "../pipeline/market-dynamics";
import { computeCompositeScore } from "../pipeline/composite-scorer";
import { scorePlayerLite, NEUTRAL_LLM_SIGNALS } from "../pipeline/lite-scoring";
import { computeTrendSignals } from "../pipeline/trend-analyzer";
import { batchComputeLlmContext } from "../pipeline/llm-context";
import { fetchElementSummary } from "../fpl-api";
import { llm } from "../llm/client";

// Request-shared grounding for the scout tools: the once-computed analysis plus
// the indexes the tools need to resolve and score any FPL player cheaply.
export interface ScoutContext {
  ctx: AnalysisContext;
  playersById: Map<number, Player>;
  scoredById: Map<number, ScoredPlayer>; // pre-scored squad + weak-spot targets
  // Squad membership by element id (scout-squad-awareness): every player row the tools
  // return is tagged from this, and transfer-target search excludes it by default.
  ownedById: Map<number, "xi" | "bench">;
  maxEpNext: number;
  // Lazy enrichment caches (populated on demand by `scorePlayerEnriched`).
  enrichedById: Map<number, ScoredPlayer>;
  summaryById: Map<number, ElementSummary>;
}

interface CacheEntry {
  promise: Promise<ScoutContext>;
  gw: number;
  ts: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, CacheEntry>();

export function buildScoutContext(ctx: AnalysisContext): ScoutContext {
  const playersById = new Map(ctx.players.map((p) => [p.id, p]));

  // Reuse the pipeline's full scores (with trend + LLM context) wherever they
  // already exist — the squad and each weak spot's evaluated targets.
  const scoredById = new Map<number, ScoredPlayer>();
  for (const sp of ctx.analysis.rankedSquad) scoredById.set(sp.player.id, sp);
  for (const ws of ctx.analysis.weakSpots) {
    for (const t of ws.targets) scoredById.set(t.candidate.player.id, t.candidate);
  }

  const maxEpNext = ctx.players.reduce((max, p) => Math.max(max, p.epNext ?? 0), 1);

  const ownedById = new Map<number, "xi" | "bench">();
  for (const pick of ctx.analysis.picks) ownedById.set(pick.element, pick.position <= 11 ? "xi" : "bench");

  return {
    ctx,
    playersById,
    scoredById,
    ownedById,
    maxEpNext,
    enrichedById: new Map(),
    summaryById: new Map(),
  };
}

/**
 * Build (and cache, per manager + gameweek) the grounding context the scout
 * tools share. The squad analysis is expensive, so a short TTL avoids rebuilding
 * it for every chat turn while staying fresh across gameweeks.
 */
export async function getScoutContext(teamId: number): Promise<ScoutContext> {
  const hit = cache.get(teamId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.promise;
  }

  // Builds on the shared context cache so the squad analysis is computed once
  // and reused across the plan phases and the chat.
  const promise = getCachedAnalysisContext(teamId).then(buildScoutContext);
  cache.set(teamId, { promise, gw: 0, ts: Date.now() });

  try {
    const sc = await promise;
    cache.set(teamId, { promise, gw: sc.ctx.analysis.currentGw, ts: Date.now() });
    return sc;
  } catch (e) {
    cache.delete(teamId); // don't cache failures
    throw e;
  }
}

// Demo chat grounding: the same ScoutContext, built on the manager-less demo
// context. One cache entry (the demo team is bootstrap-derived) — never keyed by
// a real teamId.
let demoScoutCache: { promise: Promise<ScoutContext>; ts: number } | null = null;

export async function getDemoScoutContext(): Promise<ScoutContext> {
  if (demoScoutCache && Date.now() - demoScoutCache.ts < CACHE_TTL_MS) {
    return demoScoutCache.promise;
  }
  const promise = getCachedDemoContext().then(buildScoutContext);
  demoScoutCache = { promise, ts: Date.now() };
  try {
    return await promise;
  } catch (e) {
    demoScoutCache = null; // don't cache failures
    throw e;
  }
}

/**
 * Score any FPL player against the cached context. Squad members and evaluated
 * transfer targets reuse their full pipeline score; everyone else gets a
 * lightweight score (statistical + fixture + market, neutral trend/LLM) so the
 * chat never triggers extra network fetches.
 */
export function scorePlayer(player: Player, sc: ScoutContext): ScoredPlayer {
  const cached = sc.scoredById.get(player.id);
  if (cached) return cached;
  return scorePlayerLite(player, {
    fixtures: sc.ctx.fixtures,
    teams: sc.ctx.teams,
    currentGw: sc.ctx.analysis.currentGw,
    maxEpNext: sc.maxEpNext,
  });
}

/**
 * Full-fidelity score for a single named player, computed lazily and cached on
 * the context. Beyond the lightweight signals it adds:
 *  - **trend** — a per-player `fetchElementSummary` (gameweek history) → recent
 *    xG/form momentum;
 *  - **LLM context** — a single-player `batchComputeLlmContext` pass (rotation,
 *    injury severity, set-piece role, …), only when an API key is configured.
 * Squad members and evaluated targets already carry their full pipeline score,
 * so they short-circuit. Used by the targeted tools (`score_player`,
 * `compare_players`, `simulate_*`); `search_players` stays lightweight.
 */
export async function scorePlayerEnriched(
  player: Player,
  sc: ScoutContext
): Promise<ScoredPlayer> {
  const full = sc.scoredById.get(player.id);
  if (full) return full; // squad / evaluated target — already full fidelity

  const cached = sc.enrichedById.get(player.id);
  if (cached) return cached;

  const currentGw = sc.ctx.analysis.currentGw;
  const stats = computeStatisticalSignals(player, currentGw);
  const fixtureSignals = computeFixtureSignals(player, sc.ctx.fixtures, sc.ctx.teams, currentGw);
  const marketSignals = computeMarketSignals(player, sc.maxEpNext);

  // Lazy element-summary fetch → trend signals (per-player, cached, 1h FPL cache).
  let trendSignals: TrendSignals | null = null;
  try {
    let summary = sc.summaryById.get(player.id);
    if (!summary) {
      summary = await fetchElementSummary(player.id);
      sc.summaryById.set(player.id, summary);
    }
    trendSignals = computeTrendSignals(summary.history, summary.history_past);
  } catch {
    trendSignals = null; // degrade to lightweight on any fetch/parse failure
  }

  // Single-player LLM context pass — skipped entirely without a key (the batch
  // helper would just return neutral defaults, so don't pay the call).
  let llmSignals: LlmContextSignals = { ...NEUTRAL_LLM_SIGNALS };
  if (llm.hasApiKey()) {
    try {
      const map = await batchComputeLlmContext([player], [], sc.ctx.players);
      llmSignals = map.get(player.id) ?? { ...NEUTRAL_LLM_SIGNALS };
    } catch {
      llmSignals = { ...NEUTRAL_LLM_SIGNALS };
    }
  }

  const score = computeCompositeScore(
    stats,
    trendSignals,
    fixtureSignals,
    marketSignals,
    llmSignals,
    player.position,
    player.minutes
  );

  // "enriched" names the attempt: trend and/or LLM may have degraded to neutral above,
  // which stays visible as `trendSignals === null` / neutral `llmSignals`.
  const scored: ScoredPlayer = {
    player,
    score,
    fidelity: "enriched",
    statisticalSignals: stats,
    fixtureSignals,
    trendSignals,
    marketSignals,
    llmSignals,
  };
  sc.enrichedById.set(player.id, scored);
  return scored;
}

// ── Name folding (player-name-resolution) ────────────────────────────────────
// Unicode NFD strips accents (João → joao, Sangaré → sangare) but NOT the letters that
// are distinct code points rather than base + mark — Ø, ß, æ, œ, ð, þ, ł, đ — so those
// get an explicit table. Eight letters cover every current Premier League name; keep the
// table auditable rather than pulling a transliteration dependency.
const FOLD_TABLE: Record<string, string> = {
  ø: "o", æ: "ae", ß: "ss", œ: "oe", ð: "d", þ: "th", ł: "l", đ: "d",
};

/** Accent-, case- and punctuation-insensitive form of a name, for matching only. */
export function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[øæßœðþłđ]/g, (ch) => FOLD_TABLE[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const byPoints = (a: Player, b: Player) => b.totalPoints - a.totalPoints;

/**
 * Resolve a player by numeric id, or by name — accent/case-insensitive across the web
 * name AND the full name ("odegaard", "martin odegaard", "gross", "joao pedro" all
 * resolve). Precedence: exact web name → exact full name → prefix on either → substring
 * on either; ties go to the higher season total so `saka` is Saka, not a substring elsewhere.
 */
export function resolvePlayer(query: string | number, sc: ScoutContext): Player | null {
  if (typeof query === "number") return sc.playersById.get(query) ?? null;

  const trimmed = query.trim();
  const asId = Number(trimmed);
  if (Number.isInteger(asId) && sc.playersById.has(asId)) {
    return sc.playersById.get(asId)!;
  }

  const q = foldName(trimmed);
  if (!q) return null;
  const players = sc.ctx.players;
  const web = (p: Player) => foldName(p.webName);
  const full = (p: Player) => foldName(p.fullName);

  const pick = (pred: (p: Player) => boolean): Player | null => {
    const hits = players.filter(pred);
    return hits.length ? [...hits].sort(byPoints)[0] : null;
  };
  return (
    pick((p) => web(p) === q) ??
    pick((p) => full(p) === q) ??
    pick((p) => web(p).startsWith(q) || full(p).startsWith(q)) ??
    pick((p) => web(p).includes(q) || full(p).includes(q))
  );
}

/**
 * Near-miss names for a query that did not resolve — folded prefix/substring matches on
 * either name, highest season total first — so a not-found result can offer spellings
 * instead of leaving the model to guess why the lookup failed.
 */
export function suggestPlayers(query: string, sc: ScoutContext, limit = 5): string[] {
  const q = foldName(query);
  if (!q) return [];
  // Also try each token alone ("odegard martin" / "m odegaard"), then a 4-letter stem of
  // each token so a plain typo ("odegard" → "odeg…") still surfaces the likely player.
  const tokens = q.split(" ").filter((t) => t.length >= 3);
  const stems = tokens.filter((t) => t.length >= 4).map((t) => t.slice(0, 4));
  const wordsOf = (p: Player) => `${foldName(p.webName)} ${foldName(p.fullName)}`.split(" ");
  const hit = (p: Player) => {
    const w = foldName(p.webName);
    const f = foldName(p.fullName);
    return (
      w.includes(q) || f.includes(q) ||
      tokens.some((t) => w.includes(t) || f.includes(t)) ||
      stems.some((s) => wordsOf(p).some((word) => word.startsWith(s)))
    );
  };
  return [...sc.ctx.players.filter(hit)].sort(byPoints).slice(0, limit).map((p) => p.webName);
}

/** Test-only: clear the per-manager context cache. */
export function _clearScoutCache(): void {
  cache.clear();
}
