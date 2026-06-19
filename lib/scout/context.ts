import type { Player, ElementSummary } from "../types";
import type { ScoredPlayer, LlmContextSignals, TrendSignals } from "../pipeline/types";
import type { AnalysisContext } from "../plan/types";
import { getCachedAnalysisContext } from "../plan/context";
import { computeStatisticalSignals } from "../pipeline/statistical-scoring";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeMarketSignals } from "../pipeline/market-dynamics";
import { computeCompositeScore } from "../pipeline/composite-scorer";
import { scorePlayerLite } from "../pipeline/lite-scoring";
import { computeTrendSignals } from "../pipeline/trend-analyzer";
import { batchComputeLlmContext } from "../pipeline/llm-context";
import { fetchElementSummary } from "../fpl-api";
import { llm } from "../llm/client";

// Neutral LLM signals — arbitrary (non-squad) players are scored without the
// batched LLM context pass, so the chat stays a single deterministic build.
const DEFAULT_LLM_SIGNALS: LlmContextSignals = {
  rotationRisk: 0,
  oopBonus: 0,
  injurySeverity: 0,
  tacticalBoost: 0,
  opponentKeyAbsence: 0,
  setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
};

// Request-shared grounding for the scout tools: the once-computed analysis plus
// the indexes the tools need to resolve and score any FPL player cheaply.
export interface ScoutContext {
  ctx: AnalysisContext;
  playersById: Map<number, Player>;
  scoredById: Map<number, ScoredPlayer>; // pre-scored squad + weak-spot targets
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
  for (const ws of ctx.analysis.weakest3) {
    for (const t of ws.targets) scoredById.set(t.candidate.player.id, t.candidate);
  }

  const maxEpNext = ctx.players.reduce((max, p) => Math.max(max, p.epNext ?? 0), 1);

  return {
    ctx,
    playersById,
    scoredById,
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
  let llmSignals: LlmContextSignals = { ...DEFAULT_LLM_SIGNALS };
  if (llm.hasApiKey()) {
    try {
      const map = await batchComputeLlmContext([player], [], sc.ctx.players);
      llmSignals = map.get(player.id) ?? { ...DEFAULT_LLM_SIGNALS };
    } catch {
      llmSignals = { ...DEFAULT_LLM_SIGNALS };
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

  const scored: ScoredPlayer = {
    player,
    score,
    statisticalSignals: stats,
    fixtureSignals,
    trendSignals,
    marketSignals,
    llmSignals,
  };
  sc.enrichedById.set(player.id, scored);
  return scored;
}

/** Resolve a player by numeric id or case-insensitive web-name match. */
export function resolvePlayer(query: string | number, sc: ScoutContext): Player | null {
  if (typeof query === "number") return sc.playersById.get(query) ?? null;

  const trimmed = query.trim();
  const asId = Number(trimmed);
  if (Number.isInteger(asId) && sc.playersById.has(asId)) {
    return sc.playersById.get(asId)!;
  }

  const lower = trimmed.toLowerCase();
  const players = sc.ctx.players;
  const exact = players.find((p) => p.webName.toLowerCase() === lower);
  if (exact) return exact;

  const matches = players.filter((p) => p.webName.toLowerCase().includes(lower));
  // Unambiguous prefix/substring match → resolve; otherwise prefer the
  // higher-scoring (more relevant) player to avoid dead ends.
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return [...matches].sort((a, b) => b.totalPoints - a.totalPoints)[0];
  }
  return null;
}

/** Test-only: clear the per-manager context cache. */
export function _clearScoutCache(): void {
  cache.clear();
}
