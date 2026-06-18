import type Anthropic from "@anthropic-ai/sdk";
import { llm, DEFAULT_MODEL } from "../llm/client";
import type { ScoutContext } from "./context";
import { SCOUT_TOOLS, runScoutTool } from "./tools";

export interface ScoutTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ScoutConversationResult {
  text: string;
  toolRounds: number;
  toolCalls: string[];
}

const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS = 1024;

function buildSystemPrompt(sc: ScoutContext, freeTransfers: number): string {
  const a = sc.ctx.analysis;
  const manager = sc.ctx.managerProfile.entry.name;
  return `You are "The Scout", the in-app Fantasy Premier League (FPL) assistant for the manager of "${manager}".

Scope: answer ONLY questions about this FPL team, players, transfers, captaincy, chips, fixtures and strategy. If asked anything unrelated to FPL, politely decline in one sentence and steer back to their team.

Grounding: never invent prices, scores, projections, ownership or transfer legality. Call the tools to get real numbers. Call get_plan first when the user asks for general advice. Use simulate_transfer / simulate_captain for any "should I…" or "what if…" question — and make clear these are hypotheticals, not executed moves.

Current situation: GW${a.currentGw}, £${a.bank.toFixed(1)}m in the bank, ${freeTransfers} free transfer(s) available.

Be concise and concrete. Reference specific players, gameweeks and numbers. Use plain English, not JSON.`;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Runs the stateless agentic tool-use loop for one assistant reply. The full
 * conversation history is supplied by the caller (client-held); grounding comes
 * from the cached `ScoutContext`. Tool errors are fed back as tool results so
 * the model can recover rather than aborting the turn. `onText` receives text
 * as each round produces it, enabling progressive streaming to the client.
 */
export async function runScoutConversation(params: {
  sc: ScoutContext;
  freeTransfers: number;
  messages: ScoutTurn[];
  onText?: (chunk: string) => void;
  maxToolRounds?: number;
}): Promise<ScoutConversationResult> {
  const { sc, freeTransfers, onText } = params;
  const maxRounds = params.maxToolRounds ?? MAX_TOOL_ROUNDS;
  const system = buildSystemPrompt(sc, freeTransfers);

  const messages: Anthropic.MessageParam[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCalls: string[] = [];

  for (let round = 0; round < maxRounds; round++) {
    const res = await llm.createMessage({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: SCOUT_TOOLS,
      messages,
    });

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: res.content as Anthropic.ContentBlockParam[] });

    if (toolUses.length === 0) {
      const text = textOf(res.content);
      if (text && onText) onText(text);
      return { text, toolRounds: round, toolCalls };
    }

    // Stream any interim text the model emitted alongside its tool calls.
    const interim = textOf(res.content);
    if (interim && onText) onText(interim);

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      toolCalls.push(tu.name);
      const result = await runScoutTool(tu.name, tu.input, sc, { freeTransfers });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Round cap hit while still calling tools — force a final answer without tools.
  const forced = await llm.createMessage({
    model: DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
  });
  const text =
    textOf(forced.content) ||
    "I couldn't fully resolve that — try narrowing the question to one player or transfer.";
  if (onText) onText(text);
  return { text, toolRounds: maxRounds, toolCalls };
}
