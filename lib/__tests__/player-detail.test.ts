import { describe, it, expect } from "vitest";
import type { ElementSummary } from "../types";
import { ageFromBirthDate, buildPlayerDetail } from "../player-detail";
import { makePlayer } from "./factories";

describe("ageFromBirthDate", () => {
  it("computes whole years, accounting for whether the birthday has passed", () => {
    expect(ageFromBirthDate("2000-01-01", new Date("2026-06-22"))).toBe(26);
    expect(ageFromBirthDate("2000-12-31", new Date("2026-06-22"))).toBe(25); // birthday not yet reached
  });

  it("returns null for missing or invalid input", () => {
    expect(ageFromBirthDate(null)).toBeNull();
    expect(ageFromBirthDate(undefined)).toBeNull();
    expect(ageFromBirthDate("not-a-date")).toBeNull();
  });
});

describe("buildPlayerDetail", () => {
  const summary = (mins: number[]): ElementSummary =>
    ({ history: mins.map((m) => ({ minutes: m })), history_past: [] } as unknown as ElementSummary);

  it("merges the player with the latest history entry", () => {
    const player = makePlayer({
      id: 5,
      webName: "Saka",
      fullName: "Bukayo Saka",
      optaCode: "p241",
      region: 241,
      teamShortName: "ARS",
      position: "MID",
      price: 10,
      form: 5.5,
      epNext: 6.2,
      eventPoints: 9,
      birthDate: "2001-09-05",
    });
    const d = buildPlayerDetail(player, summary([70, 90]));
    expect(d).toMatchObject({
      id: 5,
      webName: "Saka",
      fullName: "Bukayo Saka",
      position: "MID",
      team: "ARS",
      price: 10,
      regionId: 241,
      optaCode: "p241",
      form: 5.5,
      epNext: 6.2,
      pointsLastWeek: 9,
      minutesLastWeek: 90, // last history entry
    });
    expect(d.age).toBeGreaterThan(20);
  });

  it("sets minutesLastWeek to null when there's no history yet", () => {
    expect(buildPlayerDetail(makePlayer({}), summary([])).minutesLastWeek).toBeNull();
    expect(buildPlayerDetail(makePlayer({}), null).minutesLastWeek).toBeNull();
  });
});
