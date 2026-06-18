import type { ManagerProfile, Fixture, Team, Player, GameweekFlags } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { TripleCaptainAdvice } from "../captain/types";
import type { OptimizerResult } from "./types";
import { buildValidTransfers } from "./setup";
import { evaluateSingleTransfer } from "./single-transfer";
import { evaluateHitTransfers } from "./hit-transfer";
import { findRestructureOptions } from "./restructure";
import { computeHorizon } from "./horizon";
import { evaluateChipInteractions } from "./chip-interaction";
import { synthesizeRecommendation } from "./synthesis";
import { synthesizeLongTerm } from "./long-term-synthesis";
import { detectGameweekFlags } from "../gameweek";
import { fetchBootstrap, fetchFixtures, buildManagerProfile } from "../fpl-api";
import { runSquadAnalysisPipeline } from "../pipeline";

// Pre-computed inputs the optimizer needs. The gameweek-plan `AnalysisContext`
// is a structural superset, so it can be passed here directly.
export interface OptimizerContext {
  analysis: SquadAnalysisResult;
  managerProfile: ManagerProfile;
  players: Player[];
  teams: Team[];
  fixtures: Fixture[];
  gwFlags: GameweekFlags[];
}

export async function runOptimizerWithContext(
  ctx: OptimizerContext,
  freeTransfers: number,
  tripleCaptainAdvice?: TripleCaptainAdvice
): Promise<OptimizerResult> {
  const { analysis, managerProfile, players, teams, fixtures, gwFlags } = ctx;

  const squadTeamCounts = new Map<number, number>();
  for (const sp of analysis.rankedSquad) {
    const tid = sp.player.teamId;
    squadTeamCounts.set(tid, (squadTeamCounts.get(tid) ?? 0) + 1);
  }

  const validTransfers = buildValidTransfers(
    analysis,
    analysis.bank,
    squadTeamCounts
  );

  const singleResult = evaluateSingleTransfer(
    validTransfers,
    managerProfile,
    freeTransfers,
    analysis,
    analysis.bank,
    squadTeamCounts
  );

  const hitResult = evaluateHitTransfers(
    validTransfers,
    analysis.bank,
    squadTeamCounts,
    freeTransfers,
    singleResult
  );

  const restructureOptions = findRestructureOptions(
    analysis,
    players,
    fixtures,
    teams,
    freeTransfers
  );

  const horizon = computeHorizon(
    validTransfers,
    fixtures,
    teams,
    analysis.currentGw
  );

  const chipRecommendations = evaluateChipInteractions(
    analysis,
    managerProfile,
    validTransfers,
    gwFlags,
    singleResult,
    hitResult,
    fixtures,
    tripleCaptainAdvice
  );

  // Weekly verdict and long-term verdict are two separate LLM calls, run concurrently.
  const [result, longTermNarrative] = await Promise.all([
    synthesizeRecommendation({
      analysis,
      managerProfile,
      validTransfers,
      singleResult,
      hitResult,
      restructureOptions,
      horizon,
      chipRecommendations,
      freeTransfers,
    }),
    synthesizeLongTerm({
      horizon,
      chipRecommendations,
      restructureOptions,
      chipsRemaining: analysis.chipsRemaining,
      currentGw: analysis.currentGw,
      riskProfile: managerProfile.riskProfile,
    }),
  ]);

  return { ...result, longTermNarrative };
}

export async function runOptimizerPipeline(
  teamId: number,
  freeTransfers: number
): Promise<OptimizerResult> {
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

  return runOptimizerWithContext(
    {
      analysis,
      managerProfile,
      players: bootstrap.players,
      teams: bootstrap.teams,
      fixtures,
      gwFlags,
    },
    freeTransfers
  );
}
