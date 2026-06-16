import {
  type FplPlayerRaw,
  type Player,
  type Team,
  type Gameweek,
  type Fixture,
  type ManagerEntry,
  type PicksResponse,
  type ElementSummary,
  type TeamSetPieceNotes,
  type BootstrapData,
  type BootstrapChip,
  type ManagerGameweekHistory,
  type ChipUsage,
  type ManagerPastSeason,
  type ManagerHistory,
  type ManagerTransfer,
  type ChipsRemaining,
  type RiskProfile,
  type TransferPatterns,
  type ManagerProfile,
  STATUS_MAP,
  POSITION_MAP,
} from "./types";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fplFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: { "User-Agent": "FPL-Advisor/1.0" },
  });
  if (!res.ok) {
    throw new Error(`FPL API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

function normalizePlayer(raw: FplPlayerRaw, teams: Team[]): Player {
  const team = teams.find((t) => t.id === raw.team);
  return {
    id: raw.id,
    webName: raw.web_name,
    teamId: raw.team,
    teamName: team?.name ?? "Unknown",
    teamShortName: team?.short_name ?? "UNK",
    position: POSITION_MAP[raw.element_type] ?? "MID",
    price: raw.now_cost / 10,
    form: parseFloat(raw.form) || 0,

    expectedGoalsPer90: raw.expected_goals_per_90,
    expectedAssistsPer90: raw.expected_assists_per_90,
    expectedGoalInvolvementsPer90: raw.expected_goal_involvements_per_90,
    expectedGoalsConcededPer90: raw.expected_goals_conceded_per_90,
    goalsConcededPer90: raw.goals_conceded_per_90,
    savesPer90: raw.saves_per_90,
    startsPer90: raw.starts_per_90,
    cleanSheetsPer90: raw.clean_sheets_per_90,
    defensiveContributionPer90: raw.defensive_contribution_per_90,

    minutes: raw.minutes,
    starts: raw.starts,
    goalsScored: raw.goals_scored,
    assists: raw.assists,
    cleanSheets: raw.clean_sheets,
    goalsConceded: raw.goals_conceded,
    ownGoals: raw.own_goals,
    penaltiesSaved: raw.penalties_saved,
    penaltiesMissed: raw.penalties_missed,
    yellowCards: raw.yellow_cards,
    redCards: raw.red_cards,
    saves: raw.saves,
    bonus: raw.bonus,
    bps: raw.bps,
    defensiveContribution: raw.defensive_contribution,

    expectedGoals: parseFloat(raw.expected_goals) || 0,
    expectedAssists: parseFloat(raw.expected_assists) || 0,
    expectedGoalInvolvements: parseFloat(raw.expected_goal_involvements) || 0,
    expectedGoalsConceded: parseFloat(raw.expected_goals_conceded) || 0,

    influence: parseFloat(raw.influence) || 0,
    creativity: parseFloat(raw.creativity) || 0,
    threat: parseFloat(raw.threat) || 0,
    ictIndex: parseFloat(raw.ict_index) || 0,

    totalPoints: raw.total_points,
    eventPoints: raw.event_points,
    pointsPerGame: parseFloat(raw.points_per_game) || 0,
    valueForm: parseFloat(raw.value_form) || 0,
    valueSeason: parseFloat(raw.value_season) || 0,
    epNext: raw.ep_next ? parseFloat(raw.ep_next) : null,
    epThis: raw.ep_this ? parseFloat(raw.ep_this) : null,
    selectedByPercent: parseFloat(raw.selected_by_percent) || 0,
    transfersIn: raw.transfers_in,
    transfersOut: raw.transfers_out,
    transfersInEvent: raw.transfers_in_event,
    transfersOutEvent: raw.transfers_out_event,
    costChangeEvent: raw.cost_change_event,
    costChangeStartFall: raw.cost_change_start_fall,
    inDreamteam: raw.in_dreamteam,
    dreamteamCount: raw.dreamteam_count,

    availability: {
      status: STATUS_MAP[raw.status] ?? "unavailable",
      chanceOfPlayingThis: raw.chance_of_playing_this_round,
      chanceOfPlayingNext: raw.chance_of_playing_next_round,
      news: raw.news,
      newsAdded: raw.news_added,
      scoutRisks: raw.scout_risks,
      scoutNewsLink: raw.scout_news_link,
    },

    setPieceDuties: {
      penalties: {
        order: raw.penalties_order,
        text: raw.penalties_text,
      },
      corners: {
        order: raw.corners_and_indirect_freekicks_order,
        text: raw.corners_and_indirect_freekicks_text,
      },
      directFreekicks: {
        order: raw.direct_freekicks_order,
        text: raw.direct_freekicks_text,
      },
    },
  };
}

// ── Public API ──

export async function fetchBootstrap(): Promise<BootstrapData> {
  const cached = getCached<BootstrapData>("bootstrap");
  if (cached) return cached;

  const raw = await fplFetch<{
    elements: FplPlayerRaw[];
    teams: Team[];
    events: Gameweek[];
    chips: BootstrapChip[];
  }>("/bootstrap-static/");

  const teams = raw.teams;
  const players = raw.elements.map((el) => normalizePlayer(el, teams));
  const gameweeks = raw.events;
  const currentGameweek = gameweeks.find((gw) => gw.is_current) ?? null;
  const chips = raw.chips ?? [];

  const data: BootstrapData = { players, teams, gameweeks, currentGameweek, chips };
  setCache("bootstrap", data);
  return data;
}

export async function fetchEntry(teamId: number): Promise<ManagerEntry> {
  const cached = getCached<ManagerEntry>(`entry-${teamId}`);
  if (cached) return cached;

  const raw = await fplFetch<{
    id: number;
    player_first_name: string;
    player_last_name: string;
    name: string;
    summary_overall_points: number;
    summary_overall_rank: number | null;
    current_event: number;
    last_deadline_bank: number;
    last_deadline_value: number;
  }>(`/entry/${teamId}/`);

  const entry: ManagerEntry = {
    id: raw.id,
    playerFirstName: raw.player_first_name,
    playerLastName: raw.player_last_name,
    name: raw.name,
    summaryOverallPoints: raw.summary_overall_points,
    summaryOverallRank: raw.summary_overall_rank,
    currentEvent: raw.current_event,
    bank: raw.last_deadline_bank / 10,
    squadValue: raw.last_deadline_value / 10,
  };

  setCache(`entry-${teamId}`, entry);
  return entry;
}

export async function fetchPicks(
  teamId: number,
  gw: number
): Promise<PicksResponse> {
  const cached = getCached<PicksResponse>(`picks-${teamId}-${gw}`);
  if (cached) return cached;

  const raw = await fplFetch<{
    picks: PicksResponse["picks"];
    entry_history: {
      bank: number;
      value: number;
      event_transfers: number;
      event_transfers_cost: number;
      points_on_bench: number;
    };
    active_chip: string | null;
  }>(`/entry/${teamId}/event/${gw}/picks/`);

  const data: PicksResponse = {
    picks: raw.picks,
    entry_history: {
      ...raw.entry_history,
      bank: raw.entry_history.bank / 10,
      value: raw.entry_history.value / 10,
    },
    active_chip: raw.active_chip,
  };

  setCache(`picks-${teamId}-${gw}`, data);
  return data;
}

export async function fetchHistory(teamId: number): Promise<ManagerHistory> {
  const cacheKey = `history-${teamId}`;
  const cached = getCached<ManagerHistory>(cacheKey);
  if (cached) return cached;

  const raw = await fplFetch<{
    current: {
      event: number;
      points: number;
      total_points: number;
      rank: number;
      overall_rank: number;
      percentile_rank: number;
      bank: number;
      value: number;
      event_transfers: number;
      event_transfers_cost: number;
      points_on_bench: number;
    }[];
    chips: { name: string; event: number; time: string }[];
    past: { season_name: string; total_points: number; rank: number }[];
  }>(`/entry/${teamId}/history/`);

  const data: ManagerHistory = {
    current: raw.current.map((gw) => ({
      event: gw.event,
      points: gw.points,
      totalPoints: gw.total_points,
      rank: gw.rank,
      overallRank: gw.overall_rank,
      percentileRank: gw.percentile_rank,
      bank: gw.bank / 10,
      value: gw.value / 10,
      eventTransfers: gw.event_transfers,
      eventTransfersCost: gw.event_transfers_cost,
      pointsOnBench: gw.points_on_bench,
    })),
    chips: raw.chips.map((c) => ({
      name: c.name,
      event: c.event,
      time: c.time,
    })),
    past: raw.past.map((s) => ({
      seasonName: s.season_name,
      totalPoints: s.total_points,
      rank: s.rank,
    })),
  };

  setCache(cacheKey, data);
  return data;
}

export async function fetchTransferHistory(teamId: number): Promise<ManagerTransfer[]> {
  const cacheKey = `transfers-${teamId}`;
  const cached = getCached<ManagerTransfer[]>(cacheKey);
  if (cached) return cached;

  const raw = await fplFetch<{
    element_in: number;
    element_in_cost: number;
    element_out: number;
    element_out_cost: number;
    entry: number;
    event: number;
    time: string;
  }[]>(`/entry/${teamId}/transfers/`);

  const data: ManagerTransfer[] = raw.map((t) => ({
    elementIn: t.element_in,
    elementInCost: t.element_in_cost / 10,
    elementOut: t.element_out,
    elementOutCost: t.element_out_cost / 10,
    event: t.event,
    time: t.time,
  }));

  setCache(cacheKey, data);
  return data;
}

const CHIP_NAME_MAP: Record<string, keyof ChipsRemaining> = {
  wildcard: "wildcard",
  freehit: "freeHit",
  bboost: "benchBoost",
  "3xc": "tripleCaptain",
};

export function deriveChipsRemaining(
  usedChips: ChipUsage[],
  bootstrapChips: BootstrapChip[]
): ChipsRemaining {
  const totals: ChipsRemaining = { wildcard: 0, freeHit: 0, benchBoost: 0, tripleCaptain: 0 };

  for (const chip of bootstrapChips) {
    const key = CHIP_NAME_MAP[chip.name];
    if (key) totals[key] += chip.number;
  }

  for (const used of usedChips) {
    const key = CHIP_NAME_MAP[used.name];
    if (key) totals[key] = Math.max(0, totals[key] - 1);
  }

  return totals;
}

export function analyzeTransferPatterns(
  transfers: ManagerTransfer[],
  players: Player[]
): TransferPatterns {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const totalTransfers = transfers.length;

  if (totalTransfers === 0) {
    return {
      totalTransfers: 0,
      kneeJerkRate: 0,
      netValueChange: 0,
      positionBias: { GKP: 0, DEF: 0, MID: 0, FWD: 0 },
      avgHoldDuration: 0,
      transfers,
    };
  }

  // Find completed buy→sell cycles: a player bought in one transfer and sold in a later one
  const buyRecords = new Map<number, ManagerTransfer[]>();
  for (const t of transfers) {
    const existing = buyRecords.get(t.elementIn) ?? [];
    existing.push(t);
    buyRecords.set(t.elementIn, existing);
  }

  let kneeJerkCount = 0;
  let totalCycles = 0;
  let netValue = 0;
  let totalHoldDuration = 0;

  for (const t of transfers) {
    const buys = buyRecords.get(t.elementOut);
    if (!buys || buys.length === 0) continue;

    // Match with the most recent buy of this player that happened before this sale
    const matchingBuy = buys
      .filter((b) => b.event <= t.event)
      .sort((a, b) => b.event - a.event)[0];
    if (!matchingBuy) continue;

    totalCycles++;
    const holdDuration = t.event - matchingBuy.event;
    totalHoldDuration += holdDuration;
    if (holdDuration <= 2) kneeJerkCount++;
    netValue += t.elementOutCost - matchingBuy.elementInCost;

    // Remove the matched buy so it's not double-counted
    const idx = buys.indexOf(matchingBuy);
    buys.splice(idx, 1);
  }

  // Position bias based on players bought
  const positionCounts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  let resolvedCount = 0;
  for (const t of transfers) {
    const player = playerMap.get(t.elementIn);
    if (player) {
      const posKey = player.position === "GK" ? "GKP" : player.position;
      positionCounts[posKey as keyof typeof positionCounts]++;
      resolvedCount++;
    }
  }

  const positionBias = {
    GKP: resolvedCount > 0 ? Math.round((positionCounts.GKP / resolvedCount) * 1000) / 1000 : 0,
    DEF: resolvedCount > 0 ? Math.round((positionCounts.DEF / resolvedCount) * 1000) / 1000 : 0,
    MID: resolvedCount > 0 ? Math.round((positionCounts.MID / resolvedCount) * 1000) / 1000 : 0,
    FWD: resolvedCount > 0 ? Math.round((positionCounts.FWD / resolvedCount) * 1000) / 1000 : 0,
  };

  return {
    totalTransfers,
    kneeJerkRate: totalCycles > 0 ? Math.round((kneeJerkCount / totalCycles) * 100) / 100 : 0,
    netValueChange: Math.round(netValue * 10) / 10,
    positionBias,
    avgHoldDuration: totalCycles > 0 ? Math.round((totalHoldDuration / totalCycles) * 10) / 10 : 0,
    transfers,
  };
}

function computeRiskProfile(
  history: ManagerHistory,
  totalGameweeks: number,
  currentGw: number
): RiskProfile {
  const current = history.current;
  const lastEntry = current[current.length - 1];

  const currentRank = lastEntry?.overallRank ?? 0;
  const bestRank = current.length > 0
    ? Math.min(...current.map((gw) => gw.overallRank).filter((r) => r > 0))
    : 0;

  let rankTrend: RiskProfile["rankTrend"] = "stable";
  if (current.length >= 3) {
    const recentWindow = current.slice(-5);
    const startRank = recentWindow[0].overallRank;
    const endRank = recentWindow[recentWindow.length - 1].overallRank;
    if (startRank > 0) {
      const pctChange = (endRank - startRank) / startRank;
      if (pctChange < -0.05) rankTrend = "rising";
      else if (pctChange > 0.05) rankTrend = "falling";
    }
  }

  const gwsRemaining = Math.max(0, totalGameweeks - currentGw);

  let totalHitsTaken = 0;
  let totalHitCost = 0;
  let totalBenchPoints = 0;
  for (const gw of current) {
    if (gw.eventTransfersCost > 0) {
      totalHitsTaken++;
      totalHitCost += gw.eventTransfersCost;
    }
    totalBenchPoints += gw.pointsOnBench;
  }

  const avgBenchPoints = current.length > 0
    ? Math.round((totalBenchPoints / current.length) * 10) / 10
    : 0;

  return {
    currentRank,
    bestRank,
    rankTrend,
    gwsRemaining,
    totalHitsTaken,
    totalHitCost,
    avgBenchPoints,
  };
}

export async function buildManagerProfile(
  teamId: number,
  bootstrap: BootstrapData
): Promise<ManagerProfile> {
  const [entry, history, transfers] = await Promise.all([
    fetchEntry(teamId),
    fetchHistory(teamId),
    fetchTransferHistory(teamId),
  ]);

  const chipsRemaining = deriveChipsRemaining(history.chips, bootstrap.chips);
  const transferPatterns = analyzeTransferPatterns(transfers, bootstrap.players);

  const totalGameweeks = bootstrap.gameweeks.length;
  const currentGw = bootstrap.currentGameweek?.id ?? totalGameweeks;
  const riskProfile = computeRiskProfile(history, totalGameweeks, currentGw);

  return { entry, history, chipsRemaining, riskProfile, transferPatterns };
}

export async function fetchFixtures(): Promise<Fixture[]> {
  const cached = getCached<Fixture[]>("fixtures");
  if (cached) return cached;

  const data = await fplFetch<Fixture[]>("/fixtures/");
  setCache("fixtures", data);
  return data;
}

export async function fetchElementSummary(
  elementId: number
): Promise<ElementSummary> {
  const cacheKey = `element-${elementId}`;
  const cached = getCached<ElementSummary>(cacheKey);
  if (cached) return cached;

  const raw = await fplFetch<{
    history: ElementSummary["history"];
    history_past: ElementSummary["history_past"];
  }>(`/element-summary/${elementId}/`);

  const data: ElementSummary = {
    history: raw.history,
    history_past: raw.history_past,
  };

  setCache(cacheKey, data);
  return data;
}

export async function fetchLiveEvent(
  gw: number
): Promise<{ elements: { id: number; stats: Record<string, number> }[] }> {
  const cacheKey = `live-${gw}`;
  const cached = getCached<{ elements: { id: number; stats: Record<string, number> }[] }>(cacheKey);
  if (cached) return cached;

  const data = await fplFetch<{
    elements: { id: number; stats: Record<string, number> }[];
  }>(`/event/${gw}/live/`);

  setCache(cacheKey, data);
  return data;
}

export async function fetchSetPieceNotes(): Promise<TeamSetPieceNotes[]> {
  const cached = getCached<TeamSetPieceNotes[]>("set-piece-notes");
  if (cached) return cached;

  const raw = await fplFetch<
    { id: number; notes: { info_message: string }[] }[]
  >("/team/set-piece-notes/");

  const data: TeamSetPieceNotes[] = raw.map((team) => ({
    teamId: team.id,
    notes: team.notes.map((n) => n.info_message),
  }));

  setCache("set-piece-notes", data);
  return data;
}
