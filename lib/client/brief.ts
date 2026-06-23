// Browser-side helper: POST to /api/brief and stream the Scout's opening brief.
// Sibling of `streamAsk` — same NDJSON transport (`postNdjsonStream`), but the
// brief has no tools, so every token simply accumulates into the greeting.

import { postNdjsonStream } from "./ndjson";

export interface BriefHandlers {
  onToken?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface BriefParams {
  teamId: number;
  freeTransfers?: number;
  /** Demo mode — the welcome brief for a sample squad (no team_id sent). */
  demo?: boolean;
}

interface BriefEvent {
  type: "token" | "error" | "done";
  text?: string;
  message?: string;
}

/**
 * Streams the opening brief. Resolves with the full accumulated text once the
 * stream completes. Network/HTTP failures are surfaced via `onError`.
 */
export async function streamBrief(params: BriefParams, handlers: BriefHandlers = {}): Promise<string> {
  const acc = { text: "" };

  await postNdjsonStream(
    "/api/brief",
    { team_id: params.demo ? undefined : params.teamId, freeTransfers: params.freeTransfers, demo: params.demo },
    (raw) => {
      const event = raw as unknown as BriefEvent;
      switch (event.type) {
        case "token":
          if (event.text) {
            acc.text += event.text;
            handlers.onToken?.(event.text);
          }
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
