import type { Player, Pick, PicksResponse, Position, Gameweek } from "../types";

// A synthesized "dream team" for demo mode — a valid 15-man FPL squad picked from
// the live player pool, with no manager behind it. Pure/deterministic from the
// bootstrap snapshot so it caches like any context (see lib/plan/context.ts).

/** Which metric the squad was ranked on — drives honest copy downstream. */
export type DemoSeason = "live" | "offseason";

export interface DemoSquad {
  picks: PicksResponse;
  season: DemoSeason;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const SQUAD_REQUIREMENTS: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const ELEMENT_TYPE: Record<Position, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
const BUDGET_TENTHS = 1000; // £100.0m, in integer tenths to avoid float drift
const MAX_PER_CLUB = 3;
// Minimum players carrying a positive ep_next before we'll rank a *live* season on
// it (a guard for the pre-season window where ep_next isn't published yet).
const LIVE_EP_MIN_PLAYERS = 30;

const priceTenths = (p: Player): number => Math.round(p.price * 10);

/**
 * Is a season actually in progress? Decided by the gameweek calendar — true iff
 * an unfinished gameweek with a future deadline exists. This is the reliable
 * signal: in the summer break the bootstrap keeps serving last season's finished
 * GW38 feed, and those players still carry (stale) `ep_next`, so ep_next presence
 * is NOT a season signal. Off-season now → no upcoming GW; mid-season → the
 * current/next GW is upcoming; pre-season → the new GW1 deadline is in the future.
 */
export function deriveDemoSeason(events: Gameweek[], now: number = Date.now()): DemoSeason {
  const hasUpcoming = events.some(
    (e) => !e.finished && e.deadline_time != null && Date.parse(e.deadline_time) > now
  );
  return hasUpcoming ? "live" : "offseason";
}

/**
 * Build the demo squad for a given season (see `deriveDemoSeason`). Ranks by FPL's
 * `ep_next` in a live season, by last-season `totalPoints` off-season (tie-broken
 * by points-per-game). A guard falls back to `totalPoints` even in a live season
 * if `ep_next` isn't meaningfully populated yet (the pre-season window). Selection
 * is a budget-valid (≤ £100.0m), ≤ 3-per-club greedy fill with a feasibility guard
 * that keeps a legal, fundable remainder — never an over-budget or malformed squad.
 */
export function buildDemoSquad(players: Player[], season: DemoSeason): DemoSquad {
  const liveEpCount = players.filter((p) => (p.epNext ?? 0) > 0).length;
  const rankByEp = season === "live" && liveEpCount >= LIVE_EP_MIN_PLAYERS;
  const metric = (p: Player): number => (rankByEp ? (p.epNext ?? 0) : p.totalPoints);

  // Highest metric first, then points-per-game as a stable tie-break.
  const byMetric = (a: Player, b: Player): number =>
    metric(b) - metric(a) || b.pointsPerGame - a.pointsPerGame || a.id - b.id;

  // Only fieldable players make the dream team.
  const eligible = players.filter((p) => {
    const s = p.availability.status;
    return p.price > 0 && s !== "injured" && s !== "suspended" && s !== "unavailable";
  });

  const byPosMetric: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const byPosPrice: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const pos of POSITIONS) {
    const pool = eligible.filter((p) => p.position === pos);
    byPosMetric[pos] = [...pool].sort(byMetric);
    byPosPrice[pos] = [...pool].sort((a, b) => priceTenths(a) - priceTenths(b) || a.id - b.id);
  }

  // Cheapest cost to fill the remaining quota (a lower bound; ignores the club cap,
  // which rarely binds on cheap enablers). Infinity if a position can't be filled.
  const minCompletionCost = (
    needs: Record<Position, number>,
    pickedIds: Set<number>,
    excludeId: number
  ): number => {
    let cost = 0;
    for (const pos of POSITIONS) {
      let need = needs[pos];
      if (need <= 0) continue;
      for (const p of byPosPrice[pos]) {
        if (need <= 0) break;
        if (p.id === excludeId || pickedIds.has(p.id)) continue;
        cost += priceTenths(p);
        need--;
      }
      if (need > 0) return Infinity;
    }
    return cost;
  };

  const needs: Record<Position, number> = { ...SQUAD_REQUIREMENTS };
  const pickedIds = new Set<number>();
  const clubCounts = new Map<number, number>();
  const selected: Player[] = [];
  let budget = BUDGET_TENTHS;
  const totalNeeds = (): number => POSITIONS.reduce((s, p) => s + needs[p], 0);

  const clubOk = (p: Player): boolean => (clubCounts.get(p.teamId) ?? 0) < MAX_PER_CLUB;

