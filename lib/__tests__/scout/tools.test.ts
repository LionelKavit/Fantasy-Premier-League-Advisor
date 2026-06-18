import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Targeted tools (score_player, compare_players, simulate_*) lazily enrich via a
// per-player element-summary fetch; stub it offline.
vi.mock("../../fpl-api", () => ({
  fetchElementSummary: vi.fn().mockResolvedValue({ history: [], history_past: [] }),
}));

import { runScoutTool, SCOUT_TOOLS } from "../../scout/tools";
import { makeScoutContext } from "./helpers";
import { clearApiKey, restoreClaude } from "../mock-claude";

beforeEach(() => clearApiKey()); // no key → enrichment skips the LLM pass
afterEach(restoreClaude);

const OPTS = { freeTransfers: 1 };
const run = (name: string, input: unknown = {}) =>
  runScoutTool(name, input, makeScoutContext(), OPTS) as Promise<Record<string, unknown>>;

describe("SCOUT_TOOLS schema", () => {
  it("advertises the expected tool set with object input schemas", () => {
    const names = SCOUT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      ["compare_players", "get_plan", "get_squad", "score_player", "search_players", "simulate_captain", "simulate_transfer"].sort()
    );
    for (const t of SCOUT_TOOLS) expect(t.input_schema.type).toBe("object");
  });
});

describe("runScoutTool dispatch", () => {
  it("get_plan returns a deterministic snapshot", async () => {
    const r = await run("get_plan");
    expect(r.currentGw).toBe(20);
    expect(r.bank).toBe(2.0);
    expect(r.freeTransfers).toBe(1);
    expect(Array.isArray(r.weakSpots)).toBe(true);
    expect(r.bestCaptain).not.toBeNull();
  });

  it("get_squad returns 15 players in slot order", async () => {
    const r = await run("get_squad");
    const squad = r.squad as { slot: number; isStarting: boolean }[];
    expect(squad).toHaveLength(15);
    expect(squad[0].slot).toBe(1);
    expect(squad.filter((p) => p.isStarting)).toHaveLength(11);
  });

  it("score_player resolves by name and returns a composite score", async () => {
    const r = await run("score_player", { player: "Affordable" });
    expect(r.name).toBe("Affordable");
    expect(typeof r.compositeScore).toBe("number");
    expect(r.signals).toBeDefined();
  });

  it("score_player returns a structured error for an unknown name", async () => {
    const r = await run("score_player", { player: "Nobody" });
    expect(r.error).toMatch(/no player found/i);
  });

  it("search_players filters by position and ranks results", async () => {
    const r = await run("search_players", { position: "MID", limit: 5 });
    const results = r.results as { position: string }[];
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.every((p) => p.position === "MID")).toBe(true);
  });

  it("search_players rejects an invalid position", async () => {
    const r = await run("search_players", { position: "STRIKER" });
    expect(r.error).toMatch(/invalid position/i);
  });

  it("compare_players scores each requested player", async () => {
    const r = await run("compare_players", { players: ["P1", "Affordable"] });
    const players = r.players as { name?: string }[];
    expect(players).toHaveLength(2);
    expect(players.map((p) => p.name)).toContain("Affordable");
  });

  it("compare_players errors on a non-array input", async () => {
    const r = await run("compare_players", { players: "P1" });
    expect(r.error).toBeDefined();
  });

  it("simulate_transfer resolves names and delegates to the simulator", async () => {
    const r = await run("simulate_transfer", { out: "P1", in: "Affordable" });
    expect(r.legal).toBe(true);
  });

  it("simulate_transfer errors when a name cannot be resolved", async () => {
    const r = await run("simulate_transfer", { out: "Ghost", in: "Affordable" });
    expect(r.error).toMatch(/outgoing player/i);
  });

  it("simulate_captain returns a captain score", async () => {
    const r = await run("simulate_captain", { player: "Premium" });
    expect(typeof r.captainScore).toBe("number");
    expect(r.captainScore).toBeGreaterThan(0);
  });

  it("returns an error for an unknown tool", async () => {
    const r = await run("does_not_exist");
    expect(r.error).toMatch(/unknown tool/i);
  });
});
