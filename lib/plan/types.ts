import type { SquadAnalysisResult } from "../pipeline/types";
import type {
  ManagerProfile,
  Player,
  Team,
  Fixture,
  GameweekFlags,
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

export interface GameweekPlan {
  teamId: number;
  currentGw: number;
  transfers: OptimizerResult | null;
  captaincy: CaptainResult | null;
  alerts: string[];
  generatedAt: string;
}
