import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/handlers";
import { requireSession } from "@/lib/session";
import { pushConfigured, removeSubscription, saveSubscription } from "@/lib/push/server";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(500) }),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({
      configured: pushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_subscription" }, { status: 422 });
    }
    await saveSubscription(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSession();
    const endpoint = new URL(request.url).searchParams.get("endpoint");
    if (!endpoint) return NextResponse.json({ error: "endpoint_required" }, { status: 400 });
    await removeSubscription(endpoint);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