  const apply = (p: Player, pos: Position): void => {
    selected.push(p);
    pickedIds.add(p.id);
    needs[pos]--;
    budget -= priceTenths(p);
    clubCounts.set(p.teamId, (clubCounts.get(p.teamId) ?? 0) + 1);
  };

  while (totalNeeds() > 0) {
    // Best metric pick per still-needed position that stays affordable, within the
    // club cap, and leaves a fundable legal remainder.
    let best: { player: Player; pos: Position } | null = null;
    for (const pos of POSITIONS) {
      if (needs[pos] <= 0) continue;
      for (const cand of byPosMetric[pos]) {
        if (pickedIds.has(cand.id) || !clubOk(cand)) continue;
        const price = priceTenths(cand);
        if (price > budget) continue;
        const after = { ...needs, [pos]: needs[pos] - 1 };
        if (budget - price < minCompletionCost(after, pickedIds, cand.id)) continue;
        if (!best || byMetric(cand, best.player) < 0) best = { player: cand, pos };
        break; // sorted desc → first feasible is this position's best
      }
    }

    // Relaxation: if no feasible metric pick (tight budget), take the cheapest
    // club-legal player in a needed position to guarantee progress.
    if (!best) {
      for (const pos of POSITIONS) {
        if (needs[pos] <= 0) continue;
        const cand = byPosPrice[pos].find(
          (p) => !pickedIds.has(p.id) && clubOk(p) && priceTenths(p) <= budget
        );
        if (cand && (!best || priceTenths(cand) < priceTenths(best.player))) {
          best = { player: cand, pos };
        }
      }
    }
    if (!best) break; // unreachable for a real FPL pool; guards against a loop

    apply(best.player, best.pos);
  }

  return { picks: assemblePicks(selected, metric), season };
}

/**
 * Turn the 15 selected players into a `PicksResponse`: pick a legal starting XI
 * (1 GK + a 3-5 / 2-5 / 1-3 outfield split), designate captain + vice (top-metric
 * starters), and order the bench. Slots 1–11 start; 12–15 are the bench.
 */
function assemblePicks(selected: Player[], metric: (p: Player) => number): PicksResponse {
  const byMetricDesc = (a: Player, b: Player): number =>
    metric(b) - metric(a) || b.pointsPerGame - a.pointsPerGame || a.id - b.id;
  const inPos = (pos: Position): Player[] =>
    selected.filter((p) => p.position === pos).sort(byMetricDesc);

  const gks = inPos("GK");
  const defs = inPos("DEF");
  const mids = inPos("MID");
  const fwds = inPos("FWD");

  // Starting XI: best GK, then position minimums (3 DEF, 2 MID, 1 FWD), then the
  // four highest-metric outfielders left (every total sits at its max, so no cap
  // can be breached).
  const startDef = defs.slice(0, 3);
  const startMid = mids.slice(0, 2);
  const startFwd = fwds.slice(0, 1);
  const restOutfield = [...defs.slice(3), ...mids.slice(2), ...fwds.slice(1)].sort(byMetricDesc);
  const fillers = restOutfield.slice(0, 4);
  const benchOutfield = restOutfield.slice(4).sort(byMetricDesc);

  const starters = [gks[0], ...startDef, ...startMid, ...startFwd, ...fillers];
  // Order the XI GK → DEF → MID → FWD for a natural pitch layout.
  const orderedStarters = [...starters].sort(
    (a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || byMetricDesc(a, b)
  );
  // Bench: reserve GK first, then outfield by metric.
  const bench = [gks[1], ...benchOutfield];

  const captain = [...starters].sort(byMetricDesc)[0];
  const vice = [...starters].sort(byMetricDesc)[1];

  const picks: Pick[] = [];
  orderedStarters.forEach((p, i) => {
    picks.push({
      element: p.id,
      position: i + 1, // 1..11
      multiplier: p.id === captain.id ? 2 : 1,
      is_captain: p.id === captain.id,
      is_vice_captain: p.id === vice.id,
      element_type: ELEMENT_TYPE[p.position],
    });
  });
  bench.forEach((p, i) => {
    picks.push({
      element: p.id,
      position: 12 + i, // 12..15
      multiplier: 0,
      is_captain: false,
      is_vice_captain: false,
      element_type: ELEMENT_TYPE[p.position],
    });
  });

  const value = Math.round(selected.reduce((s, p) => s + p.price, 0) * 10) / 10;

  return {
    picks,
    entry_history: {
      bank: 0,
      value,
      event_transfers: 0,
      event_transfers_cost: 0,
      points_on_bench: 0,
    },
    active_chip: null,
  };
}
