import type { Player, Position, ChipsRemaining, Pick } from "../types";

export interface StatisticalSignals {
  goalThreat: number;
  assistPotential: number;
  formSignal: number;
  bonusEfficiency: number;
  setPieceValue: number;
  valueScore: number;
  cleanSheetRate: number;
  xgcRate: number;
  defensiveScore: number;
  savesRate: number;
  minutesReliability: number;
  suspensionRisk: number;
}

export interface TrendSignals {
  rollingXg: number;
  rollingGoals: number;
  xgTrend: number;
  gap: number;
  finisherPremium: boolean;
  classification:
    | "BUY"
    | "HIDDEN_GEM_BUY"
    | "SELL_RISK"
    | "SELL"
    | "HOLD"
    | null;
  additive: number;
}

export interface FixtureSignals {
  fdrScore: number;
  homeRatio: number;
  dgwBonus: number;
  opponentStrength: number;
  gw1Fdr: number;
  gw5AvgFdr: number;
  hasBgw: boolean;
  hasDgw: boolean;
}

export interface MarketSignals {
  priceMovement: number;
  ownershipScore: number;
  transferMomentum: number;
  epNextSignal: number;
  // Whether epNextSignal reflects a real FPL projection (false → it's the neutral 0.5
  // placeholder); the cold-start path needs the distinction, since 0.5 is also a valid signal.
  epNextAvailable: boolean;
  differentialValue: number;
}

export interface LlmContextSignals {
  rotationRisk: number;
  oopBonus: number;
  injurySeverity: number;
  tacticalBoost: number;
  opponentKeyAbsence: number;
  setPieceHierarchy: {
    penaltyTaker: string | null;
    cornerTaker: string | null;
    freeKickTaker: string | null;
  };
}

export interface CompositeScore {
  total: number;
  breakdown: Record<string, number>;
  trendAdjustment: number;
  llmAdjustment: number;
  trendClassification: string | null;
  position: Position;
}

export interface ScoredPlayer {
  player: Player;
  score: CompositeScore;
  statisticalSignals: StatisticalSignals;
  fixtureSignals: FixtureSignals;
  trendSignals: TrendSignals | null;
  marketSignals: MarketSignals;
  llmSignals: LlmContextSignals;
}

export interface WeakSpot {
  player: ScoredPlayer;
  whyWeak: string[];
  targets: TransferCandidate[];
}

export interface TransferCandidate {
  candidate: ScoredPlayer;
  gw1Gain: number;
  gw5Gain: number;
  fitsBudget: boolean;
  restructureNeeded: boolean;
}

export interface SquadAnalysisResult {
  rankedSquad: ScoredPlayer[];
  weakSpots: WeakSpot[];
  picks: Pick[];
  chipsRemaining: ChipsRemaining;
  bank: number;
  currentGw: number;
  deadline: string | null; // ISO deadline of the current gameweek (when picks lock)
  generatedAt: string;
}
