import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/handlers";
import { requireSession } from "@/lib/session";
import { sql } from "@/lib/db/client";
import { animalSchema, clientSchema, taskSchema } from "@/lib/api/schemas";
import { animalToRow, clientToRow, taskToRow } from "@/lib/db/rows";
import type { Animal, Client, Task } from "@/lib/os/types";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  clients: z.array(clientSchema.partial({ version: true })),
  animals: z.array(animalSchema.partial({ version: true })),
  tasks: z.array(taskSchema.partial({ version: true })),
  coachDismissed: z.boolean().optional(),
});

/**
 * Restores a backup. Runs in one transaction: either the whole snapshot lands
 * or nothing does, so a failure halfway through cannot leave a half-imported
 * tracker behind.
 *
 * Existing rows are updated in place rather than dropped and recreated, so ids
 * stay stable and a concurrent reader never sees an empty table.
 */
export async function POST(request: Request) {
  try {
    await requireSession();
    const parsed = importSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues.slice(0, 10) },
        { status: 422 },
      );
    }

    const { clients, animals, tasks, coachDismissed } = parsed.data;
    const db = sql();

    await db.begin(async (tx) => {
      const keepClients = clients.map((c) => c.id);
      const keepAnimals = animals.map((a) => a.id);
      const keepTasks = tasks.map((t) => t.id);

      for (const client of clients) {
        const row = clientToRow({ ...client, version: 0 } as Client);
        const columns = Object.keys(row);
        const updatable = columns.filter((c) => c !== "id");
        await tx`
          INSERT INTO clients ${tx(row, columns)}
          ON CONFLICT (id) DO UPDATE SET ${tx(row, updatable)}, deleted_at = NULL
        `;
      }
      for (const animal of animals) {
        const row = animalToRow({ ...animal, version: 0 } as Animal);
        const columns = Object.keys(row);
        const updatable = columns.filter((c) => c !== "id");
        await tx`
          INSERT INTO animals ${tx(row, columns)}
          ON CONFLICT (id) DO UPDATE SET ${tx(row, updatable)}, deleted_at = NULL
        `;
      }
      for (const task of tasks) {
        const row = taskToRow({ ...task, version: 0 } as Task);
        const columns = Object.keys(row);
        const updatable = columns.filter((c) => c !== "id");
        await tx`
          INSERT INTO tasks ${tx(row, columns)}
          ON CONFLICT (id) DO UPDATE SET ${tx(row, updatable)}, deleted_at = NULL
        `;
      }

      // Records absent from the backup are soft-deleted, not dropped, so a
      // mistaken import is still recoverable in the database.
      if (keepClients.length > 0) {
        await tx`UPDATE clients SET deleted_at = now() WHERE id <> ALL(${keepClients}) AND deleted_at IS NULL`;
      }
      if (keepAnimals.length > 0) {
        await tx`UPDATE animals SET deleted_at = now() WHERE id <> ALL(${keepAnimals}) AND deleted_at IS NULL`;
      }
      if (keepTasks.length > 0) {
        await tx`UPDATE tasks SET deleted_at = now() WHERE id <> ALL(${keepTasks}) AND deleted_at IS NULL`;
      }

      if (coachDismissed !== undefined) {
        await tx`
          INSERT INTO settings (key, value) VALUES ('coachDismissed', ${tx.json(coachDismissed)})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `;
      }
    });

    return NextResponse.json({
      ok: true,
      imported: { clients: clients.length, animals: animals.length, tasks: tasks.length },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
