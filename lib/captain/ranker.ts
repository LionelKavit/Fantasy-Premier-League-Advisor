import type { Fixture } from "../types";
import type { CaptainCandidate } from "./types";
import { CAPTAIN_CONFIG } from "../config";

export function rankCaptains(candidates: CaptainCandidate[]): CaptainCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.captainScore.total !== a.captainScore.total) {
      return b.captainScore.total - a.captainScore.total;
    }
    // Tiebreaker: higher minutes certainty, then easier fixture.
    const mcA = a.captainScore.breakdown.minutesCertainty ?? 0;
    const mcB = b.captainScore.breakdown.minutesCertainty ?? 0;
    if (mcB !== mcA) return mcB - mcA;
    const fxA = a.captainScore.breakdown.fixtureMultiplier ?? 0;
    const fxB = b.captainScore.breakdown.fixtureMultiplier ?? 0;
    return fxB - fxA;
  });
}

// Fixture ids a player's team is involved in for the gameweek.
function fixtureIdsInGw(
  teamId: number,
  fixtures: Fixture[],
  gameweek: number
): Set<number> {
  return new Set(
    fixtures
      .filter(
        (f) =>
          f.event === gameweek && (f.team_h === teamId || f.team_a === teamId)
      )
      .map((f) => f.id)
  );
}

export function selectCaptaincy(
  ranked: CaptainCandidate[],
  fixtures: Fixture[],
  gameweek: number
): {
  captain: CaptainCandidate;
  viceCaptain: CaptainCandidate | null;
  differentialOption: CaptainCandidate | null;
} {
  const viable = ranked.filter((c) => c.captainScore.total > 0);
  const captain = viable[0] ?? ranked[0];

  const captainMatches = fixtureIdsInGw(captain.player.player.teamId, fixtures, gameweek);

  // Vice: highest-ranked OTHER candidate whose fixture(s) don't overlap the captain's.
  let viceCaptain: CaptainCandidate | null = null;
  for (const c of viable) {
    if (c === captain) continue;
    const matches = fixtureIdsInGw(c.player.player.teamId, fixtures, gameweek);
    const overlaps = [...matches].some((id) => captainMatches.has(id));
    if (!overlaps) {
      viceCaptain = c;
      break;
    }
  }
  // Last resort: next-best candidate even if it shares the captain's match.
  if (!viceCaptain) {
    viceCaptain = viable.find((c) => c !== captain) ?? null;
  }

  // Differential: a high-ceiling, low-owned candidate within a band of the top score.
  const threshold = captain.captainScore.total * CAPTAIN_CONFIG.differentialBand;
  let differentialOption: CaptainCandidate | null = null;
  for (const c of viable) {
    if (c === captain) continue;
    if (c.isDifferential && c.captainScore.total >= threshold) {
      differentialOption = c;
      break;
    }
  }

  return { captain, viceCaptain, differentialOption };
}
