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
  | "ROLL";

export interface TransferAction {
  type: TransferType;
  transfers: ValidTransfer[];
  netPointsCost: number;
  netGain: number;
  breakEvenGw: number | null;
}

export type TransferHoldReason = "ep_unavailable" | "below_threshold" | "no_valid_targets";

export interface SingleTransferResult {
  // The committed free moves, in priority order (0..freeTransfers entries). Each
  // clears the free-transfer ep bar; budget/club limits hold across the whole set.
  // `bestSingle`/`bestSecond` are kept as freeMoves[0]/[1] for existing consumers.
  freeMoves: ValidTransfer[];
  bestSingle: ValidTransfer | null;
  bestSecond: ValidTransfer | null;
  alternatives: ValidTransfer[];
  savingsOption: ValidTransfer | null;
  rollReason: string | null;
  // Typed reason when no transfer is recommended (null when one is). Drives the
  // deterministic ep-unavailable notice (transfer-ep-notice).
  holdReason: TransferHoldReason | null;
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

// status drives the single-source-of-truth rendering: `window` = a candidate
// future slot (Chips tab); `play-now` = activate at the current gameweek (only the
// orchestrator may set this); `hold`. `draft` is the chip's transfer set (wildcard/
// free-hit), computed once and reused wherever the chip is shown.
export type ChipStatus = "window" | "play-now" | "hold";

export interface ChipRecommendation {
  chip: ChipName;
  triggerGw: number;
  status: ChipStatus;
  reason: string;
  draft: ValidTransfer[] | null;
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
  generatedAt: string;
  // Deterministic, code-authored notice (not LLM) — set when transfers are held
  // because ep_next is unavailable (transfer-ep-notice). Null in normal operation.
  dataNotice: string | null;
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
