import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/handlers";
import { isAuthorizedRequest } from "@/lib/auth";
import { readSnapshot } from "@/lib/db/repository";
import { buildQueue, countOverdue } from "@/lib/os/queue";
import { pushConfigured, sendToAll } from "@/lib/push/server";
import { purgeExpiredSessions } from "@/lib/db/sessions";

export const dynamic = "force-dynamic";

/**
 * Daily nudge, driven by Vercel Cron (see vercel.json).
 *
 * Authorized by `x-admin-key`, or by Vercel's own `CRON_SECRET` bearer token
 * when the platform invokes it.
 */
function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function summarize(overdueCare: string[], dueToday: number, overdue: number): string {
  const parts: string[] = [];
  if (overdueCare.length > 0) {
    const names = overdueCare.slice(0, 3).join(", ");
    const extra = overdueCare.length > 3 ? ` +${overdueCare.length - 3} more` : "";
    parts.push(`Care overdue: ${names}${extra}`);
  }
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  return parts.join(" · ");
}

export async function GET(request: Request) {
  try {
    if (!isCronRequest(request) && !(await isAuthorizedRequest(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await purgeExpiredSessions();

    const { clients, animals, tasks } = await readSnapshot();
    const queue = buildQueue(clients, animals, tasks);
    const overdue = countOverdue(queue);

    const today = new Date().toISOString().slice(0, 10);
    const overdueCare = queue
      .filter((item) => item.kind === "animal-care" && item.deadline && item.deadline < today)
      .map((item) => item.title);
    const dueToday = queue.filter((item) => item.deadline === today).length;

    if (queue.length === 0) {
      return NextResponse.json({ ok: true, skipped: "queue_empty" });
    }
    if (!pushConfigured()) {
      return NextResponse.json({ ok: true, skipped: "push_not_configured", queued: queue.length });
    }

    const body = summarize(overdueCare, dueToday, overdue);
    const result = await sendToAll({
      title:
        overdueCare.length > 0
          ? "Animal care is overdue"
          : `${queue.length} thing${queue.length === 1 ? "" : "s"} in front of you`,
      body: body || `${queue.length} in the queue`,
      url: "/",
      tag: "life-os-daily",
    });

    return NextResponse.json({ ok: true, queued: queue.length, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
