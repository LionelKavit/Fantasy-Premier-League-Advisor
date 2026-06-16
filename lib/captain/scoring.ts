import type { Player, Fixture, Team, Pick } from "../types";
import type { ScoredPlayer } from "../pipeline/types";
import type { CaptainScore, CaptainCandidate, CaptainSignals } from "./types";
import { CAPTAIN_CONFIG } from "../config";

interface GwFixture {
  fdr: number;
  isHome: boolean;
}

// All fixtures a player's team has in one exact gameweek (0, 1, or 2+).
function getFixturesInGw(
  player: Player,
  fixtures: Fixture[],
  gameweek: number
): GwFixture[] {
  return fixtures
    .filter(
      (f) =>
        f.event === gameweek &&
        (f.team_h === player.teamId || f.team_a === player.teamId)
    )
    .map((f) => {
      const isHome = f.team_h === player.teamId;
      return {
        fdr: isHome ? f.team_h_difficulty : f.team_a_difficulty,
        isHome,
      };
    });
}

function fixtureMultiplier(fx: GwFixture): number {
  const { fixtureStepK, homeBonus, fixtureMultiplierMin, fixtureMultiplierMax } =
    CAPTAIN_CONFIG;
  // Neutral at FDR 3; easier fixtures > 1, harder < 1.
  let m = 1 + (3 - fx.fdr) * fixtureStepK;
  if (fx.isHome) m += homeBonus;
  return Math.max(fixtureMultiplierMin, Math.min(fixtureMultiplierMax, m));
}

function computeMinutesCertainty(sp: ScoredPlayer): number {
  const { status, chanceOfPlayingNext } = sp.player.availability;
  if (status === "injured" || status === "suspended" || status === "unavailable") {
    return 0;
  }
  const availabilityFactor =
    chanceOfPlayingNext === null ? 1 : chanceOfPlayingNext / 100;
  const startsRatio = Math.max(0, Math.min(1, sp.statisticalSignals.minutesReliability));
  const rotationPenalty = 1 - sp.llmSignals.rotationRisk * CAPTAIN_CONFIG.rotationPenaltyWeight;
  const base = 0.5 * availabilityFactor + 0.5 * startsRatio;
  return Math.max(0, Math.min(1, base * rotationPenalty));
}

function computeBaseProjection(player: Player, immediate: boolean): number {
  const { appearancePoints, assistPoints, pointsPerGoal, epBlendWeight } =
    CAPTAIN_CONFIG;
  const goalPts = pointsPerGoal[player.position];
  const modelProjection =
    appearancePoints +
    player.expectedGoalsPer90 * goalPts +
    player.expectedAssistsPer90 * assistPoints;

  // ep_next only meaningfully applies to the immediate upcoming gameweek.
  if (immediate && player.epNext !== null) {
    return epBlendWeight * player.epNext + (1 - epBlendWeight) * modelProjection;
  }
  return modelProjection;
}

function computeCeilingBoost(player: Player): number {
  const { penaltyTakerPremium, threatCeilingWeight, threatPer90Norm } =
    CAPTAIN_CONFIG;
  let boost = 0;
  if (player.setPieceDuties.penalties.order === 1) {
    boost += penaltyTakerPremium;
  }
  const nineties = player.minutes > 0 ? player.minutes / 90 : 1;
  const threatPer90 = player.threat / nineties;
  boost += Math.min(1, threatPer90 / threatPer90Norm) * threatCeilingWeight;
  return boost;
}

function computeDgwMultiplier(gwFixtures: GwFixture[]): number {
  if (gwFixtures.length < 2) return 1;
  const { dgwSecondFixtureMin, dgwSecondFixtureMax } = CAPTAIN_CONFIG;
  // Scale the added value of the second fixture by the WEAKER fixture's quality.
  const weakest = gwFixtures.reduce((w, f) => (f.fdr > w.fdr ? f : w), gwFixtures[0]);
  const quality = (5 - weakest.fdr) / 4; // FDR 1 -> 1.0, FDR 5 -> 0
  const second =
    dgwSecondFixtureMin + (dgwSecondFixtureMax - dgwSecondFixtureMin) * quality;
  return 1 + second;
}

