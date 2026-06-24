import { NextRequest, NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";
import { llm } from "@/lib/llm/client";
import { FREE_TRANSFER_RANGE, clampFt } from "@/lib/config";
import { getScoutContext, getDemoScoutContext } from "@/lib/scout/context";
import { runScoutConversation, type ScoutTurn } from "@/lib/scout/chat";
import type { ChipPlanLine } from "@/lib/scout/system-prompt";

interface AskBody {
  team_id?: number | string;
  freeTransfers?: number;
  messages?: ScoutTurn[];
  chipPlan?: ChipPlanLine[];
  demo?: boolean;
}

type AskEvent =
  | { type: "token"; text: string }
  | { type: "tool"; name: string }
  | { type: "error"; message: string }
  | { type: "done" };

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

/** Map a raw error to a short, user-facing message (full detail stays in logs). */
function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/401|authentication|invalid x-api-key/i.test(raw)) {
    return "The Scout's AI service isn't authorized right now (API key issue). Your plan and stats are still accurate.";
  }
  if (/429|rate limit/i.test(raw)) {
    return "The Scout is being rate-limited — please try again in a moment.";
  }
  return "The Scout hit a problem answering that. Please try again.";
}

/** Build an NDJSON Response from a generator over events (each event = one line). */
function ndjsonResponse(
  produce: (emit: (event: AskEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AskEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await produce(emit);
      } catch (e) {
        console.error("[ask] stream failed:", e);
        emit({ type: "error", message: friendlyError(e) });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200, headers: NDJSON_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const demo = body.demo === true;
  const teamId = body.team_id != null ? parseInt(String(body.team_id), 10) : NaN;
  if (!demo && !Number.isInteger(teamId)) {
    return NextResponse.json(
      { error: "team_id is required", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "messages must end with a user turn", status: 400 } satisfies ApiErrorResponse,
      { status: 400 }
    );
  }

  // Offline fail-safe: no API key → the notice as a single token (same transport).
  if (!llm.hasApiKey()) {
    return ndjsonResponse(async (emit) => {
      emit({
        type: "token",
        text: "Ask The Scout is unavailable right now — the AI service isn't configured. Your gameweek plan and stats are still accurate.",
      });
    });
  }

  const freeTransfers = clampFt(body.freeTransfers ?? FREE_TRANSFER_RANGE.default);

  let sc;
  try {
    sc = demo ? await getDemoScoutContext() : await getScoutContext(teamId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json(
      { error: message, status } satisfies ApiErrorResponse,
      { status }
    );
  }

  const chipPlan = Array.isArray(body.chipPlan) ? body.chipPlan : undefined;

  // Stream the reply token-by-token, with a `tool` event before each tool runs.
  return ndjsonResponse(async (emit) => {
    await runScoutConversation({
      sc,
      freeTransfers,
      messages,
      chipPlan,
      demo,
      onToken: (text) => emit({ type: "token", text }),
      onTool: (name) => emit({ type: "tool", name }),
    });
  });
}
