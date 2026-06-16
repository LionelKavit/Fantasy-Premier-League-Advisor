import type { PlayerGameweekHistory, PlayerPastSeason } from "../types";
import type { TrendSignals } from "./types";
import { TREND_THRESHOLDS, REGRESSION_ADDITIVES } from "../config";

export function computeTrendSignals(
  history: PlayerGameweekHistory[],
  historyPast: PlayerPastSeason[]
): TrendSignals {
  const qualifying = history
    .filter((gw) => gw.minutes > 0)
    .sort((a, b) => b.round - a.round)
    .slice(0, TREND_THRESHOLDS.rollingWindow);

  if (qualifying.length < TREND_THRESHOLDS.minGws) {
    return {
      rollingXg: 0,
      rollingGoals: 0,
      xgTrend: 0,
      gap: 0,
      finisherPremium: false,
      classification: null,
      additive: 0,
    };
  }

  // Chronological order for slope computation
  const window = qualifying.reverse();

  const xgPer90s = window.map(
    (gw) => (parseFloat(gw.expected_goals as unknown as string) || 0) / (gw.minutes / 90)
  );
  const goalsPer90s = window.map(
    (gw) => gw.goals_scored / (gw.minutes / 90)
  );

  const rollingXg = avg(xgPer90s);
  const rollingGoals = avg(goalsPer90s);
  const xgTrend = linearSlope(xgPer90s);
  const gap = rollingGoals - rollingXg;

  const finisherPremium = detectFinisherPremium(historyPast);

  const { classification, additive } = classify(
    xgTrend,
    gap,
    rollingGoals > rollingXg,
    finisherPremium
  );

  return {
    rollingXg,
    rollingGoals,
    xgTrend,
    gap,
    finisherPremium,
    classification,
    additive,
  };
}

function classify(
  xgTrend: number,
  gap: number,
  goalsAboveXg: boolean,
  finisherPremium: boolean
): { classification: TrendSignals["classification"]; additive: number } {
  let classification: TrendSignals["classification"] = "HOLD";
  let additive = 0;

  const { slopeRising, slopeFalling, gapWideningThreshold } = TREND_THRESHOLDS;

  if (xgTrend < slopeFalling) {
    classification = "SELL";
    additive = REGRESSION_ADDITIVES.SELL;
  } else if (xgTrend > slopeRising && goalsAboveXg) {
    if (gap > gapWideningThreshold) {
      classification = "HOLD";
      additive = 0;
    } else {
      classification = "BUY";
      additive = REGRESSION_ADDITIVES.BUY;
    }
  } else if (xgTrend > slopeRising && !goalsAboveXg) {
    classification = "HIDDEN_GEM_BUY";
    additive = REGRESSION_ADDITIVES.HIDDEN_GEM_BUY;
  } else if (
    Math.abs(xgTrend) <= slopeRising &&
    goalsAboveXg &&
    gap > gapWideningThreshold
  ) {
    classification = "SELL_RISK";
    additive = REGRESSION_ADDITIVES.SELL_RISK;
  }

  if (finisherPremium) {
    additive += REGRESSION_ADDITIVES.FINISHER_PREMIUM;
  }

  return { classification, additive };
}

function detectFinisherPremium(pastSeasons: PlayerPastSeason[]): boolean {
  if (pastSeasons.length < TREND_THRESHOLDS.finisherMinSeasons) return false;

  let overperformCount = 0;
  for (const season of pastSeasons) {
    const xg = parseFloat(season.expected_goals) || 0;
    if (season.goals_scored > xg && xg > 0) overperformCount++;
  }

  return overperformCount >= TREND_THRESHOLDS.finisherMinSeasons;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}
