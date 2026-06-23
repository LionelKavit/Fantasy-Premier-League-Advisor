import { describe, it, expect } from "vitest";
import { buildDemoSquad, deriveDemoSeason } from "../../demo/squad";
import { makePlayer, makeGameweek } from "../factories";
import type { Player, Position } from "../../types";

const REQ: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const ELEMENT_POS: Record<number, Position> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

let id = 1;
function mk(pos: Position, price: number, metric: number, club: number, live: boolean): Player {
  return makePlayer({
    id: id++,
    position: pos,
    price,
    teamId: club,
    totalPoints: metric,
    pointsPerGame: metric / 30,
    epNext: live ? metric / 30 : null,
  });
}

/** A pool with cheap enablers + tempting premiums, spread across many clubs. */
function pool(live = true): Player[] {
  id = 1;
  const p: Player[] = [];
  const spread = (pos: Position, n: number, priceLo: number, metricHi: number) => {
    for (let i = 0; i < n; i++) {
      // distinct descending metric, rising price; each on its own club (1..20)
      p.push(mk(pos, priceLo + i * 0.5, metricHi - i * 3, (p.length % 20) + 1, live));
    }
  };
  spread("GK", 6, 4.0, 90);
  spread("DEF", 14, 4.0, 160);
  spread("MID", 14, 4.5, 260); // includes pricey high-metric premiums
  spread("FWD", 9, 4.5, 240);
  return p;
}

function byId(players: Player[]): Map<number, Player> {
  return new Map(players.map((pl) => [pl.id, pl]));
}

const captainOf = (picks: ReturnType<typeof buildDemoSquad>["picks"]) =>
  picks.picks.find((p) => p.is_captain)!;

describe("deriveDemoSeason", () => {
  const now = Date.parse("2026-06-23T00:00:00Z");

  it("is off-season when every gameweek is finished (summer break)", () => {
    const events = Array.from({ length: 38 }, (_, i) =>
      makeGameweek({ id: i + 1, finished: true, is_current: i === 37, is_next: false, deadline_time: "2026-05-24T13:30:00Z" })
    );
    expect(deriveDemoSeason(events, now)).toBe("offseason");
  });

  it("is live when an unfinished gameweek has a future deadline (next GW)", () => {
    const events = [
      makeGameweek({ id: 20, finished: true, is_current: true, deadline_time: "2026-06-01T00:00:00Z" }),
      makeGameweek({ id: 21, finished: false, is_next: true, deadline_time: "2026-07-01T00:00:00Z" }),
    ];
    expect(deriveDemoSeason(events, now)).toBe("live");
  });

  it("is live mid-week when the current gameweek is unfinished with a future deadline", () => {
    const events = [makeGameweek({ id: 21, finished: false, is_current: true, deadline_time: "2026-07-01T00:00:00Z" })];
    expect(deriveDemoSeason(events, now)).toBe("live");
  });

  it("is off-season when the only unfinished gameweek's deadline is in the past", () => {
    const events = [makeGameweek({ id: 38, finished: false, is_current: true, deadline_time: "2026-05-24T13:30:00Z" })];
    expect(deriveDemoSeason(events, now)).toBe("offseason");
  });
});

