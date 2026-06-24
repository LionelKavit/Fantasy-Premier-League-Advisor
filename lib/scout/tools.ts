import type Anthropic from "@anthropic-ai/sdk";
import type { Player, Position } from "../types";
import type { ScoredPlayer } from "../pipeline/types";
import type { ScoutContext } from "./context";
import { scorePlayer, scorePlayerEnriched, resolvePlayer } from "./context";
import { buildValidTransfers } from "../optimizer/setup";
import { computeCaptainScore } from "../captain/scoring";
import { simulateTransfer, simulateCaptain } from "../simulate";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

// ── Tool schemas advertised to the model ────────────────────────────────────
export const SCOUT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_plan",
    description:
      "Deterministic snapshot of the manager's current gameweek situation: bank, chips remaining, free transfers, weak spots, the single highest-gain legal transfer, and the best captain in the XI. Use this first to ground any advice.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_squad",
    description: "The manager's current 15-man squad with per-player stats and starting/bench status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "score_player",
    description: "Look up and score any Premier League player by name or id. Returns price, form, projected points, composite score and key signals.",
    input_schema: {
      type: "object",
      properties: { player: { type: "string", description: "Player web name (e.g. 'Saka') or numeric id." } },
      required: ["player"],
    },
  },
  {
    name: "search_players",
    description: "Find players matching filters, ranked by a metric. Use to discover transfer targets.",
    input_schema: {
      type: "object",
      properties: {
        position: { type: "string", enum: ["GK", "DEF", "MID", "FWD"] },
        maxPrice: { type: "number", description: "Maximum price in £m." },
        team: { type: "string", description: "Team short name (e.g. 'ARS')." },
        sortBy: { type: "string", enum: ["score", "form", "ppg", "epNext", "price"], description: "Ranking metric (default: score)." },
        limit: { type: "number", description: "Max results (default 8, capped at 15)." },
      },
    },
  },
  {
    name: "compare_players",
    description: "Score two or more players side by side by name or id.",
    input_schema: {
      type: "object",
      properties: { players: { type: "array", items: { type: "string" }, description: "Player names or ids." } },
      required: ["players"],
    },
  },
  {
    name: "simulate_transfer",
    description: "What-if a single transfer: checks legality (budget, 3-per-team, availability) and reports the score and price delta. Does NOT execute anything.",
    input_schema: {
      type: "object",
      properties: {
        out: { type: "string", description: "Squad player to transfer out (name or id)." },
        in: { type: "string", description: "Player to bring in (name or id)." },
      },
      required: ["out", "in"],
    },
  },
  {
    name: "simulate_captain",
    description: "What-if captaining a given player this gameweek: returns their captain score versus the best current XI option.",
    input_schema: {
      type: "object",
      properties: { player: { type: "string", description: "Player to captain (name or id)." } },
      required: ["player"],
    },
  },
];

