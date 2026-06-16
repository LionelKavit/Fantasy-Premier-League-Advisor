// ── Raw API types (exact shape from FPL API) ──

export interface FplPlayerRaw {
  // Identity
  id: number;
  code: number;
  opta_code: string | null;
  first_name: string;
  second_name: string;
  web_name: string;
  known_name: string | null;
  photo: string;
  team: number;
  team_code: number;
  element_type: number; // 1=GK, 2=DEF, 3=MID, 4=FWD
  squad_number: number | null;

  // Status
  status: string; // a/d/i/s/u
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  news: string;
  news_added: string | null;
  removed: boolean;
  can_transact: boolean;
  can_select: boolean;
  special: boolean;

  // FPL game data
  now_cost: number;
  cost_change_event: number;
  cost_change_event_fall: number;
  cost_change_start: number;
  cost_change_start_fall: number;
  price_change_percent: number;
  selected_by_percent: string;
  transfers_in: number;
  transfers_out: number;
  transfers_in_event: number;
  transfers_out_event: number;
  total_points: number;
  event_points: number;
  points_per_game: string;
  form: string;
  value_form: string;
  value_season: string;
  ep_next: string | null;
  ep_this: string | null;
  in_dreamteam: boolean;
  dreamteam_count: number;

  // Raw season stats
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  defensive_contribution: number;

  // Expected stats (season totals)
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;

  // Per-90 stats
  expected_goals_per_90: number;
  expected_assists_per_90: number;
  expected_goal_involvements_per_90: number;
  expected_goals_conceded_per_90: number;
  goals_conceded_per_90: number;
  saves_per_90: number;
  starts_per_90: number;
  clean_sheets_per_90: number;
  defensive_contribution_per_90: number;

  // ICT index
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  influence_rank: number;
  influence_rank_type: number;
  creativity_rank: number;
  creativity_rank_type: number;
  threat_rank: number;
  threat_rank_type: number;
  ict_index_rank: number;
  ict_index_rank_type: number;

  // Set piece duties
  penalties_order: number | null;
  penalties_text: string | null;
  corners_and_indirect_freekicks_order: number | null;
  corners_and_indirect_freekicks_text: string | null;
  direct_freekicks_order: number | null;
  direct_freekicks_text: string | null;

  // Rank fields
  now_cost_rank: number;
  now_cost_rank_type: number;
  form_rank: number;
  form_rank_type: number;
  points_per_game_rank: number;
  points_per_game_rank_type: number;
  selected_rank: number;
  selected_rank_type: number;

  // Scouting
  scout_risks: string | null;
  scout_news_link: string | null;
}

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type AvailabilityStatus = "available" | "doubtful" | "injured" | "suspended" | "unavailable";

const STATUS_MAP: Record<string, AvailabilityStatus> = {
  a: "available",
  d: "doubtful",
  i: "injured",
  s: "suspended",
  u: "unavailable",
};

const POSITION_MAP: Record<number, Position> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export { STATUS_MAP, POSITION_MAP };

export interface PlayerAvailability {
  status: AvailabilityStatus;
  chanceOfPlayingThis: number | null;
  chanceOfPlayingNext: number | null;
  news: string;
  newsAdded: string | null;
  scoutRisks: string | null;
  scoutNewsLink: string | null;
}

export interface SetPieceDuty {
  order: number | null;
  text: string | null;
}

export interface PlayerSetPieceDuties {
  penalties: SetPieceDuty;
  corners: SetPieceDuty;
  directFreekicks: SetPieceDuty;
}

// ── Normalized types (used by all pipeline nodes) ──

export interface Player {
  id: number;
  webName: string;
  teamId: number;
  teamName: string;
  teamShortName: string;
  position: Position;
  price: number;
  form: number;

  // Per-90 stats
  expectedGoalsPer90: number;
  expectedAssistsPer90: number;
  expectedGoalInvolvementsPer90: number;
  expectedGoalsConcededPer90: number;
  goalsConcededPer90: number;
  savesPer90: number;
  startsPer90: number;
  cleanSheetsPer90: number;
  defensiveContributionPer90: number;

  // Raw season stats
  minutes: number;
  starts: number;
  goalsScored: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  ownGoals: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  bonus: number;
  bps: number;
  defensiveContribution: number;

  // Expected stats (season totals as numbers)
  expectedGoals: number;
  expectedAssists: number;
  expectedGoalInvolvements: number;
  expectedGoalsConceded: number;

  // ICT
  influence: number;
  creativity: number;
  threat: number;
  ictIndex: number;

