import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Single-shot text completion — convenience for the synthesis call-sites. */
async function complete(params: {
  prompt: string;
  maxTokens: number;
  system?: string;
  model?: string;
}): Promise<string> {
  const msg = await client().messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: params.maxTokens,
    ...(params.system ? { system: params.system } : {}),
    messages: [{ role: "user", content: params.prompt }],
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Passthrough to messages.create — used by the agentic tool-use loop. */
async function createMessage(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming
): Promise<Anthropic.Messages.Message> {
  return client().messages.create(params);
}

// Exported as a single object so call-sites use `llm.complete(...)` and tests
// can reliably `vi.spyOn(llm, "complete")` (a plain object property, no ESM
// live-binding caveats).
export const llm = { complete, createMessage, hasApiKey, DEFAULT_MODEL };
