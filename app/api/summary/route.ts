import { NextResponse } from "next/server";
import { expectedPassword } from "@/lib/auth";
import { readClients } from "@/lib/clients/storage";
import { readStore } from "@/lib/lifeStore/storage";
import { collectDashboardItems, collectDashboardStats } from "@/lib/dashboard";
import { bucketFor, bucketLabel, daysUntil } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

// This route is exempt from the cookie-session gate in proxy.ts (scheduled
// automation can't do an interactive login), so it authenticates itself:
// the caller must supply the same app password used to log in. Reusing
// AUTH_PASSWORD rather than a separate secret is a deliberate call — this
// is a single-admin app behind one shared credential already, not a
// multi-tenant service, so a second secret would add setup friction without
// changing the actual threat model.
function authorized(request: Request): boolean {
  const url = new URL(request.url);
  const key = request.headers.get("x-summary-key") ?? url.searchParams.get("key");
  if (!key) return false;
  let expected: string;
  try {
    expected = expectedPassword();
  } catch {
    return false;
  }
  if (key.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [clients, store] = await Promise.all([readClients(), readStore()]);
  const items = collectDashboardItems(store, clients);
  const stats = collectDashboardStats(items);

  const formatted = items.map((it) => {
    const b = bucketFor(it.deadline);
    const d = daysUntil(it.deadline);
    return {
      section: it.section,
      task: it.task,
      deadline: it.deadline || null,
      due: it.deadline ? bucketLabel(b, d) : null,
      bucket: b,
      stage: it.stage || null,
      notes: it.notes || null,
    };
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats,
    items: formatted,
  });
}
