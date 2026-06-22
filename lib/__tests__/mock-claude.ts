/**
 * Stubs the LLM wrapper (`lib/llm/client`) so synthesis/LLM-context code can be
 * tested offline along its success, API-error, and parse-failure paths. The
 * no-key branch is still controlled by the env var (call-sites check
 * `process.env.ANTHROPIC_API_KEY` before calling the wrapper), so `stubApiKey`/
 * `clearApiKey` select that path. Pair with `afterEach(restoreClaude)`.
 */
import { vi } from "vitest";
import { llm } from "../llm/client";
import type Anthropic from "@anthropic-ai/sdk";

/** `llm.complete` resolves with `text` (raw model output). */
export function mockClaudeSuccess(text: string): void {
  vi.spyOn(llm, "complete").mockResolvedValue(text);
}

/** Convenience: serialize an object as the model's JSON reply. */
export function mockClaudeJson(payload: unknown): void {
  mockClaudeSuccess(JSON.stringify(payload));
}

/** `llm.complete` rejects → code under test should hit its error/fail-safe path. */
export function mockClaudeError(status = 401): void {
  vi.spyOn(llm, "complete").mockRejectedValue(
    new Error(`Claude API error: ${status}`)
  );
}

/** Resolves with unparseable text → parse-failure/fail-safe path. */
export function mockClaudeMalformed(text = "this is not json"): void {
  mockClaudeSuccess(text);
}

/**
 * Drives the agentic tool-use loop: `llm.createMessage` returns each supplied
 * message in order (the last one repeats if the loop asks for more). Pass
 * tool-use messages followed by a final end_turn text message.
 */
export function mockClaudeMessages(
  messages: Anthropic.Messages.Message[]
): ReturnType<typeof vi.spyOn> {
  let i = 0;
  return vi.spyOn(llm, "createMessage").mockImplementation(async () => {
    const msg = messages[Math.min(i, messages.length - 1)];
    i += 1;
    return msg;
  });
}

/**
 * `llm.stream` yields the supplied chunks as text deltas, then resolves
 * `finalMessage()` to the concatenated text. For the streamed brief / chat.
 */
export function mockClaudeStream(chunks: string[]): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(llm, "stream").mockImplementation(() => ({
    textStream: (async function* () {
      for (const c of chunks) yield c;
    })(),
    finalMessage: async () =>
      ({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "test",
        content: [{ type: "text", text: chunks.join("") }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      }) as unknown as Anthropic.Messages.Message,
  }));
}

/** Set a dummy API key for success-path tests. */
export function stubApiKey(key = "test-key"): void {
  vi.stubEnv("ANTHROPIC_API_KEY", key);
}

/** Remove the API key for fail-safe tests. */
export function clearApiKey(): void {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

/** Restore spies and env stubbed by the helpers above. */
export function restoreClaude(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
}
