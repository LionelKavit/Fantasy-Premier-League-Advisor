import { describe, it, expect } from "vitest";
import { detectCurrentGameweek, detectTargetGameweek, detectInPlayGameweek } from "../gameweek";
import { makeGameweek } from "./factories";

// target-gameweek-alignment: three named gameweeks across the five states of a season.
const T = (s: string) => Date.parse(s);
const season = [
  makeGameweek({ id: 4, deadline_time: "2026-09-12T12:30:00Z", finished: true, is_current: false, is_previous: true }),
  makeGameweek({ id: 5, deadline_time: "2026-09-18T17:30:00Z", finished: false, is_current: true }),
  makeGameweek({ id: 6, deadline_time: "2026-10-10T10:00:00Z", finished: false, is_current: false, is_next: true }),
];

describe("gameweek detection", () => {
  it("preparation week: target = next deadline, in-play null, current = last locked", () => {
    const ev = [
      makeGameweek({ id: 4, deadline_time: "2026-09-12T12:30:00Z", finished: true, is_current: true }),
      makeGameweek({ id: 5, deadline_time: "2026-09-18T17:30:00Z", finished: false, is_current: false, is_next: true }),
    ];
    const now = T("2026-09-16T09:00:00Z");
    expect(detectTargetGameweek(ev, now)?.id).toBe(5);
    expect(detectInPlayGameweek(ev, now)).toBeNull();
    expect(detectCurrentGameweek(ev)?.id).toBe(4);
  });

  it("live round: target = the one after, in-play = the one being played", () => {
    const now = T("2026-09-19T15:00:00Z");
    expect(detectTargetGameweek(season, now)?.id).toBe(6);
    expect(detectInPlayGameweek(season, now)?.id).toBe(5);
    expect(detectCurrentGameweek(season)?.id).toBe(5);
  });

  it("deadline day before the deadline: still preparing the target, nothing in play", () => {
    const ev = [
      makeGameweek({ id: 4, deadline_time: "2026-09-12T12:30:00Z", finished: true, is_current: true }),
      makeGameweek({ id: 5, deadline_time: "2026-09-18T17:30:00Z", finished: false, is_current: false }),
    ];
    const now = T("2026-09-18T17:29:59Z");
    expect(detectTargetGameweek(ev, now)?.id).toBe(5);
    expect(detectInPlayGameweek(ev, now)).toBeNull();
  });

  it("pre-season: target = GW1, nothing current or in play", () => {
    const ev = [
      makeGameweek({ id: 1, deadline_time: "2026-08-21T17:30:00Z", finished: false, is_current: false }),
      makeGameweek({ id: 2, deadline_time: "2026-08-28T17:30:00Z", finished: false, is_current: false }),
    ];
    const now = T("2026-08-01T00:00:00Z");
    expect(detectTargetGameweek(ev, now)?.id).toBe(1);
    expect(detectInPlayGameweek(ev, now)).toBeNull();
    expect(detectCurrentGameweek(ev)).toBeNull();
  });

  it("season over: target falls back to the last finished gameweek", () => {
    const ev = [
      makeGameweek({ id: 37, deadline_time: "2027-05-15T13:00:00Z", finished: true, is_current: false }),
      makeGameweek({ id: 38, deadline_time: "2027-05-23T14:00:00Z", finished: true, is_current: true }),
    ];
    const now = T("2027-06-10T00:00:00Z");
    expect(detectTargetGameweek(ev, now)?.id).toBe(38);
    expect(detectInPlayGameweek(ev, now)).toBeNull();
  });

  it("mid-rollover (no flags, all finished): target = last finished", () => {
    const ev = [makeGameweek({ id: 38, deadline_time: "2026-05-24T14:00:00Z", finished: true, is_current: false })];
    expect(detectTargetGameweek(ev, T("2026-06-20T00:00:00Z"))?.id).toBe(38);
  });
});