export function computeCaptainScore(
  sp: ScoredPlayer,
  fixtures: Fixture[],
  _teams: Team[],
  gameweek: number,
  immediate: boolean = true
): CaptainScore {
  const player = sp.player;
  const gwFixtures = getFixturesInGw(player, fixtures, gameweek);

  // Blank gameweek — cannot captain a player who does not play.
  if (gwFixtures.length === 0) {
    return {
      total: 0,
      breakdown: { blank: 1 },
      isDgw: false,
      gameweek,
    };
  }

  const baseProjection = computeBaseProjection(player, immediate);
  const ceilingBoost = computeCeilingBoost(player);
  const minutesCertainty = computeMinutesCertainty(sp);
  const dgwMultiplier = computeDgwMultiplier(gwFixtures);

  // Average the fixture multiplier across all fixtures in the gameweek.
  const avgFixtureMultiplier =
    gwFixtures.reduce((s, f) => s + fixtureMultiplier(f), 0) / gwFixtures.length;

  const perMatchValue = baseProjection + ceilingBoost;
  const total =
    perMatchValue * avgFixtureMultiplier * dgwMultiplier * minutesCertainty;

  const signals: CaptainSignals = {
    baseProjection,
    ceilingBoost,
    fixtureMultiplier: avgFixtureMultiplier,
    minutesCertainty,
    dgwMultiplier,
    formSignal: player.form,
  };

  return {
    total: Math.max(0, total),
    breakdown: { ...signals },
    isDgw: gwFixtures.length >= 2,
    gameweek,
  };
}

export function batchComputeCaptainScores(
  squad: ScoredPlayer[],
  picks: Pick[],
  fixtures: Fixture[],
  teams: Team[],
  gameweek: number,
  immediate: boolean = true
): CaptainCandidate[] {
  // Starting XI only: picks positions 1–11.
  const startingIds = new Set(
    picks.filter((p) => p.position <= 11).map((p) => p.element)
  );
  const xi = squad.filter((sp) => startingIds.has(sp.player.id));

  return xi.map((sp) => {
    const captainScore = computeCaptainScore(sp, fixtures, teams, gameweek, immediate);
    const effectiveOwnership = sp.player.selectedByPercent / 100;
    const isDifferential =
      effectiveOwnership < CAPTAIN_CONFIG.differentialOwnershipThreshold;
    return {
      player: sp,
      captainScore,
      effectiveOwnership,
      isDifferential,
      whyCaptain: buildWhyCaptain(sp, captainScore, fixtures, gameweek),
    };
  });
}

function buildWhyCaptain(
  sp: ScoredPlayer,
  score: CaptainScore,
  fixtures: Fixture[],
  gameweek: number
): string[] {
  const reasons: string[] = [];
  const player = sp.player;
  const gwFixtures = getFixturesInGw(player, fixtures, gameweek);

  if (score.isDgw) {
    reasons.push(`Double gameweek (${gwFixtures.length} fixtures)`);
  }
  if (player.setPieceDuties.penalties.order === 1) {
    reasons.push("On penalties (raises ceiling)");
  }
  const homeEasy = gwFixtures.filter((f) => f.isHome && f.fdr <= 2);
  if (homeEasy.length > 0) {
    reasons.push(`Favorable home fixture (FDR ${homeEasy.map((f) => f.fdr).join(", ")})`);
  }
  if (player.form >= 6) {
    reasons.push(`Strong form (${player.form.toFixed(1)})`);
  }
  if (score.breakdown.minutesCertainty !== undefined && score.breakdown.minutesCertainty < 0.7) {
    reasons.push("Minutes risk — monitor before deadline");
  }
  if (reasons.length === 0) {
    reasons.push("Highest projected captain return this gameweek");
  }
  return reasons;
}
