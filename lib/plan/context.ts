import type { AnalysisContext } from "./types";
import { fetchBootstrap, fetchFixtures, buildManagerProfile } from "../fpl-api";
import { runSquadAnalysisPipeline } from "../pipeline";
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
