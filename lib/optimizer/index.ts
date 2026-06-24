import type { ManagerProfile, Fixture, Team, Player, GameweekFlags } from "../types";
import type { SquadAnalysisResult } from "../pipeline/types";
import type { TripleCaptainAdvice } from "../captain/types";
import type { OptimizerResult, RestructureCandidate, RestructureOption } from "./types";
import { buildValidTransfers } from "./setup";
import { evaluateSingleTransfer } from "./single-transfer";
import { evaluateHitTransfers } from "./hit-transfer";
import { findRestructureCandidates } from "./restructure";
import { transferBar, transferCost } from "./allocate";
import { computeHorizon } from "./horizon";
import { evaluateChipInteractions } from "./chip-interaction";
import { synthesizeRecommendation } from "./synthesis";
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

  // Restructures are computed first so the allocator can weigh them against straight
  // swaps when choosing the free moves.
  const restructureCandidates = findRestructureCandidates(
    analysis,
    players,
    fixtures,
    teams
  );

  const singleResult = evaluateSingleTransfer(
    validTransfers,
    managerProfile,
    freeTransfers,
    analysis,
    analysis.bank,
    squadTeamCounts,
    restructureCandidates
  );

  const hitResult = evaluateHitTransfers(
    validTransfers,
    analysis.bank,
    squadTeamCounts,
    freeTransfers,
    singleResult
  );

  // The Restructure section shows only chains NOT chosen into the primary plan, each
  // priced and gated against the free transfers left after the recommended moves.
  const restructureOptions = buildRestructureSection(
    restructureCandidates,
    singleResult.freeMoves,
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

  // The weekly verdict is the only synthesis here now (the long-term narrative was
  // display-only and has been removed; the deterministic outputs above are unchanged).
  return synthesizeRecommendation({
    analysis,
    managerProfile,
    validTransfers,
    singleResult,
    hitResult,
    restructureOptions,
    horizon,
    chipRecommendations,
    freeTransfers,
  });
}

const legKey = (vt: { weakPlayer: { player: { id: number } }; candidate: { player: { id: number } } }) =>
  `${vt.weakPlayer.player.id}->${vt.candidate.player.id}`;

// Non-chosen restructure chains for the Restructure section. A candidate is "chosen"
// when both its legs are in the recommended free moves. The rest are priced and gated
// against the free transfers remaining after those moves — each judged independently
// (alternatives don't stack on one another).
function buildRestructureSection(
  candidates: RestructureCandidate[],
  freeMoves: { weakPlayer: { player: { id: number } }; candidate: { player: { id: number } } }[],
  freeTransfers: number
): RestructureOption[] {
  const movedKeys = new Set(freeMoves.map(legKey));
  const remainingFT = Math.max(0, freeTransfers - freeMoves.length);
  const bar = transferBar(2, remainingFT);
  const totalCost = transferCost(2, remainingFT);

  return candidates
    .filter((c) => !(movedKeys.has(legKey(c.dreamTarget)) && movedKeys.has(legKey(c.downgradeTransfer))))
    .filter((c) => c.netEp > bar)
    .slice(0, 3)
    .map((c) => ({ ...c, totalCost }));
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
