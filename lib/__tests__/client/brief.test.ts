import { describe, it, expect, vi, afterEach } from "vitest";
import { streamBrief } from "../../client/brief";

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

const PARAMS = { teamId: 1, freeTransfers: 1 };

describe("streamBrief", () => {
  it("accumulates every brief token (no preamble drop, no tools)", async () => {
    stubFetch(
      streamResponse([
        '{"type":"token","text":"Right Kavit — "}\n',
        '{"type":"token","text":"deadline\'s Saturday."}\n',
        '{"type":"done"}\n',
      ])
    );
    const tokens: string[] = [];
    const text = await streamBrief(PARAMS, { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(["Right Kavit — ", "deadline's Saturday."]);
    expect(text).toBe("Right Kavit — deadline's Saturday.");
  });

  it("buffers a JSON line split across chunk boundaries", async () => {
    stubFetch(streamResponse(['{"type":"to', 'ken","text":"Hi"}\n{"type":"done"}\n']));
    const tokens: string[] = [];
    const text = await streamBrief(PARAMS, { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(["Hi"]);
    expect(text).toBe("Hi");
  });

  it("surfaces an error event via onError", async () => {
    stubFetch(streamResponse(['{"type":"error","message":"boom"}\n', '{"type":"done"}\n']));
    const errors: string[] = [];
    const text = await streamBrief(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors).toEqual(["boom"]);
    expect(text).toBe("");
  });

  it("reports an HTTP failure through onError", async () => {
    stubFetch(streamResponse([], 500));
    const errors: string[] = [];
    await streamBrief(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors[0]).toMatch(/unavailable/i);
  });

  it("reports a network failure through onError", async () => {
    stubFetch(() => {
      throw new Error("offline");
    });
    const errors: string[] = [];
    await streamBrief(PARAMS, { onError: (m) => errors.push(m) });
    expect(errors[0]).toMatch(/couldn't reach/i);
  });
});
