/**
 * Typed synthetic fixture builders for the offline backend suite. Defaults
 * produce a valid, middle-of-the-road object; pass shallow overrides to shape
 * a scenario. No `as unknown` in test bodies — fixtures stay type-checked.
 */
import type {
  Player,
  Team,
  Fixture,
  Pick,
  GameweekFlags,
  Gameweek,
  Position,
  ManagerProfile,
  ChipsRemaining,
  PlayerAvailability,
  PicksResponse,
} from "../types";
import type {
  ScoredPlayer,
  CompositeScore,
  StatisticalSignals,
  TrendSignals,
  FixtureSignals,
  MarketSignals,
  LlmContextSignals,
  SquadAnalysisResult,
  WeakSpot,
} from "../pipeline/types";
import type { CaptainCandidate, CaptainScore } from "../captain/types";

let idCounter = 1000;
const nextId = () => idCounter++;

export function makeAvailability(
  o: Partial<PlayerAvailability> = {}
): PlayerAvailability {
  return {
    status: "available",
    chanceOfPlayingThis: null,
    chanceOfPlayingNext: null,
    news: "",
    newsAdded: null,
    scoutRisks: null,
    scoutNewsLink: null,
    ...o,
  };
}

export function makePlayer(o: Partial<Player> = {}): Player {
  const id = o.id ?? nextId();
  return {
    id,
    webName: `Player${id}`,
    teamId: 1,
    teamCode: 3,
    teamName: "Team 1",
    teamShortName: "T1",
    position: "MID",
    price: 6.0,
    form: 4.0,
    expectedGoalsPer90: 0.2,
    expectedAssistsPer90: 0.15,
    expectedGoalInvolvementsPer90: 0.35,
    expectedGoalsConcededPer90: 1.2,
    goalsConcededPer90: 1.1,
    savesPer90: 0,
    startsPer90: 1.0,
    cleanSheetsPer90: 0.3,
    defensiveContributionPer90: 5,
    minutes: 1800,
    starts: 20,
    goalsScored: 5,
    assists: 4,
    cleanSheets: 6,
    goalsConceded: 22,
    ownGoals: 0,
    penaltiesSaved: 0,
    penaltiesMissed: 0,
    yellowCards: 2,
    redCards: 0,
    saves: 0,
    bonus: 10,
    bps: 400,
    defensiveContribution: 100,
    expectedGoals: 4.0,
    expectedAssists: 3.0,
    expectedGoalInvolvements: 7.0,
    expectedGoalsConceded: 24.0,
    influence: 500,
    creativity: 400,
    threat: 500,
    ictIndex: 140,
    totalPoints: 100,
    eventPoints: 4,
    pointsPerGame: 4.5,
    valueForm: 0.7,
    valueSeason: 16,
    epNext: 4.0,
    epThis: 4.0,
    selectedByPercent: 10,
    transfersIn: 1000,
    transfersOut: 500,
    transfersInEvent: 100,
    transfersOutEvent: 50,
    costChangeEvent: 0,
    costChangeStartFall: 0,
    inDreamteam: false,
    dreamteamCount: 0,
    availability: makeAvailability(),
    setPieceDuties: {
      penalties: { order: null, text: null },
      corners: { order: null, text: null },
      directFreekicks: { order: null, text: null },
    },
    ...o,
  };
}

export const makeInjuredPlayer = (o: Partial<Player> = {}) =>
  makePlayer({
    ...o,
    availability: makeAvailability({ status: "injured", news: "Knee injury", chanceOfPlayingNext: 0 }),
  });

export const makeSuspendedPlayer = (o: Partial<Player> = {}) =>
  makePlayer({
    ...o,
    availability: makeAvailability({ status: "suspended", news: "Suspended" }),
  });

export const makeDoubtfulPlayer = (chance = 50, o: Partial<Player> = {}) =>
  makePlayer({
    ...o,
    availability: makeAvailability({ status: "doubtful", news: "Knock", chanceOfPlayingNext: chance }),
  });

export function makeTeam(o: Partial<Team> = {}): Team {
  const id = o.id ?? nextId();
  return {
    id,
    name: `Team ${id}`,
    short_name: `T${id}`,
    strength: 3,
    strength_overall_home: 1200,
    strength_overall_away: 1200,
    strength_attack_home: 1200,
    strength_attack_away: 1200,
    strength_defence_home: 1200,
    strength_defence_away: 1200,
    played: 30,
    win: 12,
    draw: 8,
    loss: 10,
    points: 44,
    position: 10,
    form: null,
    ...o,
  };
}

export function makeFixture(o: Partial<Fixture> = {}): Fixture {
  const id = o.id ?? nextId();
  return {
    id,
    event: 20,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    team_h_score: null,
    team_a_score: null,
    kickoff_time: null,
    finished: false,
    stats: [],
    ...o,
  };
}

