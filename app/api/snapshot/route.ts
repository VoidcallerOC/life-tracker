import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/handlers";
import { requireSession } from "@/lib/session";
import { readSnapshot } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

/** Current server state, used on reconnect, on tab focus, and after a conflict. */
export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await readSnapshot(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
