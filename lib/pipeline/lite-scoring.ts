import type { Player, Team, Fixture } from "../types";
import type { ScoredPlayer, LlmContextSignals } from "./types";
import { computeStatisticalSignals } from "./statistical-scoring";
import { computeFixtureSignals } from "./fixture-analyzer";
import { computeMarketSignals } from "./market-dynamics";
import { computeCompositeScore } from "./composite-scorer";

// Neutral LLM context — used when a player is scored without the batched
// player-context pass (the base/pitch phase and arbitrary Scout lookups).
export const NEUTRAL_LLM_SIGNALS: LlmContextSignals = {
  rotationRisk: 0,
  oopBonus: 0,
  injurySeverity: 0,
  tacticalBoost: 0,
  opponentKeyAbsence: 0,
  setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
};

export interface LiteScoreInputs {
  fixtures: Fixture[];
  teams: Team[];
  currentGw: number;
  maxEpNext: number;
}

/**
 * Lightweight composite score: statistical + fixture + market signals only,
 * with neutral trend/LLM. Pure compute — no per-player element-summary fetch and
 * no LLM call. Used for the fast base/pitch phase and for arbitrary Scout
 * lookups. (`computeStatisticalSignals` ignores the element summary anyway, so
 * the only delta from a full score is the trend + LLM-context adjustments.)
 */
export function scorePlayerLite(player: Player, inputs: LiteScoreInputs): ScoredPlayer {
  const { fixtures, teams, currentGw, maxEpNext } = inputs;
  const statisticalSignals = computeStatisticalSignals(player, currentGw);
  const fixtureSignals = computeFixtureSignals(player, fixtures, teams, currentGw);
  const marketSignals = computeMarketSignals(player, maxEpNext);
  const score = computeCompositeScore(
    statisticalSignals,
    null,
    fixtureSignals,
    marketSignals,
    NEUTRAL_LLM_SIGNALS,
    player.position,
    player.minutes
  );
  return {
    player,
    score,
    statisticalSignals,
    fixtureSignals,
    trendSignals: null,
    marketSignals,
    llmSignals: NEUTRAL_LLM_SIGNALS,
  };
}
