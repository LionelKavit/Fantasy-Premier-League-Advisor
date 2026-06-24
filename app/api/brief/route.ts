import { NextRequest, NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";
import { llm } from "@/lib/llm/client";
import { runGameweekPlan, runDemoPlan } from "@/lib/plan";
import { FREE_TRANSFER_RANGE, clampFt } from "@/lib/config";
import {
  buildBriefGrounding,
  streamOpeningBrief,
  composeDeterministicBrief,
  buildDemoBriefGrounding,
  streamDemoBrief,
  composeDeterministicDemoBrief,
  type DemoBriefGrounding,
} from "@/lib/scout/brief";

interface BriefBody {
  team_id?: number | string;
  freeTransfers?: number;
  demo?: boolean;
}

type BriefEvent =
  | { type: "token"; text: string }
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
  return "The Scout couldn't put together your brief just now. Please try again.";
}

/** Build an NDJSON Response from a generator over events (each event = one line). */
function ndjsonResponse(produce: (emit: (event: BriefEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: BriefEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await produce(emit);
      } catch (e) {
        console.error("[brief] stream failed:", e);
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
  let body: BriefBody;
  try {
    body = (await request.json()) as BriefBody;
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

  const freeTransfers = clampFt(body.freeTransfers ?? FREE_TRANSFER_RANGE.default);

  // Demo: a welcome brief that NEVER shows an error in the bubble — falls back to
  // the deterministic demo brief on no-key or any pre-token failure.
  if (demo) {
    return ndjsonResponse(async (emit) => {
      let grounding: DemoBriefGrounding = { season: "live", captain: null, vice: null };
      try {
        const plan = await runDemoPlan({ freeTransfers });
        grounding = buildDemoBriefGrounding(plan);
      } catch (e) {
        console.error("[brief] demo plan failed:", e);
        emit({ type: "token", text: composeDeterministicDemoBrief(grounding) });
        return;
      }
      if (!llm.hasApiKey()) {
        emit({ type: "token", text: composeDeterministicDemoBrief(grounding) });
        return;
      }
      let emitted = false;
      try {
        await streamDemoBrief(grounding, (text) => {
          emitted = true;
          emit({ type: "token", text });
        });
      } catch (e) {
        console.error("[brief] demo stream failed:", e);
        if (!emitted) emit({ type: "token", text: composeDeterministicDemoBrief(grounding) });
      }
    });
  }

  // Grounding is built inside the stream so any failure (e.g. unknown manager)
  // surfaces as an `error` event then `done`, rather than crashing the stream.
  return ndjsonResponse(async (emit) => {
    const plan = await runGameweekPlan(teamId, { freeTransfers }); // cached (insights + context)
    const grounding = buildBriefGrounding(plan);

    // Keyless fallback: a deterministic brief of the same shape, one token.
    if (!llm.hasApiKey()) {
      emit({ type: "token", text: composeDeterministicBrief(grounding) });
      return;
    }

    await streamOpeningBrief(grounding, (text) => emit({ type: "token", text }));
  });
}