  // Market data
  totalPoints: number;
  eventPoints: number;
  pointsPerGame: number;
  valueForm: number;
  valueSeason: number;
  epNext: number | null;
  epThis: number | null;
  selectedByPercent: number;
  transfersIn: number;
  transfersOut: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  costChangeEvent: number;
  costChangeStartFall: number;
  inDreamteam: boolean;
  dreamteamCount: number;

  // Structured objects
  availability: PlayerAvailability;
  setPieceDuties: PlayerSetPieceDuties;
}

export interface Team {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  points: number;
  position: number;
  form: string | null;
}

export interface TeamSetPieceNotes {
  teamId: number;
  notes: string[];
}

export interface Fixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  team_h_score: number | null;
  team_a_score: number | null;
  kickoff_time: string | null;
  finished: boolean;
  stats: Record<string, unknown>[];
}

export interface Gameweek {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  most_captained: number | null;
  most_selected: number | null;
  most_transferred_in: number | null;
  top_element: number | null;
  average_entry_score: number;
  highest_score: number | null;
}

export interface ManagerEntry {
  id: number;
  playerFirstName: string;
  playerLastName: string;
  name: string;
  summaryOverallPoints: number;
  summaryOverallRank: number | null;
  currentEvent: number;
  bank: number;
  squadValue: number;
}

export interface Pick {
  element: number;
  position: number; // 1-15 (12-15 = bench)
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  element_type: number;
}

export interface EntryHistory {
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface PicksResponse {
  picks: Pick[];
  entry_history: EntryHistory;
  active_chip: string | null;
}

export interface PlayerGameweekHistory {
  round: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  clean_sheets: number;
  goals_conceded: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  starts: number;
  was_home: boolean;
  opponent_team: number;
  value: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  defensive_contribution: number;
  transfers_balance: number;
  selected: number;
  transfers_in: number;
  transfers_out: number;
}

export interface PlayerPastSeason {
  season_name: string;
  total_points: number;
  minutes: number;
  goals_scored: number;
  expected_goals: string;
  assists: number;
  expected_assists: string;
  starts: number;
  start_cost: number;
  end_cost: number;
}

export interface ElementSummary {
  history: PlayerGameweekHistory[];
  history_past: PlayerPastSeason[];
}

export interface ApiErrorResponse {
  error: string;
  status: number;
}

// ── Bootstrap response shape ──

export interface BootstrapChip {
  id: number;
  name: string;
  number: number;
  start_event: number;
  stop_event: number;
  chip_type: string;
}

export interface BootstrapData {
  players: Player[];
  teams: Team[];
  gameweeks: Gameweek[];
  currentGameweek: Gameweek | null;
  chips: BootstrapChip[];
}

// ── Manager history types ──

export interface ManagerGameweekHistory {
  event: number;
  points: number;
  totalPoints: number;
  rank: number;
  overallRank: number;
  percentileRank: number;
  bank: number;
  value: number;
  eventTransfers: number;
  eventTransfersCost: number;
  pointsOnBench: number;
}

export interface ChipUsage {
  name: string;
  event: number;
  time: string;
}

export interface ManagerPastSeason {
  seasonName: string;
  totalPoints: number;
  rank: number;
}

export interface ManagerHistory {
  current: ManagerGameweekHistory[];
  chips: ChipUsage[];
  past: ManagerPastSeason[];
}

export interface ManagerTransfer {
  elementIn: number;
  elementInCost: number;
  elementOut: number;
  elementOutCost: number;
  event: number;
  time: string;
}

export interface ChipsRemaining {
  wildcard: number;
  freeHit: number;
  benchBoost: number;
  tripleCaptain: number;
}

export interface RiskProfile {
  currentRank: number;
  bestRank: number;
  rankTrend: "rising" | "falling" | "stable";
  gwsRemaining: number;
  totalHitsTaken: number;
  totalHitCost: number;
  avgBenchPoints: number;
}

export interface TransferPatterns {
  totalTransfers: number;
  kneeJerkRate: number;
  netValueChange: number;
  positionBias: { GKP: number; DEF: number; MID: number; FWD: number };
  avgHoldDuration: number;
  transfers: ManagerTransfer[];
}

export interface ManagerProfile {
  entry: ManagerEntry;
  history: ManagerHistory;
  chipsRemaining: ChipsRemaining;
  riskProfile: RiskProfile;
  transferPatterns: TransferPatterns;
}

// ── Gameweek analysis types ──

export interface PlayerFixture {
  gameweek: number;
  opponentId: number;
  opponentName: string;
  opponentShortName: string;
  fdr: number;
  isHome: boolean;
}

export interface GameweekFlags {
  gameweek: number;
  isBGW: boolean;
  isDGW: boolean;
  blankTeams: number[];
  doubleTeams: number[];
}
