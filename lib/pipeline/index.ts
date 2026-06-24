import type { Player, ElementSummary } from "../types";
import type { ScoredPlayer, SquadAnalysisResult, LlmContextSignals } from "./types";
import { PIPELINE_CONFIG } from "../config";
import {
  fetchBootstrap,
  fetchFixtures,
  fetchPicks,
  fetchElementSummary,
  fetchSetPieceNotes,
  buildManagerProfile,
} from "../fpl-api";
import { computeStatisticalSignals } from "./statistical-scoring";
import { computeTrendSignals } from "./trend-analyzer";
import { computeFixtureSignals } from "./fixture-analyzer";
import { computeMarketSignals } from "./market-dynamics";
import { batchComputeLlmContext } from "./llm-context";
import { getCachedTeamNews } from "../news/team-news";
import { computeCompositeScore } from "./composite-scorer";
import { rankSquad, identifyWeakSpots, findCandidates } from "./squad-ranker";

export async function runSquadAnalysisPipeline(
  teamId: number
): Promise<SquadAnalysisResult> {
  // Step 1: Parallel data fetch
  const [bootstrap, fixtures] = await Promise.all([
    fetchBootstrap(),
    fetchFixtures(),
  ]);

  const managerProfile = await buildManagerProfile(teamId, bootstrap);

  const currentGw = bootstrap.currentGameweek?.id ?? 1;
  const deadline = bootstrap.currentGameweek?.deadline_time ?? null;
  const { players, teams } = bootstrap;

  // Step 2: Get current squad picks
  const picksResponse = await fetchPicks(teamId, currentGw);
  const squadPlayerIds = picksResponse.picks.map((p) => p.element);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const squadPlayers = squadPlayerIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => p !== undefined);

  // Step 3: Build candidate pool — top players per position by PPG
  const candidatePool = buildCandidatePool(players, squadPlayerIds);

  // Step 4: Fetch element summaries in parallel for squad + candidates
  const allPlayerIds = [
    ...squadPlayerIds,
    ...candidatePool.map((p) => p.id),
  ];
  const uniqueIds = [...new Set(allPlayerIds)];

  const elementSummaries = new Map<number, ElementSummary>();
  const summaryResults = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const summary = await fetchElementSummary(id);
        return { id, summary };
      } catch {
        return { id, summary: null };
      }
    })
  );
  for (const { id, summary } of summaryResults) {
    if (summary) elementSummaries.set(id, summary);
  }

  // Step 5: Fetch set piece notes
  const setPieceNotes = await fetchSetPieceNotes().catch(() => []);

  // Step 6: Compute max EP for market signal normalization
  const maxEpNext = players.reduce((max, p) => {
    const ep = p.epNext ?? 0;
    return ep > max ? ep : max;
  }, 1);

  const allSquadAndCandidates = [...squadPlayers, ...candidatePool];

  // Step 7: LLM context (batched), grounded in real team news (team-news-grounding).
  // News fetch degrades to undefined on any failure — strictly additive.
  const teamNews = await getCachedTeamNews(currentGw, players, teams);
  const llmResults = await batchComputeLlmContext(
    allSquadAndCandidates,
    setPieceNotes,
    players,
    teamNews
  );

  // Step 8: Score squad players
  const scoredSquad: ScoredPlayer[] = squadPlayers.map((player) => {
    const stats = computeStatisticalSignals(player, currentGw, elementSummaries.get(player.id));
    const fixtureSigs = computeFixtureSignals(player, fixtures, teams, currentGw);
    const market = computeMarketSignals(player, maxEpNext);

    const es = elementSummaries.get(player.id);
    const trendSigs = es
      ? computeTrendSignals(es.history, es.history_past)
      : null;

    const llm = llmResults.get(player.id) ?? {
      rotationRisk: 0,
      oopBonus: 0,
      injurySeverity: 0,
      tacticalBoost: 0,
      opponentKeyAbsence: 0,
      setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
    };

    const score = computeCompositeScore(
      stats, trendSigs, fixtureSigs, market, llm,
      player.position, player.minutes
    );

    return {
      player,
      score,
      statisticalSignals: stats,
      fixtureSignals: fixtureSigs,
      trendSignals: trendSigs,
      marketSignals: market,
      llmSignals: llm,
    };
  });

  // Step 9: Rank and identify weaknesses
  const ranked = rankSquad(scoredSquad);
  const weakSpots = identifyWeakSpots(ranked);

  // Step 10: Find replacement candidates for each weak spot
  const scoredCache = new Map<number, ScoredPlayer>();
  for (const sp of scoredSquad) scoredCache.set(sp.player.id, sp);

  const teamCounts = new Map<number, number>();
  for (const p of squadPlayers) {
    teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1);
  }

  const bank = picksResponse.entry_history.bank;

  for (const ws of weakSpots) {
    ws.targets = findCandidates(
      ws.player,
      candidatePool,
      bank,
      teamCounts,
      scoredCache,
      fixtures,
      teams,
      currentGw,
      elementSummaries,
      llmResults,
      maxEpNext
    );
  }

  return {
    rankedSquad: ranked,
    weakSpots,
    picks: picksResponse.picks,
    chipsRemaining: managerProfile.chipsRemaining,
    bank,
    currentGw,
    deadline,
    generatedAt: new Date().toISOString(),
  };
}

function buildCandidatePool(
  allPlayers: Player[],
  squadPlayerIds: number[]
): Player[] {
  const squadSet = new Set(squadPlayerIds);
  const positions = ["GK", "DEF", "MID", "FWD"] as const;
  const pool: Player[] = [];

  for (const pos of positions) {
    const eligible = allPlayers
      .filter(
        (p) =>
          p.position === pos &&
          !squadSet.has(p.id) &&
          p.availability.status !== "unavailable" &&
          p.minutes > 0
      )
      .sort((a, b) => b.pointsPerGame - a.pointsPerGame)
      .slice(0, PIPELINE_CONFIG.candidatePoolPerPosition);

    pool.push(...eligible);
  }

  return pool;
}
