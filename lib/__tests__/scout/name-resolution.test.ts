import { describe, it, expect } from "vitest";
import { foldName, resolvePlayer, suggestPlayers, buildScoutContext } from "../../scout/context";
import { buildScoutSystemPrompt } from "../../scout/system-prompt";
import { makeAnalysisContext, makeScoutContext } from "./helpers";
import { makePlayer } from "../factories";

// player-name-resolution: accent/case-insensitive across web name AND full name, with a
// fixed precedence; misses come back as suggestions, never as a reason.

function ctxWithRealNames() {
  const ac = makeAnalysisContext();
  const extra = [
    makePlayer({ id: 201, webName: "Ødegaard", fullName: "Martin Ødegaard", totalPoints: 90 }),
    makePlayer({ id: 202, webName: "Groß", fullName: "Pascal Groß", totalPoints: 80 }),
    makePlayer({ id: 203, webName: "João Pedro", fullName: "João Pedro Junqueira de Jesus", totalPoints: 70 }),
    makePlayer({ id: 204, webName: "M.Sangaré", fullName: "Mohamed Sangaré", totalPoints: 60 }),
    makePlayer({ id: 205, webName: "Saka", fullName: "Bukayo Saka", totalPoints: 100 }),
    makePlayer({ id: 206, webName: "Sakamoto", fullName: "Ryo Sakamoto", totalPoints: 150 }), // substring decoy, more points
  ];
  ac.players.push(...extra);
  return buildScoutContext(ac);
}

describe("foldName", () => {
  it("strips accents and folds the letters NFD cannot reach", () => {
    expect(foldName("Ødegaard")).toBe("odegaard");
    expect(foldName("Groß")).toBe("gross");
    expect(foldName("João Pedro")).toBe("joao pedro");
    expect(foldName("M.Sangaré")).toBe("m sangare");
    expect(foldName("Łukasz Fabiański")).toBe("lukasz fabianski");
  });
  it("leaves ASCII names unchanged apart from case and punctuation", () => {
    expect(foldName("Saka")).toBe("saka");
    expect(foldName("  B.Fernandes ")).toBe("b fernandes");
  });
});

describe("resolvePlayer", () => {
  const sc = ctxWithRealNames();
  it("resolves accented and special-letter names from plain ASCII", () => {
    expect(resolvePlayer("odegaard", sc)?.id).toBe(201);
    expect(resolvePlayer("gross", sc)?.id).toBe(202);
    expect(resolvePlayer("joao pedro", sc)?.id).toBe(203);
    expect(resolvePlayer("sangare", sc)?.id).toBe(204);
  });
  it("resolves the full name too", () => {
    expect(resolvePlayer("martin odegaard", sc)?.id).toBe(201);
    expect(resolvePlayer("Mohamed Sangare", sc)?.id).toBe(204);
  });
  it("exact web name beats a higher-scoring substring match", () => {
    expect(resolvePlayer("saka", sc)?.id).toBe(205); // not Sakamoto (150 pts)
    expect(resolvePlayer("SAKA", sc)?.id).toBe(205);
  });
  it("still resolves numeric ids and returns null for a real miss", () => {
    expect(resolvePlayer(201, sc)?.webName).toBe("Ødegaard");
    expect(resolvePlayer("201", sc)?.webName).toBe("Ødegaard");
    expect(resolvePlayer("Zzyzx", sc)).toBeNull();
    expect(resolvePlayer("   ", sc)).toBeNull();
  });
});

describe("suggestPlayers", () => {
  const sc = ctxWithRealNames();
  it("offers near misses, highest season total first, capped", () => {
    expect(suggestPlayers("sak", sc)).toEqual(["Sakamoto", "Saka"]);
    expect(suggestPlayers("odegard martin", sc)).toContain("Ødegaard"); // token fallback
    expect(suggestPlayers("Zzyzx", sc)).toEqual([]);
    expect(suggestPlayers("p", sc, 3)).toHaveLength(3);
  });
});

describe("grounding rules are in the prompt", () => {
  it("manager and demo prompts both carry the not-found and owned-player rules", () => {
    const sc = makeScoutContext();
    for (const demo of [false, true]) {
      const sys = buildScoutSystemPrompt(sc, 1, undefined, demo);
      expect(sys).toMatch(/notFound: true means the NAME did not match/);
      expect(sys).toMatch(/Never infer injury, absence, a transfer, or unavailability/);
      expect(sys).toMatch(/A transfer target is NEVER a player already owned/);
      expect(sys).toMatch(/lineup call/);
    }
  });
});
