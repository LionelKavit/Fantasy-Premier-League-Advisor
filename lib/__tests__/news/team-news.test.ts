import { describe, it, expect, beforeEach } from "vitest";
import {
  htmlToText, _matchPlayerName, getCachedTeamNews, playerNews, _clearTeamNewsCache,
  type TeamNews,
} from "../../news/team-news";
import { makePlayer, makeTeam } from "../factories";

const teams = [makeTeam({ id: 1, name: "Arsenal", short_name: "ARS" }), makeTeam({ id: 2, name: "Manchester United", short_name: "MUN" })];
const players = [
  makePlayer({ id: 10, webName: "Saliba", teamId: 1 }),
  makePlayer({ id: 11, webName: "Ødegaard", teamId: 1 }),
  makePlayer({ id: 20, webName: "B.Fernandes", teamId: 2 }),
  makePlayer({ id: 21, webName: "J.Gomes", teamId: 2 }),
];

describe("htmlToText", () => {
  it("strips tags, scripts, and decodes entities", () => {
    const t = htmlToText(`<div><script>evil()</script>Saliba &amp; Gabriel &#8211; predicted to start</div>`);
    expect(t).not.toMatch(/<|>|script|evil/);
    expect(t).toContain("Saliba & Gabriel - predicted to start");
  });
});

describe("_matchPlayerName", () => {
  it("matches exact web name", () => {
    expect(_matchPlayerName("Saliba", 1, players, teams)).toBe(10);
  });
  it("matches across accents", () => {
    expect(_matchPlayerName("Odegaard", 1, players, teams)).toBe(11);
  });
  it("matches initial-style names by last name", () => {
    expect(_matchPlayerName("Bruno Fernandes", 2, players, teams)).toBe(20);
    expect(_matchPlayerName("João Gomes", 2, players, teams)).toBe(21);
  });
  it("does not cross teams (returns null when not in the team)", () => {
    expect(_matchPlayerName("Saliba", 2, players, teams)).toBeNull();
  });
  it("returns null for an unknown name (never guesses)", () => {
    expect(_matchPlayerName("Totally Unknown", 1, players, teams)).toBeNull();
  });
});

describe("getCachedTeamNews degradation", () => {
  const orig = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { _clearTeamNewsCache(); });
  it("returns undefined with no API key (extraction unavailable, never throws)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(getCachedTeamNews(20, players, teams)).resolves.toBeUndefined();
    if (orig) process.env.ANTHROPIC_API_KEY = orig;
  });
});

describe("playerNews lookup", () => {
  it("reads a player's news from the map, undefined when absent", () => {
    const map = new Map<number, TeamNews>([
      [1, { teamId: 1, players: { 10: { startProbability: 0.9, status: "starter", note: "", sourceUrl: "u" } }, asOf: "", sources: [] }],
    ]);
    expect(playerNews(map, 1, 10)?.startProbability).toBe(0.9);
    expect(playerNews(map, 1, 99)).toBeUndefined();
    expect(playerNews(undefined, 1, 10)).toBeUndefined();
  });
});
