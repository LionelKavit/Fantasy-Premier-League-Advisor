import type { Fixture, Team, Position } from "../types";
import type { ScoredPlayer } from "../pipeline/types";
import type { ValidTransfer, HorizonEntry, HorizonGwScore } from "./types";
import { computeFixtureSignals } from "../pipeline/fixture-analyzer";
import { computeCompositeScore } from "../pipeline/composite-scorer";
import { computeFdrRun } from "../gameweek";
import { HORIZON_TIMING } from "../config";

const MAX_GW = 38;
const HORIZON_GWS = 5;
const BOARD_SIZE = 5;

// A gameweek's fixture difficulty on one scale (horizon-fixture-timing): a single fixture
// is its FDR; a double is the mean minus the DGW bonus (two fixtures ≈ two easier steps);
// a blank is the penalty difficulty — the one thing a horizon must never miss.
export function effectiveFdr(fdr: number | number[] | null): number {
  if (fdr === null) return HORIZON_TIMING.blankPenaltyFdr;
  if (Array.isArray(fdr)) {
    const mean = fdr.reduce((s, v) => s + v, 0) / fdr.length;
    return mean - HORIZON_TIMING.dgwBonusSteps;
  }
  return fdr;
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

/**
 * The transfer horizon: for the top valid transfers (ranked by composite gw1Gain — the
 * ranking is unchanged), rescore the target gameweek and the four after it, keep only
 * swaps whose composite gain stays positive (the level gate), decide WHEN from the raw
 * per-gameweek fixture edge (the only input that varies across the window — read
 * pre-squash so it keeps its magnitude), then dedupe by candidate and prefer one entry
 * per position, backfilling to five. `currentGw` is the TARGET gameweek.
 */
export function computeHorizon(
  validTransfers: ValidTransfer[],
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number
): HorizonEntry[] {
  const horizonLength = Math.min(HORIZON_GWS, MAX_GW - currentGw + 1);
  if (horizonLength <= 0) return [];

  const ranked = [...validTransfers].sort((a, b) => b.gw1Gain - a.gw1Gain);

  // One entry per candidate — the highest-gain pairing wins (Tzolakis was listed twice
  // on 2026-09-12, against Scherpen and against Kinsky).
  const seenCandidate = new Set<number>();
  const deduped = ranked.filter((vt) => {
    const id = vt.candidate.player.id;
    if (seenCandidate.has(id)) return false;
    seenCandidate.add(id);
    return true;
  });

  // Level gate: a swap that never gains is dropped, not labelled.
  const gated = deduped
    .map((vt) => buildEntry(vt, fixtures, teams, currentGw, horizonLength))
    .filter((e) => e.cumulativeGain[e.cumulativeGain.length - 1] > 0);

  // One per position first (in rank order), then backfill from the rest.
  const positions = new Set<Position>();
  const firstPass: HorizonEntry[] = [];
  const rest: HorizonEntry[] = [];
  for (const e of gated) {
    const pos = e.candidate.player.position;
    if (positions.has(pos)) rest.push(e);
    else {
      positions.add(pos);
      firstPass.push(e);
    }
  }
  return [...firstPass, ...rest].slice(0, BOARD_SIZE);
}

function buildEntry(
  vt: ValidTransfer,
  fixtures: Fixture[],
  teams: Team[],
  currentGw: number,
  horizonLength: number
): HorizonEntry {
  const gwScores: HorizonGwScore[] = [];
  const perGwGains: number[] = [];

  for (let offset = 0; offset < horizonLength; offset++) {
    const gw = currentGw + offset;
    const candidateScore = rescoreForGw(vt.candidate, fixtures, teams, gw);
    const weakScore = rescoreForGw(vt.weakPlayer, fixtures, teams, gw);
    const candidateFixture = computeFixtureSignals(vt.candidate.player, fixtures, teams, gw);
    gwScores.push({ gw, candidateScore, weakScore, fdr: candidateFixture.gw1Fdr });
    perGwGains.push(candidateScore - weakScore);
  }

  const cumulativeGain: number[] = [];
  let running = 0;
  for (const gain of perGwGains) {
    running += gain;
    cumulativeGain.push(running);
  }
  while (cumulativeGain.length < HORIZON_GWS) {
    cumulativeGain.push(cumulativeGain[cumulativeGain.length - 1]);
  }

  // Timing from the raw fixture edge (horizon-fixture-timing).
  const candRun = computeFdrRun(vt.candidate.player.teamId, fixtures, currentGw, horizonLength);
  const weakRun = computeFdrRun(vt.weakPlayer.player.teamId, fixtures, currentGw, horizonLength);
  const fixtureEdge = candRun.map((c, i) => effectiveFdr(weakRun[i]?.fdr ?? null) - effectiveFdr(c.fdr));
  const nearEdge = mean(fixtureEdge.slice(0, HORIZON_TIMING.nearGws));
  const farSlice = fixtureEdge.slice(HORIZON_TIMING.nearGws);
  const farEdge = farSlice.length ? mean(farSlice) : nearEdge;
  const candidateBlanksNow = candRun[0]?.fdr === null;
  const δ = HORIZON_TIMING.thresholdSteps;

  let timing: HorizonEntry["timing"];
  if (candidateBlanksNow || nearEdge < farEdge - δ) timing = "WAIT";
  else if (nearEdge > farEdge + δ) timing = "SHORT_TERM";
  else timing = "BUY_NOW";

  return {
    candidate: vt.candidate,
    weakPlayer: vt.weakPlayer,
    gwScores,
    cumulativeGain,
    fixtureEdge,
    nearEdge,
    farEdge,
    timing,
  };
}

function rescoreForGw(sp: ScoredPlayer, fixtures: Fixture[], teams: Team[], gw: number): number {
  const newFixture = computeFixtureSignals(sp.player, fixtures, teams, gw);
  const score = computeCompositeScore(
    sp.statisticalSignals,
    sp.trendSignals,
    newFixture,
    sp.marketSignals,
    sp.llmSignals,
    sp.player.position,
    sp.player.minutes
  );
  return score.total;
}
