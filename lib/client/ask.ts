// Browser-side helper: POST a chat turn to /api/ask and dispatch the NDJSON
// event stream to callbacks. Isolates the transport (fetch + stream reader +
// partial-line buffering) from the React chat panel.

export interface AskMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskHandlers {
  onToken?: (text: string) => void;
  onTool?: (name: string) => void;
  onError?: (message: string) => void;
}

export interface AskParams {
  teamId: number;
  freeTransfers?: number;
  messages: AskMessage[];
}

interface AskEvent {
  type: "token" | "tool" | "error" | "done";
  text?: string;
  name?: string;
  message?: string;
}

function dispatch(line: string, handlers: AskHandlers, acc: { text: string }): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  let event: AskEvent;
  try {
    event = JSON.parse(trimmed) as AskEvent;
  } catch {
    return; // ignore malformed lines
  }
  switch (event.type) {
    case "token":
      if (event.text) {
        acc.text += event.text;
        handlers.onToken?.(event.text);
      }
      break;
    case "tool":
      // Text streamed before a tool call is preamble ("Let me check…"); drop it
      // so the resolved answer holds only the final post-tool response.
      acc.text = "";
      if (event.name) handlers.onTool?.(event.name);
      break;
    case "error":
      handlers.onError?.(event.message ?? "Unknown error");
      break;
    // "done" needs no handler — the stream ends.
  }
}

/**
 * Streams one assistant turn. Resolves with the full accumulated answer text
 * once the stream completes. Network/HTTP failures are surfaced via `onError`.
 */
export async function streamAsk(params: AskParams, handlers: AskHandlers = {}): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: params.teamId,
        freeTransfers: params.freeTransfers,
        messages: params.messages,
      }),
    });
  } catch {
    handlers.onError?.("Couldn't reach the Scout. Check your connection and try again.");
    return "";
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`The Scout is unavailable (status ${res.status}).`);
    return "";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const acc = { text: "" };
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      dispatch(line, handlers, acc);
    }
  }
  // Flush any trailing line that wasn't newline-terminated.
  if (buffer) dispatch(buffer, handlers, acc);

  return acc.text;
}
