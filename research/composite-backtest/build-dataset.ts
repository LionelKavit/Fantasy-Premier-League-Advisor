/**
 * composite-backtest — Phase 1 dataset builder.
 *
 * Reads the cloned vaastav archive (all seasons), rebuilds a POINT-IN-TIME
 * player state for each (season × gameweek × player) from PRIOR gameweeks,
 * runs the app's REAL signal code to compute the composite + its Tier-1
 * components, attaches the next-3-GW realized-points label, and writes one
 * long-format CSV. Market signals are neutral (they don't feed the composite).
 *
 * Approximations (documented; revisit as Tier-2 work):
 *  - set-piece duties: null (deterministic set-piece is a tracked Tier-2 gap)
 *  - availability.chanceOfPlayingNext: null historically (→ factor 1)
 *  - ownership/transfer market signals: neutral (excluded from the composite)
 */
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Player, Fixture, Team, Position, PlayerGameweekHistory } from "../../lib/types";
import { computeStatisticalSignals } from "../../lib/pipeline/statistical-scoring";
import { computeFixtureSignals } from "../../lib/pipeline/fixture-analyzer";
import { computeTrendSignals } from "../../lib/pipeline/trend-analyzer";
import { computeCompositeScore, buildSignalMap } from "../../lib/pipeline/composite-scorer";
import type { MarketSignals } from "../../lib/pipeline/types";
import { listSeasons, loadSeason, DATA_ROOT, type SeasonData } from "./load";
import { num, readCsv, writeCsv } from "./csv";
import { computeTier2, TIER2_COLUMNS } from "./tier2";
import { existsSync } from "node:fs";

const NEUTRAL_MARKET: MarketSignals = {
  priceMovement: 0, ownershipScore: 0, transferMomentum: 0, epNextSignal: 0.5, differentialValue: 1,
};
const NEUTRAL_LLM = {
  rotationRisk: 0, oopBonus: 0, injurySeverity: 0, tacticalBoost: 0, opponentKeyAbsence: 0,
  setPieceHierarchy: { penaltyTaker: null, cornerTaker: null, freeKickTaker: null },
};
const FORM_WINDOW = 4; // prior GWs averaged for `form` (≈ FPL's 30-day form)

// The union of normalized signal-map keys across positions (the exact inputs the
// SCORING_WEIGHTS multiply). Emitted per row as `sm_<key>` so Phase 2's ridge
// coefficients map 1:1 to SCORING_WEIGHTS. `sm_epNextSignal` is the new candidate.
const SM_KEYS = [
  "goalThreat", "assistPotential", "form", "bonus", "fixture", "minutes", "value",
  "cleanSheet", "xgcRate", "defensive", "goalAssistSetPiece", "saves", "suspensionPenalty",
];
const SM_COLUMNS = [...SM_KEYS.map((k) => `sm_${k}`), "sm_epNextSignal"];

function normPos(p: string): Position {
  const u = p.toUpperCase();
  if (u.startsWith("GK")) return "GK";
  if (u === "DEF") return "DEF";
  if (u === "FWD" || u === "FW") return "FWD";
  return "MID";
}

// One aggregated record per (element, round) — sums DGW rows together.
export interface RoundAgg {
  round: number;
  minutes: number; starts: number; total_points: number;
  goals_scored: number; assists: number; clean_sheets: number; goals_conceded: number;
  saves: number; bonus: number; bps: number; influence: number;
  yellow_cards: number; red_cards: number; defensive_contribution: number;
  expected_goals: number; expected_assists: number; expected_goal_involvements: number; expected_goals_conceded: number;
  value: number; xP: number; team: string; name: string; position: Position;
  kickoff: string; // earliest kickoff_time seen for the round (for congestion)
}