export function makePick(o: Partial<Pick> = {}): Pick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    element_type: 3,
    ...o,
  };
}

export function makeGameweek(o: Partial<Gameweek> = {}): Gameweek {
  return {
    id: 20,
    name: "Gameweek 20",
    deadline_time: "2026-01-01T00:00:00Z",
    finished: false,
    is_previous: false,
    is_current: true,
    is_next: false,
    most_captained: null,
    most_selected: null,
    most_transferred_in: null,
    top_element: null,
    average_entry_score: 50,
    highest_score: null,
    ...o,
  };
}

export function makePicksResponse(o: Partial<PicksResponse> & { bank?: number } = {}): PicksResponse {
  const { bank, ...rest } = o;
  return {
    picks: rest.picks ?? [],
    entry_history: rest.entry_history ?? {
      bank: bank ?? 2.0,
      value: 1000,
      event_transfers: 1,
      event_transfers_cost: 0,
      points_on_bench: 5,
    },
    active_chip: rest.active_chip ?? null,
  };
}

export function makeGameweekFlags(o: Partial<GameweekFlags> = {}): GameweekFlags {
  return {
    gameweek: 21,
    isBGW: false,
    isDGW: false,
    blankTeams: [],
    doubleTeams: [],
    ...o,
  };
}

// ── Signal & scored-player builders ──

export const makeStatisticalSignals = (o: Partial<StatisticalSignals> = {}): StatisticalSignals => ({
  goalThreat: 0.2,
  assistPotential: 0.15,
  formSignal: 4,
  bonusEfficiency: 15,
  setPieceValue: 0,
  valueScore: 0.7,
  cleanSheetRate: 0.3,
  xgcRate: 1.1,
  defensiveScore: 5,
  savesRate: 0,
  minutesReliability: 0.9,
  suspensionRisk: 0.1,
  ...o,
});

export const makeTrendSignals = (o: Partial<TrendSignals> = {}): TrendSignals => ({
  rollingXg: 0.2,
  rollingGoals: 0.2,
  xgTrend: 0,
  gap: 0,
  finisherPremium: false,
  classification: "HOLD",
  additive: 0,
  ...o,
});

export const makeFixtureSignals = (o: Partial<FixtureSignals> = {}): FixtureSignals => ({
  fdrScore: 0.5,
  homeRatio: 0.5,
  dgwBonus: 0,
  opponentStrength: 0.5,
  gw1Fdr: 3,
  gw5AvgFdr: 3,
  hasBgw: false,
  hasDgw: false,
  ...o,
});

export const makeMarketSignals = (o: Partial<MarketSignals> = {}): MarketSignals => ({
  priceMovement: 0,
  ownershipScore: 0.1,
  transferMomentum: 0,
  epNextSignal: 0.5,
  differentialValue: 0.9,
  ...o,
});

export const makeLlmSignals = (o: Partial<LlmContextSignals> = {}): LlmContextSignals => ({
  rotationRisk: 0,
  oopBonus: 0,
  injurySeverity: 0,
  tacticalBoost: 0,
  opponentKeyAbsence: 0,
  setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
  ...o,
});

export interface ScoredPlayerOverrides {
  player?: Partial<Player>;
  total?: number;
  score?: Partial<CompositeScore>;
  statisticalSignals?: Partial<StatisticalSignals>;
  fixtureSignals?: Partial<FixtureSignals>;
  trendSignals?: Partial<TrendSignals> | null;
  marketSignals?: Partial<MarketSignals>;
  llmSignals?: Partial<LlmContextSignals>;
}

export function makeScoredPlayer(o: ScoredPlayerOverrides = {}): ScoredPlayer {
  const player = makePlayer(o.player);
  const score: CompositeScore = {
    total: o.total ?? 0.5,
    breakdown: {},
    trendAdjustment: 0,
    llmAdjustment: 0,
    trendClassification: null,
    position: player.position,
    ...o.score,
  };
  return {
    player,
    score,
    statisticalSignals: makeStatisticalSignals(o.statisticalSignals),
    fixtureSignals: makeFixtureSignals(o.fixtureSignals),
    trendSignals: o.trendSignals === null ? null : makeTrendSignals(o.trendSignals ?? {}),
    marketSignals: makeMarketSignals(o.marketSignals),
    llmSignals: makeLlmSignals(o.llmSignals),
  };
}

export const makeChips = (o: Partial<ChipsRemaining> = {}): ChipsRemaining => ({
  wildcard: 0,
  freeHit: 0,
  benchBoost: 0,
  tripleCaptain: 0,
  ...o,
});

