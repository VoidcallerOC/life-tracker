import { NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/auth";
import { readStore, writeStore } from "@/lib/lifeStore/storage";
import { PRIORITY_CONTENT, PRIORITY_PERSONAL, mergePriorityRows } from "@/lib/priorities";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ store: await readStore() });
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  if (!body || typeof body !== "object" || (body as { action?: unknown }).action !== "upsertPriorities") {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  const store = await readStore();
  const next = {
    ...store,
    personal: mergePriorityRows(store.personal, PRIORITY_PERSONAL),
    content: mergePriorityRows(store.content, PRIORITY_CONTENT),
  };
  await writeStore(next);
  return NextResponse.json({
    ok: true,
    personal: PRIORITY_PERSONAL.map((r) => r.task),
    content: PRIORITY_CONTENT.map((r) => r.task),
  });
}