export function aggregateSeason(d: SeasonData): Map<number, Map<number, RoundAgg>> {
  const byElement = new Map<number, Map<number, RoundAgg>>();
  for (const r of d.gwRows) {
    const el = num(r.element);
    const round = num(r.GW ?? r.round);
    if (!el || !round) continue;
    let rounds = byElement.get(el);
    if (!rounds) byElement.set(el, (rounds = new Map()));
    let a = rounds.get(round);
    if (!a) {
      a = { round, minutes: 0, starts: 0, total_points: 0, goals_scored: 0, assists: 0,
        clean_sheets: 0, goals_conceded: 0, saves: 0, bonus: 0, bps: 0, influence: 0,
        yellow_cards: 0, red_cards: 0, defensive_contribution: 0, expected_goals: 0,
        expected_assists: 0, expected_goal_involvements: 0, expected_goals_conceded: 0,
        value: 0, xP: 0, team: r.team ?? "", name: r.name ?? "", position: normPos(r.position ?? "MID"),
        kickoff: r.kickoff_time ?? "" };
      rounds.set(round, a);
    }
    a.minutes += num(r.minutes); a.starts += num(r.starts); a.total_points += num(r.total_points);
    a.goals_scored += num(r.goals_scored); a.assists += num(r.assists);
    a.clean_sheets += num(r.clean_sheets); a.goals_conceded += num(r.goals_conceded);
    a.saves += num(r.saves); a.bonus += num(r.bonus); a.bps += num(r.bps);
    a.influence += num(r.influence); a.yellow_cards += num(r.yellow_cards); a.red_cards += num(r.red_cards);
    a.defensive_contribution += num(r.defensive_contribution);
    a.expected_goals += num(r.expected_goals); a.expected_assists += num(r.expected_assists);
    a.expected_goal_involvements += num(r.expected_goal_involvements);
    a.expected_goals_conceded += num(r.expected_goals_conceded);
    a.value = num(r.value) || a.value; a.xP += num(r.xP); a.team = r.team || a.team; a.name = r.name || a.name;
    if (r.kickoff_time && (!a.kickoff || r.kickoff_time < a.kickoff)) a.kickoff = r.kickoff_time;
  }
  return byElement;
}

function mapFixtures(d: SeasonData): Fixture[] {
  return d.fixtures.map((f) => ({
    id: num(f.id), event: f.event === "" ? 0 : num(f.event),
    team_h: num(f.team_h), team_a: num(f.team_a),
    team_h_difficulty: num(f.team_h_difficulty), team_a_difficulty: num(f.team_a_difficulty),
    team_h_score: null, team_a_score: null, kickoff_time: f.kickoff_time || null,
    finished: f.finished === "True", stats: [],
  }));
}

function mapTeams(d: SeasonData): Team[] {
  return d.teams.map((t) => ({
    id: num(t.id), name: t.name ?? "", short_name: t.short_name ?? "", strength: num(t.strength),
    strength_overall_home: num(t.strength_overall_home), strength_overall_away: num(t.strength_overall_away),
    strength_attack_home: num(t.strength_attack_home), strength_attack_away: num(t.strength_attack_away),
    strength_defence_home: num(t.strength_defence_home), strength_defence_away: num(t.strength_defence_away),
    played: 0, win: 0, draw: 0, loss: 0, points: 0, position: 0, form: null,
  }));
}

function historyFrom(prior: RoundAgg[]): PlayerGameweekHistory[] {
  return prior.map((a) => ({
    round: a.round, total_points: a.total_points, minutes: a.minutes,
    goals_scored: a.goals_scored, assists: a.assists,
    expected_goals: String(a.expected_goals), expected_assists: String(a.expected_assists),
    expected_goal_involvements: String(a.expected_goal_involvements),
    expected_goals_conceded: String(a.expected_goals_conceded),
    clean_sheets: a.clean_sheets, goals_conceded: a.goals_conceded, saves: a.saves,
    bonus: a.bonus, bps: a.bps, influence: String(a.influence), creativity: "0", threat: "0",
    starts: a.starts, was_home: false, opponent_team: 0, value: a.value,
    yellow_cards: a.yellow_cards, red_cards: a.red_cards, own_goals: 0,
    penalties_saved: 0, penalties_missed: 0, defensive_contribution: a.defensive_contribution,
    transfers_balance: 0, selected: 0, transfers_in: 0, transfers_out: 0,
  }));
}

