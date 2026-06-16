import type { ScoredPlayer } from "../pipeline/types";
import type { ManagerProfile } from "../types";

export interface CaptainSignals {
  baseProjection: number;
  ceilingBoost: number;
  fixtureMultiplier: number;
  minutesCertainty: number;
  dgwMultiplier: number;
  formSignal: number;
}

export interface CaptainScore {
  total: number;
  breakdown: Record<string, number>;
  isDgw: boolean;
  gameweek: number;
}

export interface CaptainCandidate {
  player: ScoredPlayer;
  captainScore: CaptainScore;
  effectiveOwnership: number;
  isDifferential: boolean;
  whyCaptain: string[];
}

export interface TripleCaptainAdvice {
  recommended: boolean;
  targetGw: number | null;
  targetPlayer: string | null;
  peakScore: number;
  baselineScore: number;
  reasoning: string;
}

export interface HorizonCaptainEntry {
  gameweek: number;
  bestCaptain: CaptainCandidate;
  bestScore: number;
  isDgw: boolean;
}

export interface CaptainResult {
  captain: CaptainCandidate;
  viceCaptain: CaptainCandidate | null;
  differentialOption: CaptainCandidate | null;
  rankedCandidates: CaptainCandidate[];
  tripleCaptainAdvice: TripleCaptainAdvice | null;
  confidence: "high" | "medium" | "low";
  narrativeSummary: string;
  alerts: string[];
  currentGw: number;
  generatedAt: string;
}

export interface CaptainSynthesisInput {
  rankedCandidates: CaptainCandidate[];
  viceCaptain: CaptainCandidate | null;
  differentialOption: CaptainCandidate | null;
  horizon: HorizonCaptainEntry[];
  tripleCaptainAdvice: TripleCaptainAdvice | null;
  managerProfile: ManagerProfile;
  currentGw: number;
}
