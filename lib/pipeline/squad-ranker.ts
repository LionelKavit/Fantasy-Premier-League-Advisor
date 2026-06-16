import type { Player, Fixture, Team, ElementSummary } from "../types";
import type {
  ScoredPlayer,
  WeakSpot,
  TransferCandidate,
  LlmContextSignals,
} from "./types";
import { PIPELINE_CONFIG } from "../config";
import { computeStatisticalSignals } from "./statistical-scoring";
import { computeFixtureSignals } from "./fixture-analyzer";
import { computeMarketSignals } from "./market-dynamics";
import { computeTrendSignals } from "./trend-analyzer";
import { computeCompositeScore } from "./composite-scorer";

const DEFAULT_LLM: LlmContextSignals = {
  rotationRisk: 0,
  oopBonus: 0,
  injurySeverity: 0,
  tacticalBoost: 0,
  opponentKeyAbsence: 0,
  setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
};

export function rankSquad(scoredPlayers: ScoredPlayer[]): ScoredPlayer[] {
  return [...scoredPlayers].sort((a, b) => b.score.total - a.score.total);
}

export function identifyWeakest3(rankedSquad: ScoredPlayer[]): WeakSpot[] {
  const weakest = rankedSquad.slice(-3).reverse();
  return weakest.map((sp) => ({
    player: sp,
    whyWeak: generateWeakReasons(sp),
    targets: [],
  }));
}

function generateWeakReasons(sp: ScoredPlayer): string[] {
  const reasons: string[] = [];
  const stats = sp.statisticalSignals;
  const trend = sp.trendSignals;
  const llm = sp.llmSignals;
  const fixture = sp.fixtureSignals;

  if (fixture.gw5AvgFdr >= 3.5) {
    reasons.push(
      `Poor fixture run (FDR avg ${fixture.gw5AvgFdr.toFixed(1)} over next 5 GWs)`
    );
  }

  if (trend?.classification === "SELL") {
    reasons.push("Falling xG trend (SELL signal)");
  } else if (trend?.classification === "SELL_RISK") {
    reasons.push("Overperforming xG — regression risk (SELL_RISK signal)");
  }

  if (llm.rotationRisk > 0.6) {
    reasons.push(`High rotation risk (${llm.rotationRisk.toFixed(2)})`);
  }

  if (llm.injurySeverity > 0.5) {
    const newsText = sp.player.availability.news;
    reasons.push(
      newsText
        ? `Injury concern: ${newsText}`
        : `Injury concern (severity ${llm.injurySeverity.toFixed(2)})`
    );
  }

  if (stats.valueScore < 0.4) {
    reasons.push(`Low value score (${stats.valueScore.toFixed(2)} pts/£m)`);
  }

  if (stats.suspensionRisk > 0.7) {
    const banThreshold = sp.player.yellowCards < 5 ? 5 : 10;
    reasons.push(
      `Suspension risk: ${sp.player.yellowCards} yellow cards (ban at ${banThreshold})`
    );
  }

  if (stats.formSignal < 3.0) {
    reasons.push(
      `Poor recent form (${stats.formSignal.toFixed(1)} PPG over last 4 GWs)`
    );
  }

  if (
    (sp.player.position === "DEF" || sp.player.position === "GK") &&
    stats.xgcRate > 1.5
  ) {
    reasons.push(
      `High expected goals conceded (${stats.xgcRate.toFixed(2)} per 90)`
    );
  }

  if (stats.minutesReliability < 0.5) {
    const chance = sp.player.availability.chanceOfPlayingNext;
    reasons.push(
      `Availability concern: ${chance !== null ? `${chance}%` : "low starts ratio"}`
    );
  }

  if (reasons.length === 0) {
    reasons.push("Low composite score relative to squad");
  }

  return reasons;
}

export function findCandidates(
  weakPlayer: ScoredPlayer,
  allPlayers: Player[],
  budget: number,
  existingTeamIds: Map<number, number>,
  scoredCache: Map<number, ScoredPlayer>,
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number,
  elementSummaries: Map<number, ElementSummary>,
  llmCache: Map<number, LlmContextSignals>,
  maxEpNext: number
): TransferCandidate[] {
  const maxBudget = weakPlayer.player.price + budget;
  const squadPlayerIds = new Set(
    [...scoredCache.keys()]
  );

  const weakTeamId = weakPlayer.player.teamId;
  const teamCounts = new Map(existingTeamIds);

  const candidates = allPlayers.filter((p) => {
    if (p.position !== weakPlayer.player.position) return false;
    if (squadPlayerIds.has(p.id)) return false;
    if (
      p.availability.status === "injured" ||
      p.availability.status === "suspended" ||
      p.availability.status === "unavailable"
    ) return false;

    const teamCount = teamCounts.get(p.teamId) ?? 0;
    if (p.teamId === weakTeamId) {
      if (teamCount - 1 >= 3) return false;
    } else {
      if (teamCount >= 3) return false;
    }

    return true;
  });

  const scored: TransferCandidate[] = [];

  for (const candidate of candidates) {
    let sp = scoredCache.get(candidate.id);

    if (!sp) {
      const stats = computeStatisticalSignals(candidate, currentGw);
      const fixtureSigs = computeFixtureSignals(candidate, fixtures, teams, currentGw);
      const market = computeMarketSignals(candidate, maxEpNext);

      const es = elementSummaries.get(candidate.id);
      const trendSigs = es
        ? computeTrendSignals(es.history, es.history_past)
        : null;

      const llm = llmCache.get(candidate.id) ?? DEFAULT_LLM;

      const score = computeCompositeScore(
        stats, trendSigs, fixtureSigs, market, llm,
        candidate.position, candidate.minutes
      );

      sp = {
        player: candidate,
        score,
        statisticalSignals: stats,
        fixtureSignals: fixtureSigs,
        trendSignals: trendSigs,
        marketSignals: market,
        llmSignals: llm,
      };
    }

    const fitsBudget = candidate.price <= maxBudget;

    const candidateGw1Score = computeGw1ProjectedScore(sp);
    const weakGw1Score = computeGw1ProjectedScore(weakPlayer);
    const gw1Gain = candidateGw1Score - weakGw1Score;

    const gw5Gain = sp.score.total - weakPlayer.score.total;

    scored.push({
      candidate: sp,
      gw1Gain,
      gw5Gain,
      fitsBudget,
      restructureNeeded: !fitsBudget,
    });
  }

  scored.sort((a, b) => b.candidate.score.total - a.candidate.score.total);

  return scored.slice(0, PIPELINE_CONFIG.candidatesPerWeakSpot);
}

function computeGw1ProjectedScore(sp: ScoredPlayer): number {
  const gw1Fdr = sp.fixtureSignals.gw1Fdr;
  const gw1FdrScore = 1 - (gw1Fdr - 1) / 4;

  const { breakdown, trendAdjustment, llmAdjustment } = sp.score;
  const fixtureWeight = breakdown.fixture ?? 0;
  const fdrScore5gw = sp.fixtureSignals.fdrScore;
  const baseWithoutFixture = sp.score.total - trendAdjustment - llmAdjustment - fixtureWeight;

  const fixtureWeightPct =
    fdrScore5gw > 0 ? fixtureWeight / fdrScore5gw : fixtureWeight;
  const gw1FixtureContrib = gw1FdrScore * fixtureWeightPct;

  return Math.max(0, Math.min(1, baseWithoutFixture + gw1FixtureContrib + trendAdjustment + llmAdjustment));
}
