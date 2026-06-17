import type { Position } from "../types";
import type { SquadPlayerView } from "../plan/types";

export interface FormationRow {
  position: Position;
  players: SquadPlayerView[];
}

const ROW_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];

/** Split a squad into formation rows (starting XI) and a bench list, by pick slot. */
export function getFormation(squad: SquadPlayerView[]): {
  rows: FormationRow[];
  bench: SquadPlayerView[];
  formationLabel: string;
} {
  const starting = squad
    .filter((p) => p.isStarting)
    .sort((a, b) => a.pickSlot - b.pickSlot);
  const bench = squad
    .filter((p) => !p.isStarting)
    .sort((a, b) => a.pickSlot - b.pickSlot);

  const rows: FormationRow[] = ROW_ORDER.map((position) => ({
    position,
    players: starting.filter((p) => p.position === position),
  })).filter((r) => r.players.length > 0);

  // e.g. "3-4-3" from the outfield rows
  const formationLabel = rows
    .filter((r) => r.position !== "GK")
    .map((r) => r.players.length)
    .join("-");

  return { rows, bench, formationLabel };
}

/** FPL club-shirt CDN URL (GK variant for keepers). */
export function shirtUrl(teamCode: number, isGk: boolean): string {
  const suffix = isGk ? `${teamCode}_1` : `${teamCode}`;
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${suffix}-110.png`;
}

/** Composite score (0–1) → familiar 0–10 rating. */
export function scoreToRating(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 10;
}

export type RatingTier = "poor" | "ok" | "good";

export function ratingTier(rating: number): RatingTier {
  if (rating >= 6.5) return "good";
  if (rating >= 4) return "ok";
  return "poor";
}
