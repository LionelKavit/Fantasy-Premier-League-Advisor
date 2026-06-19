import type { AnalysisContext } from "./types";
import type { Player } from "../types";
import type { ScoredPlayer, SquadAnalysisResult } from "../pipeline/types";
import { fetchBootstrap, fetchFixtures, fetchPicks, buildManagerProfile } from "../fpl-api";
import { runSquadAnalysisPipeline } from "../pipeline";
import { rankSquad, identifyWeakest3 } from "../pipeline/squad-ranker";
import { scorePlayerLite } from "../pipeline/lite-scoring";
import { detectGameweekFlags } from "../gameweek";

// Run the expensive squad analysis (and shared reference fetches) exactly once,
// then hand the result to both sub-pipelines via the returned context.
export async function buildAnalysisContext(
  teamId: number
): Promise<AnalysisContext> {
  const [analysis, bootstrap, fixtures] = await Promise.all([
    runSquadAnalysisPipeline(teamId),
    fetchBootstrap(),
    fetchFixtures(),
  ]);

  const managerProfile = await buildManagerProfile(teamId, bootstrap);
  const gwFlags = detectGameweekFlags(
    fixtures,
    analysis.currentGw,
    bootstrap.teams.map((t) => t.id)
  );

  return {
    analysis,
    managerProfile,
    players: bootstrap.players,
    teams: bootstrap.teams,
    fixtures,
    gwFlags,
  };
}

// Lightweight base context for the pitch: scores ONLY the 15 squad players
// (statistical + fixture + market, neutral trend/LLM) and flags weak spots.
// Deliberately skips the candidate pool, the per-player element-summary fan-out,
// and the batched player-context LLM call — the cold bottleneck the pitch
// doesn't need. Cheap enough to run per load (FPL fetches are cached 1h).
export async function buildLiteBaseContext(teamId: number): Promise<AnalysisContext> {
  const [bootstrap, fixtures] = await Promise.all([fetchBootstrap(), fetchFixtures()]);
  const managerProfile = await buildManagerProfile(teamId, bootstrap);
  const currentGw = bootstrap.currentGameweek?.id ?? 1;
  const { players, teams } = bootstrap;

  const picksResponse = await fetchPicks(teamId, currentGw);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const squadPlayers = picksResponse.picks
    .map((pick) => playerMap.get(pick.element))
    .filter((p): p is Player => p !== undefined);

  const maxEpNext = players.reduce((max, p) => Math.max(max, p.epNext ?? 0), 1);
  const scored: ScoredPlayer[] = squadPlayers.map((p) =>
    scorePlayerLite(p, { fixtures, teams, currentGw, maxEpNext })
  );

  const rankedSquad = rankSquad(scored);
  const weakest3 = identifyWeakest3(rankedSquad); // weak players only; targets stay empty

  const analysis: SquadAnalysisResult = {
    rankedSquad,
    weakest3,
    picks: picksResponse.picks,
    chipsRemaining: managerProfile.chipsRemaining,
    bank: picksResponse.entry_history.bank,
    currentGw,
    generatedAt: new Date().toISOString(),
  };

  return { analysis, managerProfile, players, teams, fixtures, gwFlags: [] };
}

// ── Shared, TTL'd context cache ──────────────────────────────────────────────
// The squad analysis (incl. its batched LLM-context call + many element-summary
// fetches) is the expensive part. Cache it per manager so the plan's base and
// insights phases — and the Scout chat — reuse one build within the TTL.
// In-memory and per-process (per-instance under serverless); that's fine here.
interface ContextCacheEntry {
  promise: Promise<AnalysisContext>;
  gw: number;
  ts: number;
}

const CONTEXT_TTL_MS = 10 * 60 * 1000;
const contextCache = new Map<number, ContextCacheEntry>();

export async function getCachedAnalysisContext(teamId: number): Promise<AnalysisContext> {
  const hit = contextCache.get(teamId);
  if (hit && Date.now() - hit.ts < CONTEXT_TTL_MS) {
    return hit.promise;
  }

  const promise = buildAnalysisContext(teamId);
  // Store the in-flight promise so concurrent callers (base + insights) dedupe.
  contextCache.set(teamId, { promise, gw: 0, ts: Date.now() });

  try {
    const ctx = await promise;
    contextCache.set(teamId, { promise, gw: ctx.analysis.currentGw, ts: Date.now() });
    return ctx;
  } catch (e) {
    contextCache.delete(teamId); // don't cache failures
    throw e;
  }
}

/** Drop the cached context for a manager (e.g. an explicit Re-analyze). */
export function invalidateAnalysisContext(teamId: number): void {
  contextCache.delete(teamId);
}

/** Test-only: clear the whole context cache. */
export function _clearContextCache(): void {
  contextCache.clear();
}