// ── Compact serializers ──────────────────────────────────────────────────────
function fmtPlayer(sp: ScoredPlayer) {
  const p = sp.player;
  return {
    id: p.id,
    name: p.webName,
    team: p.teamShortName,
    position: p.position,
    price: p.price,
    form: p.form,
    pointsPerGame: p.pointsPerGame,
    epNext: p.epNext,
    selectedByPercent: p.selectedByPercent,
    status: p.availability.status,
    compositeScore: Number(sp.score.total.toFixed(2)),
  };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
type ToolInput = Record<string, unknown>;

export async function runScoutTool(
  name: string,
  rawInput: unknown,
  sc: ScoutContext,
  opts: { freeTransfers: number }
): Promise<unknown> {
  const input = (rawInput ?? {}) as ToolInput;
  try {
    switch (name) {
      case "get_plan":
        return getPlan(sc, opts.freeTransfers);
      case "get_squad":
        return getSquad(sc);
      case "score_player":
        return await scorePlayerTool(String(input.player ?? ""), sc);
      case "search_players":
        return searchPlayers(input, sc);
      case "compare_players":
        return await comparePlayers(input.players, sc);
      case "simulate_transfer":
        return await simulateTransferTool(input, sc);
      case "simulate_captain":
        return await simulateCaptainTool(input, sc);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Tool execution failed." };
  }
}

function getPlan(sc: ScoutContext, freeTransfers: number) {
  const { analysis } = sc.ctx;

  const counts = new Map<number, number>();
  for (const sp of analysis.rankedSquad) {
    counts.set(sp.player.teamId, (counts.get(sp.player.teamId) ?? 0) + 1);
  }
  const valid = buildValidTransfers(analysis, analysis.bank, counts);
  const bestTransfer = valid.reduce<(typeof valid)[number] | null>(
    (best, vt) => (!best || vt.gw1Gain > best.gw1Gain ? vt : best),
    null
  );

  const xiIds = new Set(analysis.picks.filter((p) => p.position <= 11).map((p) => p.element));
  let bestCaptain: { name: string; score: number; isDgw: boolean } | null = null;
  for (const sp of analysis.rankedSquad) {
    if (!xiIds.has(sp.player.id)) continue;
    const cs = computeCaptainScore(sp, sc.ctx.fixtures, sc.ctx.teams, analysis.currentGw);
    if (!bestCaptain || cs.total > bestCaptain.score) {
      bestCaptain = { name: sp.player.webName, score: Number(cs.total.toFixed(2)), isDgw: cs.isDgw };
    }
  }

  return {
    currentGw: analysis.currentGw,
    bank: analysis.bank,
    freeTransfers,
    chipsRemaining: analysis.chipsRemaining,
    weakSpots: analysis.weakSpots.map((w) => ({
      player: w.player.player.webName,
      position: w.player.player.position,
      whyWeak: w.whyWeak,
      topTarget: w.targets[0]?.candidate.player.webName ?? null,
    })),
    suggestedTransfer: bestTransfer
      ? {
          out: bestTransfer.weakPlayer.player.webName,
          in: bestTransfer.candidate.player.webName,
          gw1Gain: Number(bestTransfer.gw1Gain.toFixed(2)),
          priceDelta: bestTransfer.priceDelta,
        }
      : null,
    bestCaptain,
  };
}

function getSquad(sc: ScoutContext) {
  const scoredById = new Map(sc.ctx.analysis.rankedSquad.map((sp) => [sp.player.id, sp]));
  return {
    squad: [...sc.ctx.analysis.picks]
      .sort((a, b) => a.position - b.position)
      .map((pick) => {
        const sp = scoredById.get(pick.element);
        return {
          slot: pick.position,
          isStarting: pick.position <= 11,
          ...(sp ? fmtPlayer(sp) : { id: pick.element, name: "Unknown" }),
        };
      }),
  };
}

async function scorePlayerTool(query: string, sc: ScoutContext) {
  const player = resolvePlayer(query, sc);
  if (!player) return { error: `No player found matching "${query}".` };
  const sp = await scorePlayerEnriched(player, sc);
  return {
    ...fmtPlayer(sp),
    teamName: player.teamName,
    signals: {
      goalThreat: Number(sp.statisticalSignals.goalThreat.toFixed(2)),
      assistPotential: Number(sp.statisticalSignals.assistPotential.toFixed(2)),
      formSignal: Number(sp.statisticalSignals.formSignal.toFixed(2)),
      fixtureScore: Number(sp.fixtureSignals.fdrScore.toFixed(2)),
      hasDgw: sp.fixtureSignals.hasDgw,
      hasBgw: sp.fixtureSignals.hasBgw,
    },
  };
}

function searchPlayers(input: ToolInput, sc: ScoutContext) {
  const position = typeof input.position === "string" ? (input.position.toUpperCase() as Position) : null;
  const maxPrice = typeof input.maxPrice === "number" ? input.maxPrice : null;
  const team = typeof input.team === "string" ? input.team.toUpperCase() : null;
  const sortBy = typeof input.sortBy === "string" ? input.sortBy : "score";
  const limit = Math.min(typeof input.limit === "number" ? input.limit : 8, 15);

  if (position && !POSITIONS.includes(position)) {
    return { error: `Invalid position "${input.position}". Use GK, DEF, MID or FWD.` };
  }

  let pool: Player[] = sc.ctx.players.filter((p) => p.minutes > 0 && p.availability.status !== "unavailable");
  if (position) pool = pool.filter((p) => p.position === position);
  if (maxPrice !== null) pool = pool.filter((p) => p.price <= maxPrice);
  if (team) pool = pool.filter((p) => p.teamShortName.toUpperCase() === team);

  if (pool.length === 0) return { results: [], note: "No players matched those filters." };

  // Cap the scoring work: shortlist by PPG, score the shortlist, then rank.
  const shortlist = [...pool].sort((a, b) => b.pointsPerGame - a.pointsPerGame).slice(0, 40);
  const scored = shortlist.map((p) => scorePlayer(p, sc));

  const metric = (sp: ScoredPlayer): number => {
    switch (sortBy) {
      case "form": return sp.player.form;
      case "ppg": return sp.player.pointsPerGame;
      case "epNext": return sp.player.epNext ?? 0;
      case "price": return sp.player.price;
      default: return sp.score.total;
    }
  };
  scored.sort((a, b) => metric(b) - metric(a));

  return { sortBy, results: scored.slice(0, limit).map(fmtPlayer) };
}

async function comparePlayers(raw: unknown, sc: ScoutContext) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Provide an array of player names or ids to compare." };
  }
  const results = await Promise.all(
    raw.map(async (q) => {
      const player = resolvePlayer(String(q), sc);
      if (!player) return { query: String(q), error: "not found" };
      return fmtPlayer(await scorePlayerEnriched(player, sc));
    })
  );
  return { players: results };
}

async function simulateTransferTool(input: ToolInput, sc: ScoutContext) {
  const outPlayer = resolvePlayer(String(input.out ?? ""), sc);
  const inPlayer = resolvePlayer(String(input.in ?? ""), sc);
  if (!outPlayer) return { error: `Could not find outgoing player "${input.out}".` };
  if (!inPlayer) return { error: `Could not find incoming player "${input.in}".` };
  return simulateTransfer({ outId: outPlayer.id, inId: inPlayer.id }, sc);
}

async function simulateCaptainTool(input: ToolInput, sc: ScoutContext) {
  const player = resolvePlayer(String(input.player ?? ""), sc);
  if (!player) return { error: `Could not find player "${input.player}".` };
  return simulateCaptain({ id: player.id }, sc);
}
