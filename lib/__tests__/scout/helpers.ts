import type Anthropic from "@anthropic-ai/sdk";
import type { AnalysisContext } from "../../plan/types";
import type { ScoutContext } from "../../scout/context";
import { buildScoutContext } from "../../scout/context";
import {
  makeSquad,
  makePlayer,
  makeTeam,
  makeFixture,
  makeSquadAnalysisResult,
  makeManagerProfile,
} from "../factories";
import type { Player } from "../../types";

const CURRENT_GW = 20;

/**
 * A self-contained AnalysisContext: a 15-man squad (ids 1–15, teams 1–5, three
 * each), a few external transfer targets on team 6, teams 1–7, and a GW20 home
 * fixture per team so captain scoring is never blank.
 */
export function makeAnalysisContext(): AnalysisContext {
  const { rankedSquad, picks } = makeSquad();

  const externals: Player[] = [
    makePlayer({ id: 100, webName: "Affordable", position: "MID", teamId: 6, teamShortName: "T6", price: 7.5, form: 6, pointsPerGame: 6, epNext: 6 }),
    makePlayer({ id: 101, webName: "Premium", position: "FWD", teamId: 6, teamShortName: "T6", price: 12.5, form: 8, pointsPerGame: 8, epNext: 8 }),
    makePlayer({ id: 102, webName: "FourthFromTeamOne", position: "DEF", teamId: 1, teamShortName: "T1", price: 5.0, form: 3, pointsPerGame: 3, epNext: 3 }),
    makePlayer({ id: 103, webName: "Benchwarmer", position: "MID", teamId: 7, teamShortName: "T7", price: 4.5, form: 0, pointsPerGame: 0, epNext: 0, minutes: 0 }),
  ];

  const players: Player[] = [...rankedSquad.map((sp) => sp.player), ...externals];

  const teams = Array.from({ length: 7 }, (_, i) => makeTeam({ id: i + 1, short_name: `T${i + 1}` }));

  const fixtures = Array.from({ length: 7 }, (_, i) =>
    makeFixture({ event: CURRENT_GW, team_h: i + 1, team_a: ((i + 1) % 7) + 1, team_h_difficulty: 2, team_a_difficulty: 3 })
  );

  const analysis = makeSquadAnalysisResult({ rankedSquad, picks, bank: 2.0, currentGw: CURRENT_GW });

  return {
    analysis,
    managerProfile: makeManagerProfile(),
    players,
    teams,
    fixtures,
    gwFlags: [],
  };
}

export function makeScoutContext(): ScoutContext {
  return buildScoutContext(makeAnalysisContext());
}

// ── Anthropic message builders for the agentic-loop tests ────────────────────
export function toolUseMessage(
  calls: { id: string; name: string; input: Record<string, unknown> }[],
  text = ""
): Anthropic.Messages.Message {
  const content: Anthropic.ContentBlock[] = [];
  if (text) content.push({ type: "text", text, citations: null } as Anthropic.TextBlock);
  for (const c of calls) {
    content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input } as Anthropic.ToolUseBlock);
  }
  return msg(content, "tool_use");
}

export function textMessage(text: string): Anthropic.Messages.Message {
  return msg([{ type: "text", text, citations: null } as Anthropic.TextBlock], "end_turn");
}

function msg(
  content: Anthropic.ContentBlock[],
  stop_reason: Anthropic.Messages.Message["stop_reason"]
): Anthropic.Messages.Message {
  // Cast to avoid coupling the test helper to the SDK's volatile `usage` shape.
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Messages.Message;
}
