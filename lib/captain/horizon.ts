import type { Fixture, Team, Pick } from "../types";
import type { ScoredPlayer } from "../pipeline/types";
import type { HorizonCaptainEntry, TripleCaptainAdvice } from "./types";
import { CAPTAIN_CONFIG } from "../config";
import { batchComputeCaptainScores } from "./scoring";
import { rankCaptains } from "./ranker";

const MAX_GW = 38;

export function computeCaptainHorizon(
  squad: ScoredPlayer[],
  picks: Pick[],
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number,
  horizonLength: number = CAPTAIN_CONFIG.horizonLengthDefault
): HorizonCaptainEntry[] {
  const entries: HorizonCaptainEntry[] = [];

  for (let offset = 1; offset <= horizonLength; offset++) {
    const gw = currentGw + offset;
    if (gw > MAX_GW) break;

    // Only the immediate next gameweek may use FPL's ep fields.
    const immediate = offset === 1;
    const candidates = batchComputeCaptainScores(
      squad,
      picks,
      fixtures,
      teams,
      gw,
      immediate
    );
    const ranked = rankCaptains(candidates);
    const bestCaptain = ranked[0];
    if (!bestCaptain) continue;

    entries.push({
      gameweek: gw,
      bestCaptain,
      bestScore: bestCaptain.captainScore.total,
      isDgw: bestCaptain.captainScore.isDgw,
    });
  }

  return entries;
}

export function deriveTripleCaptainAdvice(
  horizon: HorizonCaptainEntry[],
  baselineScore: number,
  chipAvailable: boolean
): TripleCaptainAdvice {
  if (!chipAvailable) {
    return {
      recommended: false,
      targetGw: null,
      targetPlayer: null,
      peakScore: 0,
      baselineScore,
      reasoning: "Triple Captain chip is not available.",
    };
  }

  if (horizon.length === 0) {
    return {
      recommended: false,
      targetGw: null,
      targetPlayer: null,
      peakScore: 0,
      baselineScore,
      reasoning: "No upcoming gameweeks to evaluate.",
    };
  }

  const peak = horizon.reduce((best, e) => (e.bestScore > best.bestScore ? e : best), horizon[0]);
  const margin = baselineScore * CAPTAIN_CONFIG.tripleCaptainMargin;
  const recommended = peak.bestScore >= margin;

  return {
    recommended,
    targetGw: recommended ? peak.gameweek : null,
    targetPlayer: recommended ? peak.bestCaptain.player.player.webName : null,
    peakScore: peak.bestScore,
    baselineScore,
    reasoning: recommended
      ? `GW${peak.gameweek}${peak.isDgw ? " (DGW)" : ""}: ${peak.bestCaptain.player.player.webName} projects ${peak.bestScore.toFixed(2)}, exceeding the normal-week baseline of ${baselineScore.toFixed(2)} by the required margin.`
      : `No upcoming gameweek's best captain (${peak.bestScore.toFixed(2)}) meaningfully exceeds the normal-week baseline (${baselineScore.toFixed(2)}). Hold the chip for a stronger week (e.g. a favorable double gameweek).`,
  };
}