// Point-in-time Player from prior rounds (season-to-date as of before GW N).
function buildPlayer(
  element: number, prior: RoundAgg[], target: RoundAgg, teamId: number, hasStarts: boolean
): Player {
  const mins = prior.reduce((s, a) => s + a.minutes, 0);
  const nineties = mins / 90 || 1;
  const games = prior.filter((a) => a.minutes > 0).length || 1;
  const sum = (k: keyof RoundAgg) => prior.reduce((s, a) => s + (a[k] as number), 0);
  const starts = hasStarts ? sum("starts") : prior.filter((a) => a.minutes >= 60).length;
  const recent = prior.slice(-FORM_WINDOW);
  const form = recent.length ? recent.reduce((s, a) => s + a.total_points, 0) / recent.length : 0;

  return {
    id: element, webName: String(element), teamId, teamCode: 0, teamName: target.team,
    teamShortName: "", position: target.position, price: target.value / 10, form,
    expectedGoalsPer90: sum("expected_goals") / nineties,
    expectedAssistsPer90: sum("expected_assists") / nineties,
    expectedGoalInvolvementsPer90: sum("expected_goal_involvements") / nineties,
    expectedGoalsConcededPer90: sum("expected_goals_conceded") / nineties,
    goalsConcededPer90: sum("goals_conceded") / nineties, savesPer90: sum("saves") / nineties,
    startsPer90: starts / nineties, cleanSheetsPer90: sum("clean_sheets") / nineties,
    defensiveContributionPer90: sum("defensive_contribution") / nineties,
    minutes: mins, starts, goalsScored: sum("goals_scored"), assists: sum("assists"),
    cleanSheets: sum("clean_sheets"), goalsConceded: sum("goals_conceded"), ownGoals: 0,
    penaltiesSaved: 0, penaltiesMissed: 0, yellowCards: sum("yellow_cards"), redCards: sum("red_cards"),
    saves: sum("saves"), bonus: sum("bonus"), bps: sum("bps"),
    defensiveContribution: sum("defensive_contribution"),
    expectedGoals: sum("expected_goals"), expectedAssists: sum("expected_assists"),
    expectedGoalInvolvements: sum("expected_goal_involvements"),
    expectedGoalsConceded: sum("expected_goals_conceded"),
    influence: sum("influence"), creativity: 0, threat: 0, ictIndex: 0,
    totalPoints: sum("total_points"), eventPoints: 0, pointsPerGame: sum("total_points") / games,
    valueForm: 0, valueSeason: 0, epNext: target.xP, epThis: target.xP, selectedByPercent: 0,
    transfersIn: 0, transfersOut: 0, transfersInEvent: 0, transfersOutEvent: 0,
    costChangeEvent: 0, costChangeStartFall: 0, inDreamteam: false, dreamteamCount: 0,
    availability: { status: "available", chanceOfPlayingThis: null, chanceOfPlayingNext: null,
      news: "", newsAdded: null, scoutRisks: null, scoutNewsLink: null },
    setPieceDuties: { penalties: { order: null, text: null }, corners: { order: null, text: null },
      directFreekicks: { order: null, text: null } },
  };
}

const MIN_PRIOR_GWS = 2;   // need some history to roll up
const MIN_SEASON_MINUTES = 270; // mirror runtime minMinutes filter (flag, not drop)

interface OutRow { [k: string]: unknown }

/** element -> penalties_order, from the season-end players_raw snapshot (approximate, point-in-time). */
function loadPenaltyOrders(season: string): Map<number, number | null> {
  const f = join(DATA_ROOT, season, "players_raw.csv");
  const m = new Map<number, number | null>();
  if (!existsSync(f)) return m;
  for (const r of readCsv(f)) {
    const id = num(r.id);
    const ord = r.penalties_order === "" || r.penalties_order === undefined ? null : num(r.penalties_order);
    if (id) m.set(id, ord);
  }
  return m;
}