describe("buildDemoSquad", () => {
  it("returns a legal 15-man squad shape", () => {
    const { picks } = buildDemoSquad(pool(), "live");
    expect(picks.picks).toHaveLength(15);

    const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const pick of picks.picks) counts[ELEMENT_POS[pick.element_type]]++;
    expect(counts).toEqual(REQ);

    const slots = picks.picks.map((p) => p.position).sort((a, b) => a - b);
    expect(slots).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("respects the £100.0m budget", () => {
    const players = pool();
    const { picks } = buildDemoSquad(players, "live");
    const lookup = byId(players);
    const total = picks.picks.reduce((s, p) => s + (lookup.get(p.element)?.price ?? 0), 0);
    expect(total).toBeLessThanOrEqual(100.0 + 1e-9);
    expect(picks.entry_history.bank).toBe(0);
  });

  it("respects the max-3-per-club rule", () => {
    const players = pool();
    const { picks } = buildDemoSquad(players, "live");
    const lookup = byId(players);
    const clubCounts = new Map<number, number>();
    for (const pick of picks.picks) {
      const tid = lookup.get(pick.element)!.teamId;
      clubCounts.set(tid, (clubCounts.get(tid) ?? 0) + 1);
    }
    for (const c of clubCounts.values()) expect(c).toBeLessThanOrEqual(3);
  });

  it("caps a single club at 3 even when it has the best players", () => {
    const players = pool();
    for (let i = 0; i < 5; i++) players.push(mk("MID", 4.5, 999 - i, 99, true));
    const { picks } = buildDemoSquad(players, "live");
    const lookup = byId(players);
    const fromClub99 = picks.picks.filter((p) => lookup.get(p.element)!.teamId === 99).length;
    expect(fromClub99).toBeLessThanOrEqual(3);
  });

  it("fields a legal starting XI", () => {
    const players = pool();
    const { picks } = buildDemoSquad(players, "live");
    const lookup = byId(players);
    const starters = picks.picks.filter((p) => p.position <= 11);
    expect(starters).toHaveLength(11);

    const sc: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const s of starters) sc[lookup.get(s.element)!.position]++;
    expect(sc.GK).toBe(1);
    expect(sc.DEF).toBeGreaterThanOrEqual(3);
    expect(sc.FWD).toBeGreaterThanOrEqual(1);
  });

  it("designates exactly one captain and one vice among the starters", () => {
    const { picks } = buildDemoSquad(pool(), "live");
    const captains = picks.picks.filter((p) => p.is_captain);
    const vices = picks.picks.filter((p) => p.is_vice_captain);
    expect(captains).toHaveLength(1);
    expect(vices).toHaveLength(1);
    expect(captains[0].position).toBeLessThanOrEqual(11);
    expect(captains[0].multiplier).toBe(2);
    expect(captains[0].element).not.toBe(vices[0].element);
  });

  // ep_next and totalPoints disagree: A is the ep leader, B is the points leader.
  const epLeader = () => makePlayer({ id: 5001, position: "FWD", price: 6.0, teamId: 60, epNext: 50, totalPoints: 10, pointsPerGame: 1 });
  const pointsLeader = () => makePlayer({ id: 5002, position: "FWD", price: 6.0, teamId: 61, epNext: 1, totalPoints: 9000, pointsPerGame: 300 });

  it("ranks on ep_next in a live season", () => {
    const players = [...pool(), epLeader(), pointsLeader()];
    const { picks, season } = buildDemoSquad(players, "live");
    expect(season).toBe("live");
    expect(captainOf(picks).element).toBe(5001); // ep leader
  });

  it("ranks on last-season points off-season, ignoring stale ep_next", () => {
    const players = [...pool(), epLeader(), pointsLeader()]; // ep_next present but stale
    const { picks, season } = buildDemoSquad(players, "offseason");
    expect(season).toBe("offseason");
    expect(captainOf(picks).element).toBe(5002); // points leader
  });

  it("falls back to points in a live season when ep_next isn't populated yet (pre-season)", () => {
    const players = [...pool(false), epLeader(), pointsLeader()]; // pool has null ep_next
    // Only A and B carry ep_next (2 players < the live-ep threshold) → guard → points.
    const { picks } = buildDemoSquad(players, "live");
    expect(captainOf(picks).element).toBe(5002); // points leader
  });

  it("excludes injured players even when they top the metric", () => {
    const players = pool();
    players.push(
      makePlayer({
        id: 9999,
        position: "FWD",
        price: 5.0,
        teamId: 50,
        totalPoints: 5000,
        epNext: 99,
        availability: { status: "injured", chanceOfPlayingThis: 0, chanceOfPlayingNext: 0, news: "Out", newsAdded: null, scoutRisks: null, scoutNewsLink: null },
      })
    );
    const { picks } = buildDemoSquad(players, "live");
    expect(picks.picks.some((p) => p.element === 9999)).toBe(false);
  });
});
