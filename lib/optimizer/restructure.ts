import type { Player, Fixture, Team } from "../types";
import type { ScoredPlayer, SquadAnalysisResult } from "../pipeline/types";
import type { ValidTransfer, RestructureCandidate } from "./types";
import { PIPELINE_CONFIG } from "../config";

// How many restructure chains to keep as candidates (fed to the allocator and, after
// filtering out the chosen ones, shown in the Restructure section).
const MAX_RESTRUCTURE_CANDIDATES = 6;
import { computeStatisticalSignals } from "../pipeline/statistical-scoring";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeMarketSignals } from "../pipeline/market-dynamics";
import { computeCompositeScore } from "../pipeline/composite-scorer";

// All viable restructure chains, in ep terms. A restructure is a two-transfer
// maneuver: downgrade a funder to a cheaper replacement, freeing the cash to buy a
// "dream" upgrade for a weak spot the manager couldn't otherwise afford. Cost and the
// ep-bar gate are applied downstream (the allocator and the section), which know how
// many free transfers the chain would actually consume.
export function findRestructureCandidates(
  analysis: SquadAnalysisResult,
  allPlayers: Player[],
  fixtures: Fixture[],
  teams: Team[]
): RestructureCandidate[] {
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

  const candidates: RestructureCandidate[] = [];

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

      // ep deltas for both legs. Skip the whole chain if any projection is missing —
      // the same hold-on-missing-ep rule the straight-transfer gate uses.
      const dreamEp = dt.candidate.player.epNext;
      const weakEp = dt.weak.player.epNext;
      const replEp = replacement.player.epNext;
      const funderEp = downgraded.player.epNext;
      if (dreamEp === null || weakEp === null || replEp === null || funderEp === null) continue;

      const netEp = dreamEp - weakEp + (replEp - funderEp);
      if (netEp <= 0) continue;

      // gw1Gain stays composite (display ordering only); ep lives in netEp.
      const dreamTransfer = buildTransfer(dt.weak, dt.candidate);
      const downgradeTransfer = buildTransfer(downgraded, replacement);

      candidates.push({
        dreamTarget: dreamTransfer,
        downgradeTransfer,
        downgradedPlayer: downgraded,
        downgradeReplacement: replacement,
        netEp,
      });
    }
  }

  candidates.sort((a, b) => b.netEp - a.netEp);
  return candidates.slice(0, MAX_RESTRUCTURE_CANDIDATES);
}

// A ValidTransfer with composite gw1Gain (used only for display ordering; the
// restructure decision is ep-denominated via netEp).
function buildTransfer(out: ScoredPlayer, into: ScoredPlayer): ValidTransfer {
  const compositeDiff = into.score.total - out.score.total;
  return {
    weakPlayer: out,
    candidate: into,
    priceDelta: into.player.price - out.player.price,
    gw1Gain: compositeDiff,
    gw5Gain: compositeDiff,
    scoreDiffPct: out.score.total > 0 ? (compositeDiff / out.score.total) * 100 : 0,
  };
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
