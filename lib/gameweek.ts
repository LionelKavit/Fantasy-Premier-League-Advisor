import type {
  Gameweek,
  Fixture,
  Team,
  Player,
  PlayerFixture,
  GameweekFlags,
} from "./types";

export function detectCurrentGameweek(events: Gameweek[]): Gameweek | null {
  const current = events.find((e) => e.is_current);
  if (current) return current;

  const next = events.find((e) => e.is_next);
  if (next) return next;

  const finished = events.filter((e) => e.finished);
  if (finished.length > 0) return finished[finished.length - 1];

  return null;
}

export function computeTeamFixtureCounts(
  fixtures: Fixture[],
  currentGwId: number
): Map<number, Map<number, number>> {
  // Map<gameweek, Map<teamId, count>>
  const counts = new Map<number, Map<number, number>>();

  for (const f of fixtures) {
    if (f.event === null || f.event < currentGwId) continue;

    if (!counts.has(f.event)) counts.set(f.event, new Map());
    const gwMap = counts.get(f.event)!;

    gwMap.set(f.team_h, (gwMap.get(f.team_h) ?? 0) + 1);
    gwMap.set(f.team_a, (gwMap.get(f.team_a) ?? 0) + 1);
  }

  return counts;
}

export function detectBGW(
  fixtureCounts: Map<number, Map<number, number>>,
  allTeamIds: number[]
): GameweekFlags[] {
  const flags: GameweekFlags[] = [];

  for (const [gw, teamCounts] of fixtureCounts) {
    const blankTeams = allTeamIds.filter(
      (id) => (teamCounts.get(id) ?? 0) === 0
    );
    flags.push({
      gameweek: gw,
      isBGW: blankTeams.length >= 4,
      isDGW: false,
      blankTeams,
      doubleTeams: [],
    });
  }

  return flags;
}

export function detectDGW(
  fixtureCounts: Map<number, Map<number, number>>
): GameweekFlags[] {
  const flags: GameweekFlags[] = [];

  for (const [gw, teamCounts] of fixtureCounts) {
    const doubleTeams: number[] = [];
    for (const [teamId, count] of teamCounts) {
      if (count >= 2) doubleTeams.push(teamId);
    }
    flags.push({
      gameweek: gw,
      isBGW: false,
      isDGW: doubleTeams.length >= 4,
      blankTeams: [],
      doubleTeams,
    });
  }

  return flags;
}

export function detectGameweekFlags(
  fixtures: Fixture[],
  currentGwId: number,
  allTeamIds: number[]
): GameweekFlags[] {
  const fixtureCounts = computeTeamFixtureCounts(fixtures, currentGwId);
  const bgwFlags = detectBGW(fixtureCounts, allTeamIds);
  const dgwFlags = detectDGW(fixtureCounts);

  const merged = new Map<number, GameweekFlags>();

  for (const f of bgwFlags) {
    merged.set(f.gameweek, { ...f });
  }
  for (const f of dgwFlags) {
    const existing = merged.get(f.gameweek);
    if (existing) {
      existing.isDGW = f.isDGW;
      existing.doubleTeams = f.doubleTeams;
    } else {
      merged.set(f.gameweek, { ...f });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.gameweek - b.gameweek);
}

export type FdrEntry = number | null | number[];

export function computeFdrRun(
  teamId: number,
  fixtures: Fixture[],
  currentGwId: number,
  n: number = 5
): { gameweek: number; fdr: FdrEntry }[] {
  const result: { gameweek: number; fdr: FdrEntry }[] = [];

  for (let gw = currentGwId; gw < currentGwId + n; gw++) {
    const gwFixtures = fixtures.filter(
      (f) =>
        f.event === gw && (f.team_h === teamId || f.team_a === teamId)
    );

    if (gwFixtures.length === 0) {
      result.push({ gameweek: gw, fdr: null });
    } else if (gwFixtures.length === 1) {
      const f = gwFixtures[0];
      const fdr =
        f.team_h === teamId ? f.team_h_difficulty : f.team_a_difficulty;
      result.push({ gameweek: gw, fdr });
    } else {
      const fdrs = gwFixtures.map((f) =>
        f.team_h === teamId ? f.team_h_difficulty : f.team_a_difficulty
      );
      result.push({ gameweek: gw, fdr: fdrs });
    }
  }

  return result;
}

export function getPlayerFixtures(
  player: Player,
  fixtures: Fixture[],
  teams: Team[],
  currentGwId: number,
  n: number = 5
): PlayerFixture[] {
  const result: PlayerFixture[] = [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const upcoming = fixtures
    .filter(
      (f) =>
        f.event !== null &&
        f.event >= currentGwId &&
        (f.team_h === player.teamId || f.team_a === player.teamId)
    )
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0));

  for (const f of upcoming) {
    if (result.length >= n) break;

    const isHome = f.team_h === player.teamId;
    const opponentId = isHome ? f.team_a : f.team_h;
    const fdr = isHome ? f.team_h_difficulty : f.team_a_difficulty;
    const opponent = teamMap.get(opponentId);

    result.push({
      gameweek: f.event!,
      opponentId,
      opponentName: opponent?.name ?? "Unknown",
      opponentShortName: opponent?.short_name ?? "UNK",
      fdr,
      isHome,
    });
  }

  return result;
}
