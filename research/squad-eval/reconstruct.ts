/**
 * Shared point-in-time reconstruction for the squad-eval harnesses.
 * Reads the local 2025-26 cache (fetch-cache.ts / fetch-universe.ts) and rebuilds a
 * `Player` from element-summary rows with `round < N` — no lookahead. Used by both the
 * captain replay and the transfer replay so they agree by construction.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Player, Team, Fixture, Position } from "../../lib/types";

export const CACHE = join(import.meta.dirname, "cache");
export const FORM_WINDOW = 5;
const POSITION_MAP: Record<number, Position> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

export const load = (name: string) => JSON.parse(readFileSync(join(CACHE, `${name}.json`), "utf8"));
const num = (v: unknown) => Number(v) || 0;

// ── Reference data (2025-26) ─────────────────────────────────────────────────
export const bootstrap = load("bootstrap");
export const teams = bootstrap.teams as Team[];
export const fixtures = load("fixtures") as Fixture[];
export const totalPlayers: number = bootstrap.total_players;

interface Static { teamId: number; position: Position; webName: string; penaltiesOrder: number | null; }
export const staticById = new Map<number, Static>();
for (const el of bootstrap.elements) {
  staticById.set(el.id, {
    teamId: el.team,
    position: POSITION_MAP[el.element_type] ?? "MID",
    webName: el.web_name,
    penaltiesOrder: el.penalties_order ?? null,
  });
}
export const allElementIds: number[] = bootstrap.elements.map((e: { id: number }) => e.id);

// ── Per-element round history ─────────────────────────────────────────────────
interface Round { round: number; [k: string]: number; }
const roundsById = new Map<number, Round[]>();
function rounds(id: number): Round[] {
  if (roundsById.has(id)) return roundsById.get(id)!;
  const f = join(CACHE, `element-${id}.json`);
  const hist = existsSync(f) ? (load(`element-${id}`).history as Record<string, unknown>[]) : [];
  const keys = ["minutes", "total_points", "goals_scored", "assists", "clean_sheets",
    "goals_conceded", "saves", "bonus", "bps", "yellow_cards", "red_cards", "starts",
    "expected_goals", "expected_assists", "expected_goal_involvements", "expected_goals_conceded",
    "defensive_contribution", "threat", "influence", "selected", "value"];
  const rs = hist.map((h) => {
    const o: Round = { round: num(h.round) };
    for (const k of keys) o[k] = num(h[k]);
    return o;
  });
  roundsById.set(id, rs);
  return rs;
}

/** Realized total_points + minutes for an element in a single GW (sums DGW rows). */
export function realized(id: number, gw: number): { points: number; minutes: number; played: boolean } {
  const rs = rounds(id).filter((r) => r.round === gw);
  return {
    points: rs.reduce((s, r) => s + r.total_points, 0),
    minutes: rs.reduce((s, r) => s + r.minutes, 0),
    played: rs.length > 0,
  };
}

/** Point-in-time Player from rounds < gw (no lookahead). epNext null (ep absent by design). */
export function buildPlayer(id: number, gw: number): Player {
  const st = staticById.get(id)!;
  const prior = rounds(id).filter((r) => r.round < gw).sort((a, b) => a.round - b.round);
  const mins = prior.reduce((s, r) => s + r.minutes, 0);
  const nineties = mins / 90 || 1;
  const games = prior.filter((r) => r.minutes > 0).length || 1;
  const sum = (k: string) => prior.reduce((s, r) => s + (r[k] ?? 0), 0);
  const starts = sum("starts");
  const recent = prior.slice(-FORM_WINDOW);
  const form = recent.length ? recent.reduce((s, r) => s + r.total_points, 0) / recent.length : 0;
  const lastSelected = prior.length ? prior[prior.length - 1].selected : 0;
  const ownershipPct = totalPlayers > 0 ? (lastSelected / totalPlayers) * 100 : 0;

  return {
    id, webName: st.webName, teamId: st.teamId, teamCode: 0, teamName: "", teamShortName: "",
    position: st.position, price: (prior.at(-1)?.value ?? 0) / 10, form,
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
    influence: sum("influence"), creativity: 0, threat: sum("threat"), ictIndex: 0,
    totalPoints: sum("total_points"), eventPoints: 0, pointsPerGame: sum("total_points") / games,
    valueForm: 0, valueSeason: 0, epNext: null, epThis: null, selectedByPercent: ownershipPct,
    transfersIn: 0, transfersOut: 0, transfersInEvent: 0, transfersOutEvent: 0,
    costChangeEvent: 0, costChangeStartFall: 0, inDreamteam: false, dreamteamCount: 0,
    availability: { status: "available", chanceOfPlayingThis: null, chanceOfPlayingNext: null,
      news: "", newsAdded: null, scoutRisks: null, scoutNewsLink: null },
    setPieceDuties: { penalties: { order: st.penaltiesOrder, text: null },
      corners: { order: null, text: null }, directFreekicks: { order: null, text: null } },
  };
}
