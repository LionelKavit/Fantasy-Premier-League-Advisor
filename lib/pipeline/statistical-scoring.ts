import type { Player, ElementSummary } from "../types";
import type { StatisticalSignals } from "./types";
import { SUSPENSION_THRESHOLDS } from "../config";

export function computeStatisticalSignals(
  player: Player,
  currentGw: number,
  _elementSummary?: ElementSummary
): StatisticalSignals {
  if (player.minutes === 0) {
    return {
      goalThreat: 0,
      assistPotential: 0,
      formSignal: 0,
      bonusEfficiency: 0,
      setPieceValue: 0,
      valueScore: 0,
      cleanSheetRate: 0,
      xgcRate: 0,
      defensiveScore: 0,
      savesRate: 0,
      minutesReliability: 0,
      suspensionRisk: 0,
    };
  }

  const nineties = player.minutes / 90;

  const goalThreat = player.expectedGoalsPer90;
  const assistPotential = player.expectedAssistsPer90;
  const formSignal = player.form;

  const bpsPer90 = player.bps / nineties;
  const bonusPer90 = player.bonus / nineties;
  const influencePer90 = player.influence / nineties;
  const bonusEfficiency =
    bpsPer90 * 0.5 + bonusPer90 * 10 * 0.3 + influencePer90 * 0.2;

  let setPieceValue = 0;
  if (player.setPieceDuties.penalties.order === 1) setPieceValue += 0.15;
  if (player.setPieceDuties.corners.order === 1) setPieceValue += 0.08;
  if (player.setPieceDuties.directFreekicks.order === 1) setPieceValue += 0.05;

  const valueScore =
    player.price > 0 ? player.pointsPerGame / player.price : 0;

  const isDefOrGk = player.position === "DEF" || player.position === "GK";

  const cleanSheetRate = isDefOrGk
    ? player.cleanSheets / nineties
    : 0;

  const xgcRate = isDefOrGk
    ? player.expectedGoalsConcededPer90 * 0.6 + player.goalsConcededPer90 * 0.4
    : 0;

  const defensiveScore = player.position === "DEF"
    ? player.defensiveContributionPer90
    : 0;

  const savesRate = player.position === "GK" ? player.savesPer90 : 0;

  const chanceNext = player.availability.chanceOfPlayingNext;
  const availabilityFactor = chanceNext === null ? 1 : chanceNext / 100;
  const minutesReliability =
    currentGw > 0 ? (player.starts / currentGw) * availabilityFactor : 0;

  const suspensionRisk = computeSuspensionRisk(player, currentGw);

  return {
    goalThreat,
    assistPotential,
    formSignal,
    bonusEfficiency,
    setPieceValue,
    valueScore,
    cleanSheetRate,
    xgcRate,
    defensiveScore,
    savesRate,
    minutesReliability,
    suspensionRisk,
  };
}

function computeSuspensionRisk(player: Player, currentGw: number): number {
  const yellows = player.yellowCards;
  const reds = player.redCards;
  const gamesPlayed = currentGw > 0 ? currentGw : 1;

  let risk = 0;

  const { yellowBeforeGw19, yellowBeforeGw32, redCardPenalty } =
    SUSPENSION_THRESHOLDS;

  if (currentGw < 19) {
    const remaining = yellowBeforeGw19 - yellows;
    if (remaining <= 0) risk = 1.0;
    else if (remaining === 1) risk = 0.8;
    else if (remaining === 2) risk = 0.5;
    else risk = yellows / gamesPlayed;
  } else if (currentGw < 32) {
    const remaining = yellowBeforeGw32 - yellows;
    if (remaining <= 0) risk = 1.0;
    else if (remaining === 1) risk = 0.8;
    else if (remaining === 2) risk = 0.5;
    else risk = yellows / gamesPlayed;
  } else {
    risk = yellows / gamesPlayed * 0.5;
  }

  if (reds > 0) risk = Math.min(1, risk + redCardPenalty);

  return Math.max(0, Math.min(1, risk));
}
