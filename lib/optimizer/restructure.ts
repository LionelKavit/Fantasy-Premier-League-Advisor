import type { Player, Fixture, Team } from "../types";
import type { ScoredPlayer, SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer, RestructureOption } from "./types";
import { PIPELINE_CONFIG } from "../config";
import { computeStatisticalSignals } from "../pipeline/statistical-scoring";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeMarketSignals } from "../pipeline/market-dynamics";
import { computeCompositeScore } from "../pipeline/composite-scorer";

export function findRestructureOptions(
  analysis: SquadAnalysisResult,
  allPlayers: Player[],
  fixtures: Fixture[],
  teams: Team[],
  freeTransfers: number
): RestructureOption[] {
  const dreamTargets: { weak: ScoredPlayer; candidate: ScoredPlayer }[] = [];

  for (const ws of analysis.weakSpots) {
    for (const target of ws.targets) {
      if (target.restructureNeeded) {
        dreamTargets.push({
          weak: ws.player,
          candidate: target.candidate,
        });
      }
    }
  }

  if (dreamTargets.length === 0) return [];

  const weakIds = new Set(analysis.weakSpots.map((ws) => ws.player.player.id));
  const downgradeCandidates = analysis.rankedSquad
    .slice(3)
    .filter((sp) => !weakIds.has(sp.player.id));

  const squadTeamCounts = new Map<number, number>();
  for (const sp of analysis.rankedSquad) {
    const tid = sp.player.teamId;
    squadTeamCounts.set(tid, (squadTeamCounts.get(tid) ?? 0) + 1);
  }

  const maxEpNext = allPlayers.reduce((max, p) => {
    const ep = p.epNext ?? 0;
    return ep > max ? ep : max;
  }, 1);

  const options: RestructureOption[] = [];

  for (const dt of dreamTargets) {
    for (const downgraded of downgradeCandidates) {
      const replacement = findCheapestReplacement(
        downgraded,
        allPlayers,
        analysis.rankedSquad,
        squadTeamCounts,
        fixtures,
        teams,
        analysis.currentGw,
        maxEpNext
      );
      if (!replacement) continue;

      const fundsFreed = downgraded.player.price - replacement.player.price;
      const totalBudget = dt.weak.player.price + analysis.bank + fundsFreed;
      if (totalBudget < dt.candidate.player.price) continue;

      const gainFromDream =
        dt.candidate.score.total - dt.weak.score.total;
      const lossFromDowngrade =
        replacement.score.total - downgraded.score.total;
      const netScoreChange = gainFromDream + lossFromDowngrade;

      if (netScoreChange <= 0) continue;

      // A restructure spends two transfers (downgrade a funder + buy the dream),
      // so the points cost is one −4 hit for each move beyond the free allowance.
      const totalCost = Math.max(0, 2 - freeTransfers) * 4;

      const dreamTransfer: ValidTransfer = {
        weakPlayer: dt.weak,
        candidate: dt.candidate,
        priceDelta: dt.candidate.player.price - dt.weak.player.price,
        gw1Gain: gainFromDream,
        gw5Gain: gainFromDream,
        scoreDiffPct:
          dt.weak.score.total > 0
            ? (gainFromDream / dt.weak.score.total) * 100
            : 0,
      };

      options.push({
        dreamTarget: dreamTransfer,
        downgradedPlayer: downgraded,
        downgradeReplacement: replacement,
        fundingChain: [dreamTransfer],
        netScoreChange,
        totalCost,
      });
    }
  }

  options.sort((a, b) => b.netScoreChange - a.netScoreChange);
  return options.slice(0, 3);
}

function findCheapestReplacement(
  downgraded: ScoredPlayer,
  allPlayers: Player[],
  squad: ScoredPlayer[],
  squadTeamCounts: Map<number, number>,
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number,
  maxEpNext: number
): ScoredPlayer | null {
  const squadIds = new Set(squad.map((sp) => sp.player.id));
  const position = downgraded.player.position;

  const eligible = allPlayers
    .filter((p) => {
      if (p.position !== position) return false;
      if (squadIds.has(p.id)) return false;
      const { status } = p.availability;
      if (status === "injured" || status === "suspended" || status === "unavailable")
        return false;
      if (p.price >= downgraded.player.price) return false;

      const teamCount = squadTeamCounts.get(p.teamId) ?? 0;
      if (p.teamId === downgraded.player.teamId) {
        if (teamCount - 1 >= 3) return false;
      } else {
        if (teamCount >= 3) return false;
      }

      return true;
    })
    .sort((a, b) => a.price - b.price);

  for (const p of eligible) {
    const stats = computeStatisticalSignals(p, currentGw);
    const fixtureSigs = computeFixtureSignals(p, fixtures, teams, currentGw);
    const market = computeMarketSignals(p, maxEpNext);
    const score = computeCompositeScore(
      stats,
      null,
      fixtureSigs,
      market,
      {
        rotationRisk: 0,
        oopBonus: 0,
        injurySeverity: 0,
        tacticalBoost: 0,
        opponentKeyAbsence: 0,
        setPieceHierarchy: {
          penaltyTaker: null,
          cornerTaker: null,
          freeKickTaker: null,
        },
      },
      p.position,
      p.minutes
    );

    if (score.total < PIPELINE_CONFIG.insufficientDataFallbackScore) continue;

    return {
      player: p,
      score,
      statisticalSignals: stats,
      fixtureSignals: fixtureSigs,
      trendSignals: null,
      marketSignals: market,
      llmSignals: {
        rotationRisk: 0,
        oopBonus: 0,
        injurySeverity: 0,
        tacticalBoost: 0,
        opponentKeyAbsence: 0,
        setPieceHierarchy: {
          penaltyTaker: null,
          cornerTaker: null,
          freeKickTaker: null,
        },
      },
    };
  }

  return null;
}
