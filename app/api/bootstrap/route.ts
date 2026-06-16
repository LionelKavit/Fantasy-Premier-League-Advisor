import { NextResponse } from "next/server";
import { fetchBootstrap } from "@/lib/fpl-api";
import type { ApiErrorResponse } from "@/lib/types";

export async function GET() {
  try {
    const data = await fetchBootstrap();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message, status: 500 } satisfies ApiErrorResponse,
      { status: 500 }
    );
  }
}