export function buildSeasonRows(d: SeasonData): OutRow[] {
  const byElement = aggregateSeason(d);
  const fixtures = mapFixtures(d);
  const teams = mapTeams(d);
  const penaltyOrders = loadPenaltyOrders(d.season);
  // Per-round max xP — the offline analog of the runtime's `maxEpNext` (max ep_next
  // across the current player pool). Normalizing each player's xP by THIS (not the
  // season's single best-ever GW) keeps `epNextSignal` on the same scale the runtime
  // feeds (`epNext / maxEpNext`), so the fitted weights + squash transfer faithfully.
  const roundMaxXp = new Map<number, number>();
  for (const rm of byElement.values())
    for (const a of rm.values()) roundMaxXp.set(a.round, Math.max(roundMaxXp.get(a.round) ?? 0, a.xP));
  const rounds = [...d.byRound.keys()].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1] ?? 0;
  const out: OutRow[] = [];

  for (const [element, roundMap] of byElement) {
    const ordered = [...roundMap.values()].sort((a, b) => a.round - b.round);
    for (const target of ordered) {
      const N = target.round;
      if (N + 2 > maxRound) continue; // need a full next-3 label window
      const prior = ordered.filter((a) => a.round < N);
      if (prior.length < MIN_PRIOR_GWS) continue;

      // next-3-GW realized points (sums DGW automatically via the round aggregates)
      let label = 0, labelGws = 0;
      for (let k = N; k <= N + 2; k++) { const a = roundMap.get(k); if (a) { label += a.total_points; labelGws++; } }

      const teamId = d.teamIdByName.get(target.team) ?? 0;
      const player = buildPlayer(element, prior, target, teamId, d.has.starts);
      const stats = computeStatisticalSignals(player, N);
      const fx = teams.length ? computeFixtureSignals(player, fixtures, teams, N)
        : { fdrScore: 0, homeRatio: 0, dgwBonus: 0, opponentStrength: 0, gw1Fdr: 5, gw5AvgFdr: 5, hasBgw: false, hasDgw: false };
      const trend = computeTrendSignals(historyFrom(prior), []);
      // Real epNext signal (xP normalized) so the backtested composite reflects the
      // epNext-anchored runtime composite, not the neutral placeholder.
      const rMax = roundMaxXp.get(N) ?? 0;
      const epNextSignalVal = rMax > 0 ? Math.max(0, Math.min(1, target.xP / rMax)) : 0.5;
      const market = { ...NEUTRAL_MARKET, epNextSignal: epNextSignalVal };
      const score = computeCompositeScore(stats, trend, fx, market, NEUTRAL_LLM, player.position, player.minutes);

      const t2 = computeTier2(prior, target, {
        teamId, position: player.position, fixtures, teams,
        penaltyOrder: penaltyOrders.get(element) ?? null, hasDc: d.has.dc,
      });

      // Normalized signal-map (the exact weighted inputs) — for Phase 2's fit.
      const sm = buildSignalMap(stats, fx, player.position);
      const smCols: Record<string, number> = {};
      for (const k of SM_KEYS) smCols[`sm_${k}`] = round4(sm[k] ?? 0);
      smCols.sm_epNextSignal = round4(epNextSignalVal);

      out.push({
        ...t2, ...smCols,
        season: d.season, gw: N, element, position: player.position, name: target.name, team: target.team,
        // composite + components (Tier-1)
        composite: round4(score.total), trend_adj: round4(score.trendAdjustment),
        goalThreat: round4(stats.goalThreat), assistPotential: round4(stats.assistPotential),
        formSignal: round4(stats.formSignal), bonusEfficiency: round4(stats.bonusEfficiency),
        cleanSheetRate: round4(stats.cleanSheetRate), defensiveScore: round4(stats.defensiveScore),
        savesRate: round4(stats.savesRate), minutesReliability: round4(stats.minutesReliability),
        fdrScore: round4(fx.fdrScore), opponentStrength: round4(fx.opponentStrength),
        // baselines
        xP: round4(target.xP), ppg: round4(player.pointsPerGame),
        // label + flags
        next3_points: label, label_gws: labelGws,
        season_minutes: player.minutes, low_minute: player.minutes < MIN_SEASON_MINUTES ? 1 : 0,
        // availability tags — `has_fixture`=0 means the season lacked a team mapping
        // (no `team` column / no teams.csv), so fixture signals are degenerate (0).
        has_fixture: teams.length > 0 && teamId > 0 ? 1 : 0,
        has_xP: d.has.xP ? 1 : 0, has_xg: d.has.xg ? 1 : 0, has_dc: d.has.dc ? 1 : 0,
      });
    }
  }
  return out;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

const COLUMNS = [
  "season", "gw", "element", "position", "name", "team",
  "composite", "trend_adj", "goalThreat", "assistPotential", "formSignal", "bonusEfficiency",
  "cleanSheetRate", "defensiveScore", "savesRate", "minutesReliability", "fdrScore", "opponentStrength",
  "xP", "ppg", ...SM_COLUMNS, ...TIER2_COLUMNS,
  "next3_points", "label_gws", "season_minutes", "low_minute", "has_fixture", "has_xP", "has_xg", "has_dc",
];

function main() {
  const only = process.argv[2]; // optional single season for quick runs
  const seasons = only ? [only] : listSeasons();
  const all: OutRow[] = [];
  for (const s of seasons) {
    const d = loadSeason(s);
    if (!d) { console.log(`${s}: skipped (no merged_gw)`); continue; }
    const rows = buildSeasonRows(d);
    all.push(...rows);
    console.log(`${s}: ${rows.length} rows  (xP=${d.has.xP} xg=${d.has.xg} dc=${d.has.dc})`);
  }
  const outDir = join(process.cwd(), "research", "composite-backtest", "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, only ? `dataset_${only}.csv` : "dataset.csv");
  writeCsv(outPath, COLUMNS, all);
  console.log(`\nTOTAL ${all.length} rows -> ${outPath}`);
}

// Only run when executed directly (not when imported by tests/tier2).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
