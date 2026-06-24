import type { AnalysisContext } from "./types";
import type { Player, ManagerProfile } from "../types";
import type { ScoredPlayer, SquadAnalysisResult } from "../pipeline/types";
import { fetchBootstrap, fetchFixtures, fetchPicks, buildManagerProfile } from "../fpl-api";
import { runSquadAnalysisPipeline } from "../pipeline";
import { rankSquad, identifyWeakSpots } from "../pipeline/squad-ranker";
import { scorePlayerLite } from "../pipeline/lite-scoring";
import { detectGameweekFlags } from "../gameweek";
import { buildDemoSquad, deriveDemoSeason } from "../demo/squad";

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
  const deadline = bootstrap.currentGameweek?.deadline_time ?? null;
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
  const weakSpots = identifyWeakSpots(rankedSquad); // weak players only; targets stay empty

  const analysis: SquadAnalysisResult = {
    rankedSquad,
    weakSpots,
    picks: picksResponse.picks,
    chipsRemaining: managerProfile.chipsRemaining,
    bank: picksResponse.entry_history.bank,
    currentGw,
    deadline,
    generatedAt: new Date().toISOString(),
  };

  return { analysis, managerProfile, players, teams, fixtures, gwFlags: [] };
}

// ── Demo context (no manager) ────────────────────────────────────────────────
// Build a full AnalysisContext around a synthesized "dream team" so the pitch,
// ratings, captain pipeline, and Scout chat run unchanged for an ID-less visitor.
// Mirrors buildLiteBaseContext (lite-scored squad, weak spots, no candidate pool),
// but the squad comes from buildDemoSquad and the manager profile is stubbed.
export async function buildDemoContext(): Promise<AnalysisContext> {
  const [bootstrap, fixtures] = await Promise.all([fetchBootstrap(), fetchFixtures()]);
  const currentGw = bootstrap.currentGameweek?.id ?? 1;
  const deadline = bootstrap.currentGameweek?.deadline_time ?? null;
  const { players, teams } = bootstrap;

  const season = deriveDemoSeason(bootstrap.gameweeks);
  const { picks } = buildDemoSquad(players, season);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const squadPlayers = picks.picks
    .map((pick) => playerMap.get(pick.element))
    .filter((p): p is Player => p !== undefined);

  const maxEpNext = players.reduce((max, p) => Math.max(max, p.epNext ?? 0), 1);
  const scored: ScoredPlayer[] = squadPlayers.map((p) =>
    scorePlayerLite(p, { fixtures, teams, currentGw, maxEpNext })
  );

  const rankedSquad = rankSquad(scored);
  const weakSpots = identifyWeakSpots(rankedSquad); // weak spots only; no transfer targets

  const analysis: SquadAnalysisResult = {
    rankedSquad,
    weakSpots,
    picks: picks.picks,
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    bank: picks.entry_history.bank,
    currentGw,
    deadline,
    generatedAt: new Date().toISOString(),
  };

  const gwFlags = detectGameweekFlags(fixtures, currentGw, teams.map((t) => t.id));
  return {
    analysis,
    managerProfile: buildDemoManagerProfile(currentGw, bootstrap.gameweeks.length),
    players,
    teams,
    fixtures,
    gwFlags,
    demoSeason: season,
  };
}

// A neutral, manager-less profile: no rank, no held chips, no history. Keeps the
// captain pipeline's rank-aware logic on its balanced default (see synthesis.ts,
// which also takes a `demo` flag to drop rank references from the prose).
function buildDemoManagerProfile(currentGw: number, totalGameweeks: number): ManagerProfile {
  return {
    entry: {
      id: 0,
      playerFirstName: "",
      playerLastName: "",
      name: "Demo Squad",
      summaryOverallPoints: 0,
      summaryOverallRank: null,
      currentEvent: currentGw,
      bank: 0,
      squadValue: 100,
    },
    history: { current: [], chips: [], past: [] },
    chipsRemaining: { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 },
    riskProfile: {
      currentRank: 0,
      bestRank: 0,
      rankTrend: "stable",
      gwsRemaining: Math.max(0, totalGameweeks - currentGw),
      totalHitsTaken: 0,
      totalHitCost: 0,
      avgBenchPoints: 0,
    },
    transferPatterns: {
      totalTransfers: 0,
      kneeJerkRate: 0,
      netValueChange: 0,
      positionBias: { GKP: 0, DEF: 0, MID: 0, FWD: 0 },
      avgHoldDuration: 0,
      transfers: [],
    },
  };
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

// The demo context is a single bootstrap-derived team, so one cache entry serves
// everyone. Kept separate from the per-manager map so it can never collide with
// a real `teamId` (notably teamId 0).
let demoContextCache: { promise: Promise<AnalysisContext>; ts: number } | null = null;

export async function getCachedDemoContext(): Promise<AnalysisContext> {
  if (demoContextCache && Date.now() - demoContextCache.ts < CONTEXT_TTL_MS) {
    return demoContextCache.promise;
  }
  const promise = buildDemoContext();
  demoContextCache = { promise, ts: Date.now() };
  try {
    return await promise;
  } catch (e) {
    demoContextCache = null; // don't cache failures
    throw e;
  }
}

/** Test-only: clear the whole context cache. */
export function _clearContextCache(): void {
  contextCache.clear();
  demoContextCache = null;
}
