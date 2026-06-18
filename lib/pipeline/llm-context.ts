import type { Player, TeamSetPieceNotes } from "../types";
import type { LlmContextSignals } from "./types";
import { LLM_SIGNAL_RANGES } from "../config";
import { llm } from "../llm/client";

const DEFAULT_SIGNALS: LlmContextSignals = {
  rotationRisk: 0,
  oopBonus: 0,
  injurySeverity: 0,
  tacticalBoost: 0,
  opponentKeyAbsence: 0,
  setPieceHierarchy: {
    penaltyTaker: null,
    cornerTaker: null,
    freeKickTaker: null,
  },
};

export async function batchComputeLlmContext(
  players: Player[],
  teamSetPieceNotes: TeamSetPieceNotes[],
  opponentPlayers: Player[]
): Promise<Map<number, LlmContextSignals>> {
  const result = new Map<number, LlmContextSignals>();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      "[llm-context] ANTHROPIC_API_KEY not set — using neutral defaults"
    );
    for (const p of players) result.set(p.id, { ...DEFAULT_SIGNALS });
    return result;
  }

  try {
    const notesByTeam = new Map(
      teamSetPieceNotes.map((t) => [t.teamId, t.notes])
    );

    const opponentsByTeam = new Map<number, Player[]>();
    for (const op of opponentPlayers) {
      const existing = opponentsByTeam.get(op.teamId) ?? [];
      existing.push(op);
      opponentsByTeam.set(op.teamId, existing);
    }

    const playerContexts = players.map((p) => {
      const teamNotes = notesByTeam.get(p.teamId) ?? [];

      const opponentInjuries: string[] = [];
      for (const [oppTeamId, oppPlayers] of opponentsByTeam) {
        if (oppTeamId === p.teamId) continue;
        const injured = oppPlayers
          .filter(
            (op) =>
              op.availability.status !== "available" &&
              op.totalPoints > 0
          )
          .sort((a, b) => b.totalPoints - a.totalPoints)
          .slice(0, 5);
        for (const inj of injured) {
          opponentInjuries.push(
            `${inj.webName} (${inj.teamName}, ${inj.position}): ${inj.availability.status} - "${inj.availability.news}"`
          );
        }
      }

      return {
        id: p.id,
        name: p.webName,
        position: p.position,
        team: p.teamName,
        starts: p.starts,
        minutes: p.minutes,
        form: p.form,
        news: p.availability.news || "None",
        status: p.availability.status,
        chanceOfPlayingNext: p.availability.chanceOfPlayingNext,
        setPieceNotes: teamNotes.join("; ") || "No notes",
        goalsScored: p.goalsScored,
        expectedGoals: p.expectedGoals,
        threat: p.threat,
        creativity: p.creativity,
        opponentInjuries: opponentInjuries.slice(0, 10).join("; ") || "None known",
      };
    });

    const prompt = buildPrompt(playerContexts);
    const text = await llm.complete({ prompt, maxTokens: 4096 });

    const parsed = parseResponse(text, players);
    for (const [id, signals] of parsed) {
      result.set(id, clampSignals(signals));
    }

    // Fill in any missing players with defaults
    for (const p of players) {
      if (!result.has(p.id)) result.set(p.id, { ...DEFAULT_SIGNALS });
    }
  } catch (error) {
    console.error("[llm-context] API call failed, using defaults:", error);
    for (const p of players) result.set(p.id, { ...DEFAULT_SIGNALS });
  }

  return result;
}

function buildPrompt(
  players: {
    id: number;
    name: string;
    position: string;
    team: string;
    starts: number;
    minutes: number;
    form: number;
    news: string;
    status: string;
    chanceOfPlayingNext: number | null;
    setPieceNotes: string;
    goalsScored: number;
    expectedGoals: number;
    threat: number;
    creativity: number;
    opponentInjuries: string;
  }[]
): string {
  const playerList = players
    .map(
      (p) =>
        `- ID:${p.id} ${p.name} (${p.position}, ${p.team}): starts=${p.starts}, mins=${p.minutes}, form=${p.form}, news="${p.news}", status=${p.status}, chanceNext=${p.chanceOfPlayingNext ?? "null"}, setPieces="${p.setPieceNotes}", goals=${p.goalsScored}, xG=${p.expectedGoals}, threat=${p.threat}, creativity=${p.creativity}, opponentInjuries="${p.opponentInjuries}"`
    )
    .join("\n");

  return `You are an FPL (Fantasy Premier League) analyst. Analyze these players and return a JSON array with one object per player.

Players:
${playerList}

For each player, return:
{
  "id": <player_id>,
  "rotationRisk": <0-1, based on starts ratio, squad depth, manager rotation patterns>,
  "oopBonus": <0-0.10, if a MID plays as striker or DEF plays advanced>,
  "injurySeverity": <0-1, based on news text: 0=fit, 0.2=knock, 0.5=minor, 0.7=moderate, 1.0=serious>,
  "tacticalBoost": <-0.05 to 0.10, team form/tactical changes>,
  "opponentKeyAbsence": <0-0.05, if opponent has key injuries>,
  "setPieceHierarchy": { "penaltyTaker": <name or null>, "cornerTaker": <name or null>, "freeKickTaker": <name or null> }
}

Return ONLY valid JSON — an array of objects. No explanation.`;
}

function parseResponse(
  text: string,
  players: Player[]
): Map<number, LlmContextSignals> {
  const result = new Map<number, LlmContextSignals>();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return result;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return result;

    const playerIds = new Set(players.map((p) => p.id));

    for (const entry of parsed) {
      if (!entry.id || !playerIds.has(entry.id)) continue;

      result.set(entry.id, {
        rotationRisk: typeof entry.rotationRisk === "number" ? entry.rotationRisk : 0,
        oopBonus: typeof entry.oopBonus === "number" ? entry.oopBonus : 0,
        injurySeverity: typeof entry.injurySeverity === "number" ? entry.injurySeverity : 0,
        tacticalBoost: typeof entry.tacticalBoost === "number" ? entry.tacticalBoost : 0,
        opponentKeyAbsence: typeof entry.opponentKeyAbsence === "number" ? entry.opponentKeyAbsence : 0,
        setPieceHierarchy: {
          penaltyTaker: entry.setPieceHierarchy?.penaltyTaker ?? null,
          cornerTaker: entry.setPieceHierarchy?.cornerTaker ?? null,
          freeKickTaker: entry.setPieceHierarchy?.freeKickTaker ?? null,
        },
      });
    }
  } catch {
    console.error("[llm-context] Failed to parse LLM response");
  }

  return result;
}

function clampSignals(signals: LlmContextSignals): LlmContextSignals {
  return {
    rotationRisk: clamp(signals.rotationRisk, ...LLM_SIGNAL_RANGES.rotationRisk),
    oopBonus: clamp(signals.oopBonus, ...LLM_SIGNAL_RANGES.oopBonus),
    injurySeverity: clamp(signals.injurySeverity, ...LLM_SIGNAL_RANGES.injurySeverity),
    tacticalBoost: clamp(signals.tacticalBoost, ...LLM_SIGNAL_RANGES.tacticalBoost),
    opponentKeyAbsence: clamp(signals.opponentKeyAbsence, ...LLM_SIGNAL_RANGES.opponentKeyAbsence),
    setPieceHierarchy: signals.setPieceHierarchy,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
