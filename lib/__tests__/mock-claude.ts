/**
 * Stubs the Claude `fetch` boundary so synthesis/LLM-context code can be tested
 * offline along its success, API-error, and parse-failure paths. Pair with
 * `afterEach(restoreClaude)` (or vi.unstubAllGlobals / vi.unstubAllEnvs).
 */
import { vi } from "vitest";

interface ResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function installFetch(impl: () => ResponseLike): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => impl() as unknown as Response)
  );
}

/** Anthropic-shaped 200 whose single content block carries `text`. */
export function mockClaudeSuccess(text: string): void {
  installFetch(() => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }] }),
  }));
}

/** Convenience: serialize an object as the model's JSON reply. */
export function mockClaudeJson(payload: unknown): void {
  mockClaudeSuccess(JSON.stringify(payload));
}

/** Non-200 → code under test should hit its error/fail-safe path. */
export function mockClaudeError(status = 401): void {
  installFetch(() => ({
    ok: false,
    status,
    json: async () => ({ error: "mocked error" }),
  }));
}

/** 200 with unparseable text → parse-failure/fail-safe path. */
export function mockClaudeMalformed(text = "this is not json"): void {
  mockClaudeSuccess(text);
}

/** Set a dummy API key for success-path tests. */
export function stubApiKey(key = "test-key"): void {
  vi.stubEnv("ANTHROPIC_API_KEY", key);
}

/** Remove the API key for fail-safe tests. */
export function clearApiKey(): void {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
}

/** Restore globals and env stubbed by the helpers above. */
export function restoreClaude(): void {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
}
