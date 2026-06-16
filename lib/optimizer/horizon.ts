import type { Fixture, Team } from "../types";
import type { ScoredPlayer } from "../pipeline/types";
import type { ValidTransfer, HorizonEntry, HorizonGwScore } from "./types";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeCompositeScore } from "../pipeline/composite-scorer";

export function computeHorizon(
  validTransfers: ValidTransfer[],
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number
): HorizonEntry[] {
  const top5 = [...validTransfers]
    .sort((a, b) => b.gw1Gain - a.gw1Gain)
    .slice(0, 5);

  const maxGw = 38;
  const entries: HorizonEntry[] = [];

  for (const vt of top5) {
    const horizonLength = Math.min(5, maxGw - currentGw);
    if (horizonLength <= 0) continue;

    const gwScores: HorizonGwScore[] = [];
    const perGwGains: number[] = [];

    for (let offset = 1; offset <= horizonLength; offset++) {
      const gw = currentGw + offset;

      const candidateScore = rescoreForGw(
        vt.candidate,
        fixtures,
        teams,
        gw
      );
      const weakScore = rescoreForGw(vt.weakPlayer, fixtures, teams, gw);

      const candidateFixture = computeFixtureSignals(
        vt.candidate.player,
        fixtures,
        teams,
        gw
      );

      gwScores.push({
        gw,
        candidateScore,
        weakScore,
        fdr: candidateFixture.gw1Fdr,
      });

      perGwGains.push(candidateScore - weakScore);
    }

    const cumulativeGain: number[] = [];
    let running = 0;
    for (const gain of perGwGains) {
      running += gain;
      cumulativeGain.push(running);
    }

    while (cumulativeGain.length < 5) {
      cumulativeGain.push(cumulativeGain[cumulativeGain.length - 1]);
    }

    let fixtureSwing = false;
    for (let i = 1; i < perGwGains.length; i++) {
      if (
        (perGwGains[i] > 0 && perGwGains[i - 1] < 0) ||
        (perGwGains[i] < 0 && perGwGains[i - 1] > 0)
      ) {
        fixtureSwing = true;
        break;
      }
    }

    const gw1Positive = cumulativeGain[0] > 0;
    const gw5Positive = cumulativeGain[4] > 0;

    let timing: HorizonEntry["timing"];
    if (gw1Positive && gw5Positive) {
      timing = "BUY_NOW";
    } else if (!gw1Positive && gw5Positive) {
      timing = "WAIT";
    } else {
      timing = "BUY_NOW_SELL_LATER";
    }

    entries.push({
      candidate: vt.candidate,
      weakPlayer: vt.weakPlayer,
      gwScores,
      cumulativeGain,
      fixtureSwing,
      timing,
    });
  }

  return entries;
}

function rescoreForGw(
  sp: ScoredPlayer,
  fixtures: Fixture[],
  teams: Team[],
  gw: number
): number {
  const newFixture = computeFixtureSignals(sp.player, fixtures, teams, gw);

  const score = computeCompositeScore(
    sp.statisticalSignals,
    sp.trendSignals,
    newFixture,
    sp.marketSignals,
    sp.llmSignals,
    sp.player.position,
    sp.player.minutes
  );

  return score.total;
}
