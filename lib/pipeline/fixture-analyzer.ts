import type { Player, Fixture, Team } from "../types";
import type { FixtureSignals } from "./types";
import { getPlayerFixtures, computeFdrRun } from "../gameweek";
import { PIPELINE_CONFIG } from "../config";

export function computeFixtureSignals(
  player: Player,
  fixtures: Fixture[],
  teams: Team[],
  currentGwId: number
): FixtureSignals {
  const playerFixtures = getPlayerFixtures(
    player,
    fixtures,
    teams,
    currentGwId,
    PIPELINE_CONFIG.fdrRunLength
  );

  if (playerFixtures.length === 0) {
    return {
      fdrScore: 0,
      homeRatio: 0,
      dgwBonus: 0,
      opponentStrength: 0,
      gw1Fdr: 5,
      gw5AvgFdr: 5,
      hasBgw: false,
      hasDgw: false,
    };
  }

  const fdrRun = computeFdrRun(
    player.teamId,
    fixtures,
    currentGwId,
    PIPELINE_CONFIG.fdrRunLength
  );

  const fdrValues: number[] = [];
  let hasBgw = false;
  let hasDgw = false;
  let dgwCount = 0;

  for (const entry of fdrRun) {
    if (entry.fdr === null) {
      hasBgw = true;
    } else if (Array.isArray(entry.fdr)) {
      hasDgw = true;
      dgwCount++;
      for (const f of entry.fdr) fdrValues.push(f);
    } else {
      fdrValues.push(entry.fdr);
    }
  }

  const avgFdr =
    fdrValues.length > 0
      ? fdrValues.reduce((s, v) => s + v, 0) / fdrValues.length
      : 3;
  const fdrScore = 1 - (avgFdr - 1) / 4;
  const gw5AvgFdr = avgFdr;

  const gw1Fdr = playerFixtures.length > 0 ? playerFixtures[0].fdr : 5;

  const homeCount = playerFixtures.filter((f) => f.isHome).length;
  const homeRatio = playerFixtures.length > 0
    ? homeCount / playerFixtures.length
    : 0;

  const dgwBonus = Math.min(1.0, dgwCount * 0.1);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const isAttacker = player.position === "FWD" || player.position === "MID";

  let opponentStrengthSum = 0;
  for (const pf of playerFixtures) {
    const opp = teamMap.get(pf.opponentId);
    if (!opp) continue;
    if (isAttacker) {
      opponentStrengthSum += pf.isHome
        ? opp.strength_defence_away
        : opp.strength_defence_home;
    } else {
      opponentStrengthSum += pf.isHome
        ? opp.strength_attack_away
        : opp.strength_attack_home;
    }
  }

  // Normalize opponent strength: FPL uses ~1000-1400 range
  const avgOppStrength =
    playerFixtures.length > 0
      ? opponentStrengthSum / playerFixtures.length
      : 1200;
  const opponentStrength = Math.max(
    0,
    Math.min(1, 1 - (avgOppStrength - 1000) / 400)
  );

  return {
    fdrScore: Math.max(0, Math.min(1, fdrScore)),
    homeRatio,
    dgwBonus,
    opponentStrength,
    gw1Fdr,
    gw5AvgFdr,
    hasBgw,
    hasDgw,
  };
}
