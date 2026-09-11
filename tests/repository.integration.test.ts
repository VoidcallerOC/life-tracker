import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError, VersionConflictError, databaseConfigured, sql } from "@/lib/db/client";
import * as repo from "@/lib/db/repository";
import { emptyAnimal, emptyClient, emptyTask } from "@/lib/os/types";

/**
 * Exercises the real SQL against a real Postgres. Skipped when DATABASE_URL is
 * unset so `npm test` still runs anywhere; CI provides a service container.
 *
 *   DATABASE_URL=postgres://... npm run db:migrate && npm test
 */
const describeIfDb = databaseConfigured() ? describe : describe.skip;

describeIfDb("repository (integration)", () => {
  const ids = {
    client: "test-client-1",
    animal: "test-animal-1",
    task: "test-task-1",
  };

  async function cleanup() {
    const db = sql();
    await db`DELETE FROM clients WHERE id LIKE 'test-%'`;
    await db`DELETE FROM animals WHERE id LIKE 'test-%'`;
    await db`DELETE FROM tasks WHERE id LIKE 'test-%'`;
    await db`DELETE FROM settings WHERE key = 'coachDismissed'`;
  }

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await sql().end();
  });

  it("inserts a record at version 1 and reads it back unchanged", async () => {
    const created = await repo.insertClient({
      ...emptyClient(),
      id: ids.client,
      version: 0,
      name: "Verify Shop",
      status: "Pending",
      quoted: 500,
      paid: 275.5,
      nextAction: "Call back",
      dueDate: "2026-09-20",
    });

    expect(created.version).toBe(1);
    expect(created.quoted).toBe(500);
    expect(created.paid).toBe(275.5);
    expect(created.dueDate).toBe("2026-09-20");
    expect(await repo.getClient(ids.client)).toEqual(created);
  });

  it("bumps the version on every update", async () => {
    const before = await repo.getClient(ids.client);
    const updated = await repo.updateClient({ ...before!, nextAction: "Send invoice" }, before!.version);
    expect(updated.version).toBe(before!.version + 1);
    expect(updated.nextAction).toBe("Send invoice");
  });

  it("rejects a write from a device holding a stale version", async () => {
    // This is the bug the whole migration exists to fix: two devices editing
    // the same record used to mean one silently overwrote the other.
    const current = await repo.getClient(ids.client);
    const staleVersion = current!.version - 1;

    await expect(
      repo.updateClient({ ...current!, nextAction: "Clobber from another device" }, staleVersion),
    ).rejects.toBeInstanceOf(VersionConflictError);

    const after = await repo.getClient(ids.client);
    expect(after!.nextAction).toBe("Send invoice");
    expect(after!.version).toBe(current!.version);
  });

  it("raises NotFoundError for a row that does not exist", async () => {
    const client = { ...emptyClient(), id: "test-missing", version: 1, name: "Ghost" };
    await expect(repo.updateClient(client, 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("soft-deletes, then restores the same row for undo", async () => {
    const current = await repo.getClient(ids.client);
    await repo.softDeleteClient(ids.client, current!.version);

    expect(await repo.getClient(ids.client)).toBeNull();
    expect((await repo.listClients()).some((c) => c.id === ids.client)).toBe(false);

    const restored = await repo.restoreClient(current!);
    expect(restored.id).toBe(ids.client);
    expect(restored.nextAction).toBe("Send invoice");
    expect(await repo.getClient(ids.client)).not.toBeNull();
  });

  it("refuses a delete carrying a stale version", async () => {
    await expect(repo.softDeleteClient(ids.client, 1)).rejects.toBeInstanceOf(VersionConflictError);
  });

  it("persists animal care intervals and due dates", async () => {
    const animal = await repo.insertAnimal({
      ...emptyAnimal(),
      id: ids.animal,
      version: 0,
      name: "Ziggy",
      species: "leopard gecko",
      lastFed: "2026-09-10",
      feedEveryDays: 2,
      cleanEveryDays: 30,
      nextCareDue: "2026-09-12",
    });

    expect(animal.feedEveryDays).toBe(2);
    expect(animal.cleanEveryDays).toBe(30);
    expect(animal.nextCareDue).toBe("2026-09-12");
    expect(animal.lastFed).toBe("2026-09-10");
  });

  it("persists task priority, which the JSON storage silently dropped", async () => {
    const task = await repo.insertTask({
      ...emptyTask("content"),
      id: ids.task,
      version: 0,
      title: "Post teaser",
      priority: "High",
      deadline: "2026-09-12",
    });

    expect(task.priority).toBe("High");
    expect((await repo.getTask(ids.task))!.priority).toBe("High");
  });

  it("round-trips settings and falls back for unknown keys", async () => {
    await repo.writeSetting("coachDismissed", true);
    expect(await repo.readSetting("coachDismissed", false)).toBe(true);

    await repo.writeSetting("coachDismissed", false);
    expect(await repo.readSetting("coachDismissed", true)).toBe(false);

    expect(await repo.readSetting("never-written", "fallback")).toBe("fallback");
  });

  it("returns a snapshot whose records all carry versions", async () => {
    const snapshot = await repo.readSnapshot();
    expect(Array.isArray(snapshot.clients)).toBe(true);
    expect(snapshot.clients.every((c) => Number.isInteger(c.version) && c.version > 0)).toBe(true);
    expect(snapshot.animals.every((a) => Number.isInteger(a.version) && a.version > 0)).toBe(true);
  });
});
