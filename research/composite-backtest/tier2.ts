/**
 * Tier-2 candidate features (evaluated for predictive value; NOT shippable as
 * composite weights until added to the runtime pipeline). All point-in-time:
 * computed from prior rounds + target-GW fixture context only.
 */
import type { Team, Fixture, Position } from "../../lib/types";
import { getPlayerFixtures } from "../../lib/gameweek";
import type { RoundAgg } from "./build-dataset";

const DC_THRESHOLD: Record<Position, number> = { GK: 999, DEF: 10, MID: 12, FWD: 12 };
const ROLL = 4; // rolling window (GWs)

export interface Tier2Ctx {
  teamId: number;
  position: Position;
  fixtures: Fixture[];
  teams: Team[];
  penaltyOrder: number | null;
  hasDc: boolean;
}

export function computeTier2(prior: RoundAgg[], target: RoundAgg, ctx: Tier2Ctx): Record<string, number> {
  const played = prior.filter((a) => a.minutes > 0);
  const recent = played.slice(-ROLL);
  const nineties = (rs: RoundAgg[]) => Math.max(1, rs.reduce((s, a) => s + a.minutes, 0) / 90);

  // 1. DC threshold probability (2025-26 only): share of recent GWs crossing the line.
  const thr = DC_THRESHOLD[ctx.position];
  const t2_dc_threshold_prob = ctx.hasDc && recent.length
    ? recent.filter((a) => a.defensive_contribution >= thr).length / recent.length
    : 0;

  // 2. Own-team attacking strength for the target GW (own attack vs opp defence, home/away),
  //    normalized to ~[0,1] over FPL's ~1000-1400 strength range.
  let t2_team_attack_strength = 0;
  const teamMap = new Map(ctx.teams.map((t) => [t.id, t]));
  const own = teamMap.get(ctx.teamId);
  const pf = getPlayerFixtures(
    { teamId: ctx.teamId } as never, ctx.fixtures, ctx.teams, target.round, 1
  );
  if (own && pf.length) {
    const opp = teamMap.get(pf[0].opponentId);
    if (opp) {
      const ownAtk = pf[0].isHome ? own.strength_attack_home : own.strength_attack_away;
      const oppDef = pf[0].isHome ? opp.strength_defence_away : opp.strength_defence_home;
      // higher own attack + weaker opp defence => higher ceiling
      const raw = ownAtk - oppDef;
      t2_team_attack_strength = clamp01(0.5 + raw / 800);
    }
  }

  // 3. Fixture congestion / rest days (from kickoff_time).
  let t2_days_since_last = 7; // default ~1 week
  let t2_matches_in_7d = 0;
  if (target.kickoff && played.length) {
    const tgt = Date.parse(target.kickoff);
    const priorKos = played.map((a) => Date.parse(a.kickoff)).filter((d) => !Number.isNaN(d) && d < tgt);
    if (!Number.isNaN(tgt) && priorKos.length) {
      const last = Math.max(...priorKos);
      t2_days_since_last = Math.min(14, Math.round((tgt - last) / 86400000));
      t2_matches_in_7d = priorKos.filter((d) => tgt - d <= 7 * 86400000).length;
    }
  }

  // 4. Deterministic set-piece premium (penalty taker) from players_raw order.
  const t2_penalty_taker = ctx.penaltyOrder === 1 ? 1 : 0;

  // Rolling underlying form + finishing over/under-performance.
  const t2_xg90_roll = recent.reduce((s, a) => s + a.expected_goals, 0) / nineties(recent);
  const t2_finishing_roll = recent.reduce((s, a) => s + (a.goals_scored - a.expected_goals), 0) / Math.max(1, recent.length);
  const t2_bps90_roll = recent.reduce((s, a) => s + a.bps, 0) / nineties(recent);

  return {
    t2_dc_threshold_prob: round4(t2_dc_threshold_prob),
    t2_team_attack_strength: round4(t2_team_attack_strength),
    t2_days_since_last,
    t2_matches_in_7d,
    t2_penalty_taker,
    t2_xg90_roll: round4(t2_xg90_roll),
    t2_finishing_roll: round4(t2_finishing_roll),
    t2_bps90_roll: round4(t2_bps90_roll),
  };
}

export const TIER2_COLUMNS = [
  "t2_dc_threshold_prob", "t2_team_attack_strength", "t2_days_since_last", "t2_matches_in_7d",
  "t2_penalty_taker", "t2_xg90_roll", "t2_finishing_roll", "t2_bps90_roll",
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