export function makeManagerProfile(o: Partial<ManagerProfile> = {}): ManagerProfile {
  return {
    entry: {
      id: 123456,
      playerFirstName: "Test",
      playerLastName: "Manager",
      name: "Test FC",
      summaryOverallPoints: 1500,
      summaryOverallRank: 500000,
      currentEvent: 20,
      bank: 2.0,
      squadValue: 100,
    },
    history: { current: [], chips: [], past: [] },
    chipsRemaining: makeChips(),
    riskProfile: {
      currentRank: 500000,
      bestRank: 400000,
      rankTrend: "stable",
      gwsRemaining: 18,
      totalHitsTaken: 1,
      totalHitCost: 4,
      avgBenchPoints: 5,
    },
    transferPatterns: {
      totalTransfers: 20,
      kneeJerkRate: 0.2,
      netValueChange: 1.5,
      positionBias: { GKP: 1, DEF: 6, MID: 8, FWD: 5 },
      avgHoldDuration: 6,
      transfers: [],
    },
    ...o,
  };
}

/**
 * A full 15-player scored squad with ids 1..15 (descending scores) plus matching
 * picks (positions 1..15). Returns the pieces a SquadAnalysisResult needs.
 */
export function makeSquad(
  count = 15,
  perPlayer: (i: number) => ScoredPlayerOverrides = () => ({})
): { rankedSquad: ScoredPlayer[]; picks: Pick[] } {
  const rankedSquad: ScoredPlayer[] = [];
  const picks: Pick[] = [];
  for (let i = 0; i < count; i++) {
    const overrides = perPlayer(i);
    const sp = makeScoredPlayer({
      total: 0.8 - i * 0.04,
      ...overrides,
      player: { id: i + 1, webName: `P${i + 1}`, teamId: (i % 5) + 1, ...overrides.player },
    });
    rankedSquad.push(sp);
    picks.push(makePick({ element: i + 1, position: i + 1 }));
  }
  return { rankedSquad, picks };
}

export function makeSquadAnalysisResult(
  o: Partial<SquadAnalysisResult> = {}
): SquadAnalysisResult {
  const built = o.rankedSquad ? null : makeSquad();
  const rankedSquad = o.rankedSquad ?? built!.rankedSquad;
  const picks = o.picks ?? built?.picks ?? rankedSquad.map((sp, i) => makePick({ element: sp.player.id, position: i + 1 }));
  const weakest3: WeakSpot[] =
    o.weakest3 ??
    rankedSquad.slice(-3).map((sp) => ({ player: sp, whyWeak: ["Low composite score"], targets: [] }));
  return {
    rankedSquad,
    weakest3,
    picks,
    chipsRemaining: o.chipsRemaining ?? makeChips(),
    bank: o.bank ?? 2.0,
    currentGw: o.currentGw ?? 20,
    deadline: o.deadline ?? "2026-01-01T00:00:00Z",
    generatedAt: o.generatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

export function makeCaptainCandidate(o: {
  player?: ScoredPlayerOverrides;
  total?: number;
  isDgw?: boolean;
  gameweek?: number;
  effectiveOwnership?: number;
  isDifferential?: boolean;
} = {}): CaptainCandidate {
  const player = makeScoredPlayer(o.player);
  const captainScore: CaptainScore = {
    total: o.total ?? 5,
    breakdown: { minutesCertainty: 1, fixtureMultiplier: 1 },
    isDgw: o.isDgw ?? false,
    gameweek: o.gameweek ?? 21,
  };
  return {
    player,
    captainScore,
    effectiveOwnership: o.effectiveOwnership ?? 0.2,
    isDifferential: o.isDifferential ?? false,
    whyCaptain: ["Highest projected return"],
  };
}

// ── Scenario composers ──

/** Two fixtures in `gw` for each team in `teamIds`, plus a DGW flag. */
export function makeDgw(
  teamIds: number[],
  gw: number,
  fdr = 2
): { fixtures: Fixture[]; flags: GameweekFlags } {
  const fixtures: Fixture[] = [];
  for (const t of teamIds) {
    fixtures.push(makeFixture({ event: gw, team_h: t, team_a: 90 + t, team_h_difficulty: fdr }));
    fixtures.push(makeFixture({ event: gw, team_h: t, team_a: 80 + t, team_h_difficulty: fdr }));
  }
  return {
    fixtures,
    flags: makeGameweekFlags({ gameweek: gw, isDGW: true, doubleTeams: [...teamIds] }),
  };
}

/** A blank gameweek flag for `blankTeamIds`. */
export const makeBgw = (blankTeamIds: number[], gw: number): GameweekFlags =>
  makeGameweekFlags({ gameweek: gw, isBGW: true, blankTeams: [...blankTeamIds] });
