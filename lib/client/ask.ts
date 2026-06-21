// Browser-side helper: POST a chat turn to /api/ask and dispatch the NDJSON
// event stream to callbacks. Transport (fetch + stream reader + partial-line
// buffering) lives in `postNdjsonStream`; this file owns the ask event shape.

import { postNdjsonStream } from "./ndjson";

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

/**
 * Streams one assistant turn. Resolves with the full accumulated answer text
 * once the stream completes. Network/HTTP failures are surfaced via `onError`.
 */
export async function streamAsk(params: AskParams, handlers: AskHandlers = {}): Promise<string> {
  const acc = { text: "" };

  await postNdjsonStream(
    "/api/ask",
    {
      team_id: params.teamId,
      freeTransfers: params.freeTransfers,
      messages: params.messages,
    },
    (raw) => {
      const event = raw as unknown as AskEvent;
      switch (event.type) {
        case "token":
          if (event.text) {
            acc.text += event.text;
            handlers.onToken?.(event.text);
          }
          break;
        case "tool":
          // Text streamed before a tool call is preamble ("Let me check…"); drop
          // it so the resolved answer holds only the final post-tool response.
          acc.text = "";
          if (event.name) handlers.onTool?.(event.name);
          break;
        case "error":
          handlers.onError?.(event.message ?? "Unknown error");
          break;
        // "done" needs no handler — the stream ends.
      }
    },
    handlers.onError
  );

  return acc.text;
}
