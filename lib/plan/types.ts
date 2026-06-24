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
import type { DemoSeason } from "../demo/squad";

// The once-computed inputs shared by the optimizer and captain pipelines.
// Structural superset of both OptimizerContext and CaptainContext.
export interface AnalysisContext {
  analysis: SquadAnalysisResult;
  managerProfile: ManagerProfile;
  players: Player[];
  teams: Team[];
  fixtures: Fixture[];
  gwFlags: GameweekFlags[];
  // Set only on the demo context — which metric the sample squad was ranked on.
  demoSeason?: DemoSeason;
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
  deadline: string | null; // ISO deadline of the current gameweek (when picks lock)
  transfers: OptimizerResult | null;
  captaincy: CaptainResult | null;
  squad: SquadPlayerView[];
  bank: number;
  chipsRemaining: ChipsRemaining;
  manager: { name: string; overallRank: number | null; teamName: string };
  alerts: string[];
  generatedAt: string;
  // Present only for the demo plan — drives the shell's season-aware banner copy.
  demoSeason?: DemoSeason;
}
