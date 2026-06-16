import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/lib/types";

export async function POST() {
  return NextResponse.json(
    {
      error: "Transfer optimizer pipeline not yet implemented",
      status: 501,
    } satisfies ApiErrorResponse,
    { status: 501 }
  );
}
