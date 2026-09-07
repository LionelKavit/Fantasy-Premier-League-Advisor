import { describe, it, expect } from "vitest";
import type { Gameweek } from "../../lib/types";
import {
  captureWindow, pendingScoreGws, awaitingDataCheck, missedWindows, applyStep, emptyState,
} from "../live-eval-logic";

const gw = (id: number, deadline: string, o: Partial<Gameweek> = {}): Gameweek =>
  ({ id, name: `Gameweek ${id}`, deadline_time: deadline, finished: false, data_checked: false,
     is_previous: false, is_current: false, is_next: false, ...o }) as Gameweek;

const EVENTS = [
  gw(3, "2026-09-04T17:30:00Z", { finished: true, data_checked: true }),
  gw(4, "2026-09-12T12:30:00Z", { finished: true, data_checked: false }),
  gw(5, "2026-09-18T17:30:00Z"),
  gw(6, "2026-10-10T10:00:00Z"),
];

describe("captureWindow", () => {
  it("outside the window: next future deadline, not in window", () => {
    const w = captureWindow(EVENTS, new Date("2026-09-18T10:00:00Z"));
    expect(w.target?.id).toBe(5);
    expect(w.inWindow).toBe(false);
    expect(w.hoursLeft).toBeCloseTo(7.5, 3);
  });
  it("inside the window (≤ 5h)", () => {
    const w = captureWindow(EVENTS, new Date("2026-09-18T13:00:00Z"));
    expect(w.target?.id).toBe(5);
    expect(w.inWindow).toBe(true);
  });
  it("skips finished gameweeks and past deadlines", () => {
    const w = captureWindow(EVENTS, new Date("2026-09-12T13:00:00Z"));
    expect(w.target?.id).toBe(5); // GW4's deadline passed 30 min ago
  });
  it("no upcoming deadline → null target", () => {
    expect(captureWindow(EVENTS, new Date("2027-01-01T00:00:00Z")).target).toBeNull();
  });
});

describe("pendingScoreGws / awaitingDataCheck", () => {
  const records = [
    { gw: 3, postDeadline: false },
    { gw: 4, postDeadline: false },
    { gw: 5, postDeadline: false },
    { gw: 2, postDeadline: false, captureMode: "retrospective" },
  ];
  it("only finished + data_checked, clean, newer than lastScoredGw", () => {
    expect(pendingScoreGws(records, EVENTS, 0)).toEqual([3]);
    expect(pendingScoreGws(records, EVENTS, 3)).toEqual([]);
  });
  it("finished but not data_checked is 'awaiting'", () => {
    expect(awaitingDataCheck(records, EVENTS, 3)).toEqual([4]);
  });
  it("post-deadline and retrospective records never trigger scoring", () => {
    const dirty = [{ gw: 3, postDeadline: true }, { gw: 3, postDeadline: false, captureMode: "retrospective" }];
    expect(pendingScoreGws(dirty, EVENTS, 0)).toEqual([]);
  });
});

describe("missedWindows", () => {
  const now = new Date("2026-09-13T09:00:00Z");
  it("a passed deadline with no clean record is missed", () => {
    expect(missedWindows([{ gw: 3, postDeadline: false }], EVENTS, now, [])).toEqual([4]);
  });
  it("a post-deadline-only record still counts as missed", () => {
    expect(missedWindows([{ gw: 4, postDeadline: true }], EVENTS, now, [])).toEqual([3, 4]);
  });
  it("already-alerted GWs and future deadlines are excluded", () => {
    expect(missedWindows([], EVENTS, now, [3, 4])).toEqual([]);
  });
  it("lookback: deadlines older than 14 days are ignored", () => {
    // 2026-10-05: GW3/GW4 (Sep 4/12) are >14 days old, GW5 (Sep 18) is 17 days old, GW6 is future.
    expect(missedWindows([], EVENTS, new Date("2026-10-05T00:00:00Z"), [])).toEqual([]);
    // 2026-10-01: GW5 (13 days ago) is still inside the lookback.
    expect(missedWindows([], EVENTS, new Date("2026-10-01T00:00:00Z"), [])).toEqual([5]);
  });
});

describe("applyStep", () => {
  it("first failure records the error, no alert; second consecutive alerts once; success resets", () => {
    const s = emptyState();
    let r = applyStep(s, "score", false, "t1", "boom");
    expect(r.alert).toBe(false);
    expect(r.state.failures.score).toBe(1);
    expect(r.state.lastError?.message).toBe("boom");
    r = applyStep(r.state, "score", false, "t2", "boom again");
    expect(r.alert).toBe(true);
    r = applyStep(r.state, "score", false, "t3", "still");
    expect(r.alert).toBe(false); // third failure: no repeat alert
    expect(r.state.failures.score).toBe(3);
    r = applyStep(r.state, "score", true, "t4");
    expect(r.state.failures.score).toBe(0);
    expect(r.alert).toBe(false);
  });
});
