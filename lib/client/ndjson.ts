// Shared browser-side transport for the Scout's streaming endpoints (ask + brief).
// POST a JSON body, read the NDJSON response, and hand each parsed object to
// `onLine`. Isolates fetch + stream reader + partial-line buffering from the
// per-endpoint event handling.

/**
 * Streams an NDJSON response from `url`. Resolves once the stream completes.
 * Network/HTTP failures are surfaced via `onError` (and stop the read).
 */
export async function postNdjsonStream(
  url: string,
  body: unknown,
  onLine: (obj: Record<string, unknown>) => void,
  onError?: (message: string) => void
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    onError?.("Couldn't reach the Scout. Check your connection and try again.");
    return;
  }

  if (!res.ok || !res.body) {
    onError?.(`The Scout is unavailable (status ${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return; // ignore malformed lines
    }
    onLine(obj);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  // Flush any trailing line that wasn't newline-terminated.
  if (buffer) handle(buffer);
}
