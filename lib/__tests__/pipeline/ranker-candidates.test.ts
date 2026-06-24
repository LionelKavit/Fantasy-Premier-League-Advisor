import { describe, it, expect } from "vitest";
import { identifyWeakSpots, findCandidates } from "../../pipeline/squad-ranker";
import type { ScoredPlayer, LlmContextSignals } from "../../pipeline/types";
import type { ElementSummary, Player } from "../../types";
import { makeScoredPlayer, makePlayer, makeAvailability } from "../factories";

const reasons = (weak: ReturnType<typeof identifyWeakSpots>) => weak.flatMap((w) => w.whyWeak).join(" | ");

describe("identifyWeakSpots — whyWeak reasons", () => {
  it("flags poor fixtures, SELL trend, and rotation risk", () => {
    const r = reasons(identifyWeakSpots([
      makeScoredPlayer({ total: 0.3, fixtureSignals: { gw5AvgFdr: 4.0 } }),
      makeScoredPlayer({ total: 0.2, trendSignals: { classification: "SELL" } }),
      makeScoredPlayer({ total: 0.1, llmSignals: { rotationRisk: 0.7 } }),
    ]));
    expect(r).toMatch(/poor fixture run/i);
    expect(r).toMatch(/falling xg/i);
    expect(r).toMatch(/rotation risk/i);
  });

  it("flags injury (with news), suspension (with threshold), and low value", () => {
    const r = reasons(identifyWeakSpots([
      makeScoredPlayer({ total: 0.3, llmSignals: { injurySeverity: 0.6 }, player: { availability: makeAvailability({ news: "Hamstring" }) } }),
      makeScoredPlayer({ total: 0.2, statisticalSignals: { suspensionRisk: 0.8 }, player: { yellowCards: 4 } }),
      makeScoredPlayer({ total: 0.1, statisticalSignals: { valueScore: 0.3 } }),
    ]));
    expect(r).toMatch(/injury concern: hamstring/i);
    expect(r).toMatch(/suspension risk: 4 yellow cards \(ban at 5\)/i);
    expect(r).toMatch(/low value score/i);
  });

  it("flags poor form, defensive xGC, and minutes risk", () => {
    const r = reasons(identifyWeakSpots([
      makeScoredPlayer({ total: 0.3, statisticalSignals: { formSignal: 2.0 } }),
      makeScoredPlayer({ total: 0.2, player: { position: "DEF" }, statisticalSignals: { xgcRate: 1.6 } }),
      makeScoredPlayer({ total: 0.1, statisticalSignals: { minutesReliability: 0.4 }, player: { availability: makeAvailability({ chanceOfPlayingNext: 30 }) } }),
    ]));
    expect(r).toMatch(/poor recent form/i);
    expect(r).toMatch(/expected goals conceded/i);
    expect(r).toMatch(/availability concern/i);
  });

  it("flags SELL_RISK and falls back when nothing else applies", () => {
    const r = reasons(identifyWeakSpots([
      makeScoredPlayer({ total: 0.3, trendSignals: { classification: "SELL_RISK" } }),
      makeScoredPlayer({ total: 0.2 }),
      makeScoredPlayer({ total: 0.1 }),
    ]));
    expect(r).toMatch(/regression risk/i);
    expect(r).toMatch(/low composite score relative to squad/i);
  });
});

describe("findCandidates", () => {
  it("filters unavailable and club-full players, flags budget fit", () => {
    const weak = makeScoredPlayer({ total: 0.3, player: { id: 1, position: "MID", price: 6, teamId: 1 } });
    const validCand = makePlayer({ id: 50, position: "MID", price: 6.5, teamId: 2, minutes: 1800, pointsPerGame: 6 });
    const injuredCand = makePlayer({ id: 51, position: "MID", price: 6, teamId: 4, minutes: 1800, availability: makeAvailability({ status: "injured" }) });
    const clubFullCand = makePlayer({ id: 52, position: "MID", price: 6, teamId: 9, minutes: 1800 });
    const allPlayers: Player[] = [validCand, injuredCand, clubFullCand];

    const existingTeamIds = new Map<number, number>([[9, 3]]); // team 9 already full, weak not on team 9
    const scoredCache = new Map<number, ScoredPlayer>([[weak.player.id, weak]]);
    const elementSummaries = new Map<number, ElementSummary>();
    const llmCache = new Map<number, LlmContextSignals>();

    const cands = findCandidates(weak, allPlayers, 1.0, existingTeamIds, scoredCache, [], [], 20, elementSummaries, llmCache, 5);
    const ids = cands.map((c) => c.candidate.player.id);
    expect(ids).toContain(50);
    expect(ids).not.toContain(51); // injured
    expect(ids).not.toContain(52); // 3-per-club
    expect(cands.find((c) => c.candidate.player.id === 50)!.fitsBudget).toBe(true);
  });
});
