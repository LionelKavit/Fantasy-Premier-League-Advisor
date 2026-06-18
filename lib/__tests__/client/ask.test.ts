import { describe, it, expect, vi, afterEach } from "vitest";
import { streamAsk } from "../../client/ask";

afterEach(() => vi.unstubAllGlobals());

/** A 200 Response whose body streams the given chunks in order. */
function streamResponse(chunks: string[], status = 200): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ch of chunks) controller.enqueue(enc.encode(ch));
      controller.close();
    },
  });
  return new Response(body, { status });
}

function stubFetch(res: Response | (() => never)) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => (typeof res === "function" ? res() : res))
  );
}

const PARAMS = { teamId: 1, freeTransfers: 1, messages: [{ role: "user" as const, content: "hi" }] };

describe("streamAsk", () => {
  it("dispatches token / tool events and resolves with the accumulated answer", async () => {
    stubFetch(
      streamResponse([
        '{"type":"token","text":"Hello "}\n',
        '{"type":"tool","name":"get_plan"}\n',
        '{"type":"token","text":"world"}\n',
        '{"type":"done"}\n',
      ])
    );
    const tokens: string[] = [];
    const tools: string[] = [];
    const answer = await streamAsk(PARAMS, {
      onToken: (t) => tokens.push(t),
      onTool: (n) => tools.push(n),
    });
    expect(tokens).toEqual(["Hello ", "world"]);
    expect(tools).toEqual(["get_plan"]);
    expect(answer).toBe("Hello world");
  });

  it("buffers a JSON line split across chunk boundaries", async () => {
    stubFetch(streamResponse(['{"type":"to', 'ken","text":"Hi"}\n{"type":"done"}\n']));
    const tokens: string[] = [];
    const answer = await streamAsk(PARAMS, { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(["Hi"]);
    expect(answer).toBe("Hi");
  });

  it("surfaces an error event via onError", async () => {
    stubFetch(streamResponse(['{"type":"error","message":"boom"}\n', '{"type":"done"}\n']));
    const errors: string[] = [];
    const answer = await streamAsk(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors).toEqual(["boom"]);
    expect(answer).toBe("");
  });

  it("reports an HTTP failure through onError", async () => {
    stubFetch(streamResponse([], 500));
    const errors: string[] = [];
    const answer = await streamAsk(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors[0]).toMatch(/unavailable/i);
    expect(answer).toBe("");
  });

  it("reports a network failure through onError", async () => {
    stubFetch(() => {
      throw new Error("offline");
    });
    const errors: string[] = [];
    const answer = await streamAsk(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors[0]).toMatch(/couldn't reach/i);
    expect(answer).toBe("");
  });
});
