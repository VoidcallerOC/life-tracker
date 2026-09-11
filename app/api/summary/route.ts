import { NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/auth";
import { errorResponse } from "@/lib/api/handlers";
import { readSnapshot } from "@/lib/db/repository";
import { buildQueue, countOverdue } from "@/lib/os/queue";
import { bucketFor, bucketLabel } from "@/lib/os/dates";

export const dynamic = "force-dynamic";

/**
 * Read-only feed for scheduled automation. Exempt from the cookie gate in
 * proxy.ts (a cron job cannot log in interactively), so it authenticates with
 * the `x-admin-key` header. Unlike the previous version it never accepts a key
 * from the query string, and it cannot mutate anything.
 */
export async function GET(request: Request) {
  try {
    if (!(await isAuthorizedRequest(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { clients, animals, tasks } = await readSnapshot();
    const queue = buildQueue(clients, animals, tasks);

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        stats: {
          queued: queue.length,
          overdue: countOverdue(queue),
          clients: clients.length,
          animals: animals.length,
          openTasks: tasks.filter((t) => t.status !== "Done").length,
        },
        items: queue.map((item) => ({
          lane: item.lane,
          kind: item.kind,
          title: item.title,
          why: item.why,
          deadline: item.deadline || null,
          due: item.deadline ? bucketLabel(item.deadline) : null,
          bucket: bucketFor(item.deadline),
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
