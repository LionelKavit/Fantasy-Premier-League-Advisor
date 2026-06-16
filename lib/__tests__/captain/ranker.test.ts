import { describe, it, expect } from "vitest";
import { rankCaptains, selectCaptaincy } from "../../captain/ranker";
import type { CaptainCandidate } from "../../captain/types";
import { makeCaptainCandidate, makeFixture } from "../factories";

const fixtures = [
  makeFixture({ id: 10, event: 21, team_h: 1, team_a: 2 }),
  makeFixture({ id: 11, event: 21, team_h: 3, team_a: 4 }),
];

describe("rankCaptains", () => {
  it("sorts by captain score descending", () => {
    const ranked = rankCaptains([
      makeCaptainCandidate({ total: 4 }),
      makeCaptainCandidate({ total: 8 }),
      makeCaptainCandidate({ total: 6 }),
    ]);
    expect(ranked.map((c) => c.captainScore.total)).toEqual([8, 6, 4]);
  });

  it("breaks ties on minutes certainty", () => {
    const low: CaptainCandidate = { ...makeCaptainCandidate({ total: 5 }) };
    low.captainScore.breakdown = { minutesCertainty: 0.5, fixtureMultiplier: 1 };
    const high: CaptainCandidate = { ...makeCaptainCandidate({ total: 5 }) };
    high.captainScore.breakdown = { minutesCertainty: 1.0, fixtureMultiplier: 1 };
    const ranked = rankCaptains([low, high]);
    expect(ranked[0]).toBe(high);
  });
});

describe("selectCaptaincy", () => {
  it("picks the top scorer as captain and a vice in a different match", () => {
    const cap = makeCaptainCandidate({ total: 8, player: { player: { teamId: 1, webName: "Cap" } } });
    const sameMatch = makeCaptainCandidate({ total: 7, player: { player: { teamId: 1, webName: "Same" } } });
    const diffMatch = makeCaptainCandidate({ total: 6, player: { player: { teamId: 3, webName: "Diff" } } });
    const { captain, viceCaptain } = selectCaptaincy([cap, sameMatch, diffMatch], fixtures, 21);
    expect(captain.player.player.webName).toBe("Cap");
    expect(viceCaptain?.player.player.webName).toBe("Diff"); // skips the same-match candidate
  });

  it("surfaces a differential option within the band, else null", () => {
    const cap = makeCaptainCandidate({ total: 8, player: { player: { teamId: 1, webName: "Cap" } } });
    const diff = makeCaptainCandidate({ total: 7.5, isDifferential: true, player: { player: { teamId: 5, webName: "Dif" } } });
    const withDiff = selectCaptaincy([cap, diff], fixtures, 21);
    expect(withDiff.differentialOption?.player.player.webName).toBe("Dif");

    const farDiff = makeCaptainCandidate({ total: 3, isDifferential: true, player: { player: { teamId: 5 } } });
    const noDiff = selectCaptaincy([cap, farDiff], fixtures, 21);
    expect(noDiff.differentialOption).toBeNull(); // below the 0.85 band
  });

  it("handles a single viable candidate (no vice/differential)", () => {
    const only = makeCaptainCandidate({ total: 8, player: { player: { teamId: 1 } } });
    const blank = makeCaptainCandidate({ total: 0, player: { player: { teamId: 2 } } });
    const { captain, viceCaptain, differentialOption } = selectCaptaincy([only, blank], fixtures, 21);
    expect(captain).toBe(only);
    expect(viceCaptain).toBeNull();
    expect(differentialOption).toBeNull();
  });
});
