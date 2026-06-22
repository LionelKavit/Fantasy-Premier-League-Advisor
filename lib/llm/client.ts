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

// ── Prompt caching helpers ───────────────────────────────────────────────────
// Cache the stable prefix of a request so repeated prefixes bill at the
// cache-read rate (~0.1x) instead of full input. Render order is
// `tools → system → messages`, so a breakpoint on the (last) system block caches
// tools + system together. Note the Sonnet 4.6 floor: prefixes under ~2,048
// tokens silently won't cache (no error) — these markers are harmless there and
// self-activate if a prefix grows. See openspec/changes/llm-prompt-caching.

/** Wrap a system string into a single text block marked for ephemeral caching. */
export function withCachedSystem(system: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

/**
 * Return a copy of `messages` with a cache breakpoint on the last block of the
 * last message (caches the conversation history up to here). The input array is
 * left clean so callers can keep appending without accumulating breakpoints.
 */
export function withCachedTail(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;
  const out = messages.slice();
  const last = out[out.length - 1];
  out[out.length - 1] = { ...last, content: markLastBlock(last.content) };
  return out;
}

function markLastBlock(
  content: string | Anthropic.ContentBlockParam[]
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] =
    typeof content === "string" ? [{ type: "text", text: content }] : content.slice();
  const i = blocks.length - 1;
  if (i >= 0) {
    blocks[i] = {
      ...blocks[i],
      cache_control: { type: "ephemeral" },
    } as Anthropic.ContentBlockParam;
  }
  return blocks;
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
    ...(params.system ? { system: withCachedSystem(params.system) } : {}),
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

/**
 * Normalized streaming handle — the small surface the agentic loop and tests
 * depend on, rather than the SDK's `MessageStream` internals. Iterate
 * `textStream` for token deltas; `finalMessage()` resolves to the completed
 * message (including any `tool_use` blocks) once the stream ends.
 */
export interface LlmStream {
  textStream: AsyncIterable<string>;
  finalMessage: () => Promise<Anthropic.Messages.Message>;
}

/** Streaming variant of createMessage — adapts the SDK's `messages.stream`. */
function stream(params: Anthropic.Messages.MessageCreateParamsNonStreaming): LlmStream {
  const ms = client().messages.stream(params);
  async function* textDeltas(): AsyncIterable<string> {
    for await (const event of ms) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
  return { textStream: textDeltas(), finalMessage: () => ms.finalMessage() };
}

// Exported as a single object so call-sites use `llm.complete(...)` and tests
// can reliably `vi.spyOn(llm, "complete")` (a plain object property, no ESM
// live-binding caveats).
export const llm = { complete, createMessage, stream, hasApiKey, DEFAULT_MODEL };
