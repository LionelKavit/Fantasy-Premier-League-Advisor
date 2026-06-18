import type { ScoredPlayer } from "../pipeline/types";

export interface ValidTransfer {
  weakPlayer: ScoredPlayer;
  candidate: ScoredPlayer;
  priceDelta: number;
  gw1Gain: number;
  gw5Gain: number;
  scoreDiffPct: number;
}

export type TransferType =
  | "FREE"
  | "HIT_SINGLE"
  | "HIT_DOUBLE"
  | "ROLL"
  | "WILDCARD"
  | "FREE_HIT";

export interface TransferAction {
  type: TransferType;
  transfers: ValidTransfer[];
  netPointsCost: number;
  netGain: number;
  breakEvenGw: number | null;
}

export interface SingleTransferResult {
  bestSingle: ValidTransfer | null;
  bestSecond: ValidTransfer | null;
  alternatives: ValidTransfer[];
  savingsOption: ValidTransfer | null;
  rollReason: string | null;
}

export interface HitRecommendation {
  transfers: ValidTransfer[];
  netGain: number;
  breakEvenGw: number | null;
}

export interface HitTransferResult {
  singleHit: HitRecommendation | null;
  doubleHit: HitRecommendation | null;
}

export interface RestructureOption {
  dreamTarget: ValidTransfer;
  downgradedPlayer: ScoredPlayer;
  downgradeReplacement: ScoredPlayer;
  fundingChain: ValidTransfer[];
  netScoreChange: number;
  totalCost: number;
}

export interface HorizonGwScore {
  gw: number;
  candidateScore: number;
  weakScore: number;
  fdr: number;
}

export interface HorizonEntry {
  candidate: ScoredPlayer;
  weakPlayer: ScoredPlayer;
  gwScores: HorizonGwScore[];
  cumulativeGain: number[];
  fixtureSwing: boolean;
  timing: "BUY_NOW" | "WAIT" | "BUY_NOW_SELL_LATER";
}

export type ChipName = "wildcard" | "freeHit" | "benchBoost" | "tripleCaptain";

export interface ChipRecommendation {
  chip: ChipName;
  triggerGw: number;
  reason: string;
  alteredTransfers: TransferAction | null;
}

export interface OptimizerResult {
  primaryRecommendation: TransferAction;
  secondaryRecommendation: TransferAction | null;
  hitVerdict: {
    recommended: boolean;
    reasoning: string;
    breakEvenGw: number | null;
  };
  chipPlan: ChipRecommendation[];
  restructureOptions: RestructureOption[];
  horizon: HorizonEntry[];
  alerts: string[];
  confidence: "high" | "medium" | "low";
  narrativeSummary: string;
  longTermNarrative: string | null;
  generatedAt: string;
}

export interface SynthesisInput {
  analysis: import("../pipeline/types").SquadAnalysisResult;
  managerProfile: import("../types").ManagerProfile;
  validTransfers: ValidTransfer[];
  singleResult: SingleTransferResult;
  hitResult: HitTransferResult;
  restructureOptions: RestructureOption[];
  horizon: HorizonEntry[];
  chipRecommendations: ChipRecommendation[];
  freeTransfers: number;
}
