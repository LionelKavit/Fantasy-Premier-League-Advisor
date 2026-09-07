import { describe, it, expect } from "vitest";
import { planCaptureWrite, isPreDeadlineRecord, type LiveCaptureRecord } from "./live-types";

// pool-dump-deadline-guard: a post-deadline capture never overwrites a pre-deadline
// artefact (record or pool), and its pool rows go to a sidecar the builder ignores.

const DEADLINE = "2026-09-12T12:30:00Z";
const before = new Date("2026-09-12T12:29:59Z");
const after = new Date("2026-09-12T12:30:00Z");

function record(o: Partial<LiveCaptureRecord>): LiveCaptureRecord {
  return {
    gw: 4, teamId: 1, capturedAt: "2026-09-12T07:31:00Z", deadline: DEADLINE, postDeadline: false,
    captureMode: "pre-deadline", pipelineGw: 3, xi: [], benchIds: [], actualCaptainId: null,
    appCaptain: null, appVice: null, rankedCandidates: [], baselines: { ppgId: null, ownId: null },
    llm: "unavailable — test", ...o,
  };
}

describe("planCaptureWrite", () => {
  it("pre-deadline: writes the record and the clean pool file", () => {
    const p = planCaptureWrite({ gw: 4, deadline: DEADLINE, now: before, existing: null });
    expect(p).toEqual({
      postDeadline: false, writeRecord: true, poolFile: "gw04.csv", universeFile: "gw04.universe.csv", note: null,
    });
  });

  it("pre-deadline re-capture overwrites an earlier pre-deadline record (last clean capture wins)", () => {
    const p = planCaptureWrite({ gw: 4, deadline: DEADLINE, now: before, existing: record({}) });
    expect(p.writeRecord).toBe(true);
    expect(p.poolFile).toBe("gw04.csv");
    expect(p.universeFile).toBe("gw04.universe.csv");
  });

  it("post-deadline with a clean record: keeps it, pool goes to the sidecar", () => {
    const p = planCaptureWrite({ gw: 4, deadline: DEADLINE, now: after, existing: record({}) });
    expect(p.postDeadline).toBe(true);
    expect(p.writeRecord).toBe(false);
    expect(p.poolFile).toBe("gw04.post-deadline.csv");
    expect(p.universeFile).toBe("gw04.universe.post-deadline.csv");
    expect(p.note).toMatch(/preserved/);
  });

  it("post-deadline with no record: writes the flagged record, pool still to the sidecar", () => {
    const p = planCaptureWrite({ gw: 4, deadline: DEADLINE, now: after, existing: null });
    expect(p.writeRecord).toBe(true);
    expect(p.poolFile).toBe("gw04.post-deadline.csv");
    expect(p.universeFile).toBe("gw04.universe.post-deadline.csv");
    expect(p.note).toMatch(/excluded from scoring/);
  });

  it("post-deadline over an existing post-deadline record: overwrites it (nothing clean to protect)", () => {
    const p = planCaptureWrite({ gw: 4, deadline: DEADLINE, now: after, existing: record({ postDeadline: true }) });
    expect(p.writeRecord).toBe(true);
  });

  it("a retrospective backfill is not a clean capture to protect", () => {
    const p = planCaptureWrite({
      gw: 4, deadline: DEADLINE, now: after, existing: record({ captureMode: "retrospective" }),
    });
    expect(p.writeRecord).toBe(true);
  });

  it("isPreDeadlineRecord treats a missing captureMode as pre-deadline (records before 2026-09-04)", () => {
    expect(isPreDeadlineRecord({ postDeadline: false })).toBe(true);
    expect(isPreDeadlineRecord({ postDeadline: true })).toBe(false);
    expect(isPreDeadlineRecord({ captureMode: "retrospective", postDeadline: false })).toBe(false);
  });
});
