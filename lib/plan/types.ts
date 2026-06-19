import type { SquadAnalysisResult } from "../pipeline/types";
import type {
  ManagerProfile,
  Player,
  Team,
  Fixture,
  GameweekFlags,
  Position,
  AvailabilityStatus,
  ChipsRemaining,
} from "../types";
import type { OptimizerResult } from "../optimizer/types";
import type { CaptainResult } from "../captain/types";

// The once-computed inputs shared by the optimizer and captain pipelines.
// Structural superset of both OptimizerContext and CaptainContext.
export interface AnalysisContext {
  analysis: SquadAnalysisResult;
  managerProfile: ManagerProfile;
  players: Player[];
  teams: Team[];
  fixtures: Fixture[];
  gwFlags: GameweekFlags[];
}

// Lean per-player projection for rendering the pitch (display fields only).
export interface SquadPlayerView {
  id: number;
  webName: string;
  teamShortName: string;
  teamCode: number;
  position: Position;
  pickSlot: number; // 1..15
  isStarting: boolean; // pickSlot <= 11
  price: number;
  score: number; // composite total
  form: number;
  pointsPerGame: number;
  epNext: number | null; // projected points next GW
  availability: {
    status: AvailabilityStatus;
    chanceOfPlayingNext: number | null;
    news: string;
  };
  isCaptainRec: boolean;
  isViceRec: boolean;
  isWeakSpot: boolean;
}

// The LLM-derived half of the plan, produced by the slow `insights` phase.
export interface PlanInsights {
  transfers: OptimizerResult | null;
  captaincy: CaptainResult | null;
  alerts: string[];
}

export interface GameweekPlan {
  teamId: number;
  currentGw: number;
  transfers: OptimizerResult | null;
  captaincy: CaptainResult | null;
  squad: SquadPlayerView[];
  bank: number;
  chipsRemaining: ChipsRemaining;
  manager: { name: string; overallRank: number | null; teamName: string };
  alerts: string[];
  generatedAt: string;
}
