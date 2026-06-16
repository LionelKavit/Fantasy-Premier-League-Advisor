import type { Fixture, Team, ManagerProfile } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { CaptainResult, CaptainSynthesisInput } from "./types";
import { CAPTAIN_CONFIG } from "../config";
import { batchComputeCaptainScores } from "./scoring";
import { rankCaptains, selectCaptaincy } from "./ranker";
import { computeCaptainHorizon, deriveTripleCaptainAdvice } from "./horizon";
import { synthesizeCaptainPick } from "./synthesis";
import { fetchBootstrap, fetchFixtures, buildManagerProfile } from "../fpl-api";
import { runSquadAnalysisPipeline } from "../pipeline";

// Minimal shared context. The forthcoming gameweek-plan `AnalysisContext` is a
// structural superset of this, so it can be passed here directly.
export interface CaptainContext {
  analysis: SquadAnalysisResult;
  managerProfile: ManagerProfile;
  teams: Team[];
  fixtures: Fixture[];
}

// Deterministic phase (no LLM): scores, ranking, selection, horizon, and the
// triple-captain advice. The aggregator computes this before fan-out so it can
// inject the authoritative TC advice into the optimizer's chip node while the
// two LLM syntheses still run in parallel.
export function computeCaptainSynthesisInput(
  ctx: CaptainContext,
  horizonLength: number = CAPTAIN_CONFIG.horizonLengthDefault
): CaptainSynthesisInput {
  const { analysis, managerProfile, teams, fixtures } = ctx;
  const { rankedSquad, picks, currentGw, chipsRemaining } = analysis;

  // Score the current gameweek (immediate — may use FPL ep fields).
  const currentCandidates = batchComputeCaptainScores(
    rankedSquad,
    picks,
    fixtures,
    teams,
    currentGw,
    true
  );
  const ranked = rankCaptains(currentCandidates);
  const { captain, viceCaptain, differentialOption } = selectCaptaincy(
    ranked,
    fixtures,
    currentGw
  );

  // Baseline = best captain score this (normal) week — the opportunity cost of
  // not banking the triple-captain chip for a stronger future week.
  const baselineScore = captain?.captainScore.total ?? 0;

  const horizon = computeCaptainHorizon(
    rankedSquad,
    picks,
    fixtures,
    teams,
    currentGw,
    horizonLength
  );

  const tripleCaptainAdvice = deriveTripleCaptainAdvice(
    horizon,
    baselineScore,
    chipsRemaining.tripleCaptain > 0
  );

  return {
    rankedCandidates: ranked,
    viceCaptain,
    differentialOption,
    horizon,
    tripleCaptainAdvice,
    managerProfile,
    currentGw,
  };
}

export async function runCaptainWithContext(
  ctx: CaptainContext,
  horizonLength: number = CAPTAIN_CONFIG.horizonLengthDefault
): Promise<CaptainResult> {
  return synthesizeCaptainPick(computeCaptainSynthesisInput(ctx, horizonLength));
}

export async function runCaptainPipeline(
  teamId: number,
  horizonLength: number = CAPTAIN_CONFIG.horizonLengthDefault
): Promise<CaptainResult> {
  const [analysis, bootstrap, fixtures] = await Promise.all([
    runSquadAnalysisPipeline(teamId),
    fetchBootstrap(),
    fetchFixtures(),
  ]);
  const managerProfile = await buildManagerProfile(teamId, bootstrap);

  return runCaptainWithContext(
    {
      analysis,
      managerProfile,
      teams: bootstrap.teams,
      fixtures,
    },
    horizonLength
  );
}
