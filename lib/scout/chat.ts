import type Anthropic from "@anthropic-ai/sdk";
import { llm, DEFAULT_MODEL, withCachedSystem, withCachedTail } from "../llm/client";
import type { ScoutContext } from "./context";
import { SCOUT_TOOLS, runScoutTool } from "./tools";
import { buildScoutSystemPrompt, type ChipPlanLine } from "./system-prompt";

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
// Tighter output ceiling for the public demo chat (conservative token usage); the
// demo system prompt also asks for ~2-sentence answers. Tools still run normally.
const DEMO_MAX_TOKENS = 384;

/**
 * Stream one round and forward token deltas to `onToken`. Returns the round's
 * accumulated text and the completed message (for tool-use inspection).
 */
async function streamRound(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  onToken?: (text: string) => void
): Promise<{ text: string; message: Anthropic.Messages.Message }> {
  const { textStream, finalMessage } = llm.stream(params);
  let text = "";
  for await (const delta of textStream) {
    text += delta;
    onToken?.(delta);
  }
  const message = await finalMessage();
  return { text, message };
}

/**
 * Runs the stateless agentic tool-use loop for one assistant reply, streaming
 * token-by-token. The full conversation history is supplied by the caller
 * (client-held); grounding comes from the cached `ScoutContext`. Tool errors are
 * fed back as tool results so the model can recover rather than aborting. Every
 * round streams via `llm.stream`: `onToken` receives text deltas as they arrive,
 * `onTool` fires before each tool runs (drives a status chip), then the
 * completed message is inspected for `tool_use`.
 */
export async function runScoutConversation(params: {
  sc: ScoutContext;
  freeTransfers: number;
  messages: ScoutTurn[];
  /** The committed chip plan the panels show — grounds chip answers (single source). */
  chipPlan?: ChipPlanLine[];
  /** Demo mode — general advice about a sample squad (no "your squad"/chips). */
  demo?: boolean;
  onToken?: (text: string) => void;
  onTool?: (name: string) => void;
  maxToolRounds?: number;
}): Promise<ScoutConversationResult> {
  const { sc, freeTransfers, chipPlan, demo, onToken, onTool } = params;
  const maxRounds = params.maxToolRounds ?? MAX_TOOL_ROUNDS;
  // Cache the stable prefix reused across this question's model calls: one
  // breakpoint on the system block (covers tools + system), one on the message
  // tail (covers history). `messages` stays clean; `withCachedTail` marks a copy
  // per call so breakpoints never accumulate past the 4-per-request cap.
  const system = withCachedSystem(buildScoutSystemPrompt(sc, freeTransfers, chipPlan, demo));
  const maxTokens = demo ? DEMO_MAX_TOKENS : MAX_TOKENS;

  const messages: Anthropic.MessageParam[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCalls: string[] = [];

  for (let round = 0; round < maxRounds; round++) {
    const { text, message } = await streamRound(
      { model: DEFAULT_MODEL, max_tokens: maxTokens, system, tools: SCOUT_TOOLS, messages: withCachedTail(messages) },
      onToken
    );

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: message.content as Anthropic.ContentBlockParam[] });

    if (toolUses.length === 0) {
      return { text: text.trim(), toolRounds: round, toolCalls };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      toolCalls.push(tu.name);
      onTool?.(tu.name);
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
  const { text } = await streamRound(
    { model: DEFAULT_MODEL, max_tokens: maxTokens, system, messages: withCachedTail(messages) },
    onToken
  );
  let finalText = text.trim();
  if (!finalText) {
    finalText = "I couldn't fully resolve that — try narrowing the question to one player or transfer.";
    onToken?.(finalText);
  }
  return { text: finalText, toolRounds: maxRounds, toolCalls };
}
