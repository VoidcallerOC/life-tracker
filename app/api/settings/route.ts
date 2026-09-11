import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/handlers";
import { requireSession } from "@/lib/session";
import { readSetting, writeSetting } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = ["coachDismissed", "weekPin"] as const;

const bodySchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.unknown(),
});

export async function GET(request: Request) {
  try {
    await requireSession();
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !(ALLOWED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json({ error: "unknown_key" }, { status: 400 });
    }
    return NextResponse.json({ key, value: await readSetting(key, null) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 422 });
    }
    await writeSetting(parsed.data.key, parsed.data.value ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
