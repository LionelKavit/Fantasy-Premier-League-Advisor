import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readCsv } from "./csv";

export const DATA_ROOT = join(process.cwd(), "historical_data", "data");

export function listSeasons(): string[] {
  return readdirSync(DATA_ROOT)
    .filter((d) => /^\d{4}-\d{2}$/.test(d))
    .sort();
}

export interface SeasonData {
  season: string;
  /** All per-GW player rows for the season, with `round` parsed. */
  gwRows: Record<string, string>[];
  /** round (GW) -> rows */
  byRound: Map<number, Record<string, string>[]>;
  fixtures: Record<string, string>[];
  teams: Record<string, string>[];
  /** team id -> short_name, and name/short_name -> id (for joining gw `team`) */
  teamById: Map<number, Record<string, string>>;
  teamIdByName: Map<string, number>;
  /** has the per-GW expected_* columns / xP / starts / defensive_contribution */
  has: { xP: boolean; xg: boolean; starts: boolean; dc: boolean };
}

export function loadSeason(season: string): SeasonData | null {
  const dir = join(DATA_ROOT, season);
  const merged = join(dir, "gws", "merged_gw.csv");
  if (!existsSync(merged)) return null;

  const gwRows = readCsv(merged);
  if (gwRows.length === 0) return null;
  const cols = new Set(Object.keys(gwRows[0]));

  const byRound = new Map<number, Record<string, string>[]>();
  for (const r of gwRows) {
    const gw = Number(r.GW ?? r.round);
    if (!Number.isFinite(gw)) continue;
    (byRound.get(gw) ?? byRound.set(gw, []).get(gw)!).push(r);
  }

  const teams = existsSync(join(dir, "teams.csv")) ? readCsv(join(dir, "teams.csv")) : [];
  const teamById = new Map<number, Record<string, string>>();
  const teamIdByName = new Map<string, number>();
  for (const t of teams) {
    const id = Number(t.id);
    teamById.set(id, t);
    if (t.name) teamIdByName.set(t.name, id);
    if (t.short_name) teamIdByName.set(t.short_name, id);
  }

  const fixtures = existsSync(join(dir, "fixtures.csv")) ? readCsv(join(dir, "fixtures.csv")) : [];

  return {
    season,
    gwRows,
    byRound,
    fixtures,
    teams,
    teamById,
    teamIdByName,
    has: {
      xP: cols.has("xP"),
      xg: cols.has("expected_goals"),
      starts: cols.has("starts"),
      dc: cols.has("defensive_contribution"),
    },
  };
}
