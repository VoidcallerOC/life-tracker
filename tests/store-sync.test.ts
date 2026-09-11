import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the write path of the client store against a stubbed server: version
 * handling, rollback, conflict recovery, and the serialization that keeps two
 * fast taps on one record from colliding.
 */

const server = vi.hoisted(() => ({
  /** id -> version, as the server sees it. */
  versions: new Map<string, number>(),
  calls: [] as { op: string; id: string; version: number }[],
  mode: "ok" as "ok" | "offline" | "error",
  delayMs: 0,
}));

vi.mock("@/lib/os/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/os/sync")>("@/lib/os/sync");

  async function pause() {
    if (server.delayMs > 0) await new Promise((r) => setTimeout(r, server.delayMs));
  }

  return {
    ...actual,
    createRecord: vi.fn(async (kind: string, record: { id: string; version: number }) => {
      await pause();
      if (server.mode === "offline") throw new actual.OfflineError();
      server.versions.set(record.id, 1);
      server.calls.push({ op: "create", id: record.id, version: 0 });
      return { ...record, version: 1 };
    }),
    updateRecord: vi.fn(async (kind: string, record: { id: string; version: number }) => {
      await pause();
      if (server.mode === "offline") throw new actual.OfflineError();
      if (server.mode === "error") throw new Error("Save failed (500)");
      const current = server.versions.get(record.id) ?? 0;
      server.calls.push({ op: "update", id: record.id, version: record.version });
      if (record.version !== current) throw new actual.ConflictError(kind as never, record.id);
      const next = current + 1;
      server.versions.set(record.id, next);
      return { ...record, version: next };
    }),
    deleteRecord: vi.fn(async (kind: string, id: string, version: number) => {
      await pause();
      if (server.mode === "offline") throw new actual.OfflineError();
      const current = server.versions.get(id) ?? 0;
      server.calls.push({ op: "delete", id, version });
      if (version !== current) throw new actual.ConflictError(kind as never, id);
      server.versions.delete(id);
    }),
    restoreRecord: vi.fn(async (kind: string, record: { id: string; version: number }) => {
      await pause();
      const next = (server.versions.get(record.id) ?? record.version) + 1;
      server.versions.set(record.id, next);
      server.calls.push({ op: "restore", id: record.id, version: record.version });
      return { ...record, version: next };
    }),
    fetchSnapshot: vi.fn(async () => ({
      clients: [],
      animals: [
        { id: "a1", version: server.versions.get("a1") ?? 1, name: "Server copy" } as never,
      ],
      tasks: [],
      coachDismissed: false,
    })),
  };
});

vi.mock("@/lib/os/outbox", () => ({
  enqueue: vi.fn(async () => undefined),
  flush: vi.fn(async () => ({ sent: 0, conflicted: 0, remaining: 0 })),
  pending: vi.fn(async () => []),
  outboxAvailable: () => false,
  clearOutbox: vi.fn(async () => undefined),
}));

const { useLifeStore } = await import("@/lib/os/store");
const { enqueue } = await import("@/lib/os/outbox");
const { emptyAnimal } = await import("@/lib/os/types");

/**
 * Lets every queued microtask and timer settle. Long enough to outlast the
 * artificial latency the slowest test configures, since writes to one record
 * are deliberately chained and a pending one holds up the next.
 */
async function settle() {
  for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 20));
}

beforeEach(() => {
  server.versions.clear();
  server.calls.length = 0;
  server.mode = "ok";
  server.delayMs = 0;
  useLifeStore.setState({
    clients: [],
    animals: [{ ...emptyAnimal(), id: "a1", version: 1, name: "Ziggy", feedEveryDays: 2, cleanEveryDays: 7 }],
    tasks: [],
    coachDismissed: false,
    undoStack: [],
    syncState: "idle",
    pendingWrites: 0,
    notify: null,
  });
  server.versions.set("a1", 1);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("optimistic writes", () => {
  it("updates locally straight away, before the server answers", async () => {
    server.delayMs = 50;
    useLifeStore.getState().markFed("a1");
    // No await before this assertion: the UI must not wait on the network.
    expect(useLifeStore.getState().animals[0].lastFed).not.toBe("");
    // Drain, so this test's in-flight write does not chain into the next one.
    await settle();
  });

  it("adopts the version the server returns", async () => {
    useLifeStore.getState().markFed("a1");
    await settle();
    expect(useLifeStore.getState().animals[0].version).toBe(2);
    expect(useLifeStore.getState().syncState).toBe("idle");
  });

  it("serializes two fast taps on the same record instead of conflicting", async () => {
    // Fed then Cleaned, back to back, while the first write is still in flight.
    server.delayMs = 20;
    const store = useLifeStore.getState();
    store.markFed("a1");
    store.markCleaned("a1");
    await settle();

    const updates = server.calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(2);
    // The second write must carry the version the first one produced.
    expect(updates[0].version).toBe(1);
    expect(updates[1].version).toBe(2);
    expect(useLifeStore.getState().syncState).toBe("idle");
    expect(useLifeStore.getState().animals[0].version).toBe(3);
  });

  it("rolls back and reloads when another device got there first", async () => {
    // The server moved on without us.
    server.versions.set("a1", 9);
    const messages: string[] = [];
    useLifeStore.getState().setNotifier((m) => messages.push(m));

    useLifeStore.getState().markFed("a1");
    await settle();

    expect(messages.some((m) => m.includes("another device"))).toBe(true);
    // Refreshed from the server rather than keeping the rejected edit.
    expect(useLifeStore.getState().animals[0].name).toBe("Server copy");
  });

  it("rolls the local change back when the write fails outright", async () => {
    server.mode = "error";
    const before = useLifeStore.getState().animals[0].lastFed;

    useLifeStore.getState().markFed("a1");
    await settle();

    expect(useLifeStore.getState().animals[0].lastFed).toBe(before);
    expect(useLifeStore.getState().syncState).toBe("error");
  });

  it("queues the write and keeps the optimistic state when offline", async () => {
    server.mode = "offline";

    useLifeStore.getState().markFed("a1");
    await settle();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(useLifeStore.getState().syncState).toBe("offline");
    // The tap still counts locally — that is the point of the outbox.
    expect(useLifeStore.getState().animals[0].lastFed).not.toBe("");
  });
});

describe("undo", () => {
  it("restores a deleted record rather than creating a new one", async () => {
    const store = useLifeStore.getState();
    store.deleteAnimal("a1");
    await settle();
    expect(useLifeStore.getState().animals).toHaveLength(0);

    const label = useLifeStore.getState().undo();
    await settle();

    expect(label).toContain("Ziggy");
    const restored = useLifeStore.getState().animals;
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe("a1");
    expect(server.calls.some((c) => c.op === "restore" && c.id === "a1")).toBe(true);
  });

  it("removes a record that undo of an add should take back", async () => {
    const id = useLifeStore.getState().addAnimal({ name: "Temporary" });
    await settle();
    expect(useLifeStore.getState().animals.some((a) => a.id === id)).toBe(true);

    useLifeStore.getState().undo();
    await settle();

    expect(useLifeStore.getState().animals.some((a) => a.id === id)).toBe(false);
  });

  it("does nothing when the stack is empty", () => {
    useLifeStore.setState({ undoStack: [] });
    expect(useLifeStore.getState().undo()).toBeNull();
  });
});
