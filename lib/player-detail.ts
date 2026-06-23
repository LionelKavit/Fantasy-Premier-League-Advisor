import type { ElementSummary, Player } from "./types";

// The compact per-player detail the dialog shows. Built from the normalized
// bootstrap player (already cached) + the player's element-summary (already
// fetched for squad + candidates by the insights pipeline), so the dialog
// endpoint serves from warm cache without a redundant FPL round-trip.
export interface PlayerDetail {
  id: number;
  webName: string;
  fullName: string;
  position: string; // GK / DEF / MID / FWD
  team: string; // team short name
  price: number;
  age: number | null; // from birth_date; null when unpublished
  regionId: number | null; // FPL region id → lib/fpl-regions.ts
  form: number;
  epNext: number | null; // projected points next GW
  pointsLastWeek: number; // event_points (most recent GW)
  minutesLastWeek: number | null; // latest element-summary history; null until warm
  optaCode: string | null; // for the premierleague.com link
}

/** Whole years from an ISO birth date; null if missing/invalid/out-of-range. */
export function ageFromBirthDate(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** Merge a normalized player + (optional) element-summary into PlayerDetail. */
export function buildPlayerDetail(player: Player, summary: ElementSummary | null): PlayerDetail {
  const history = summary?.history;
  const last = history && history.length > 0 ? history[history.length - 1] : null;
  return {
    id: player.id,
    webName: player.webName,
    fullName: player.fullName,
    position: player.position,
    team: player.teamShortName,
    price: player.price,
    age: ageFromBirthDate(player.birthDate),
    regionId: player.region,
    form: player.form,
    epNext: player.epNext,
    pointsLastWeek: player.eventPoints,
    minutesLastWeek: last ? last.minutes : null,
    optaCode: player.optaCode,
  };
}
