import { NextRequest, NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";
import { llm } from "@/lib/llm/client";
import { getScoutContext } from "@/lib/scout/context";
import { runScoutConversation, type ScoutTurn } from "@/lib/scout/chat";

interface AskBody {
  team_id?: number | string;
  freeTransfers?: number;
  messages?: ScoutTurn[];
}

function textStream(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
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

  const teamId = body.team_id != null ? parseInt(String(body.team_id), 10) : NaN;
  if (!Number.isInteger(teamId)) {
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

  // Offline fail-safe: no API key → a plain, honest notice (same transport as a reply).
  if (!llm.hasApiKey()) {
    return textStream(
      "Ask The Scout is unavailable right now — the AI service isn't configured. Your gameweek plan and stats are still accurate."
    );
  }

  const freeTransfers = Math.min(2, Math.max(1, body.freeTransfers ?? 1));

  let sc;
  try {
    sc = await getScoutContext(teamId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return NextResponse.json(
      { error: message, status } satisfies ApiErrorResponse,
      { status }
    );
  }

  // Stream the assistant's reply progressively as the loop produces text.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runScoutConversation({
          sc,
          freeTransfers,
          messages,
          onText: (chunk) => controller.enqueue(encoder.encode(chunk)),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`\n\n(The Scout hit a problem: ${msg}. Please try again.)`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
