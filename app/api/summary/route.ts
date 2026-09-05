import { NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients } from "@/lib/clients/storage";
import { readStore } from "@/lib/lifeStore/storage";
import { collectDashboardItems, collectDashboardStats } from "@/lib/dashboard";
import { bucketFor, bucketLabel, daysUntil } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

// This route is exempt from the cookie-session gate in proxy.ts (scheduled
// automation can't do an interactive login), so it authenticates itself —
// see isAuthorizedRequest in lib/auth.ts.
export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
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
