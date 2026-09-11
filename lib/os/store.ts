import { create } from "zustand";
import type {
  Animal,
  Client,
  EntityKind,
  LifeSnapshot,
  Status,
  Task,
  UndoEntry,
  UndoOp,
} from "@/lib/os/types";
import { emptyAnimal, emptyClient, emptyTask, rid } from "@/lib/os/types";
import { addDays, todayIso } from "@/lib/os/dates";
import { recomputeAnimalDue } from "@/lib/os/guardrails";
import {
  ConflictError,
  OfflineError,
  createRecord,
  deleteRecord,
  fetchSnapshot,
  restoreRecord,
  updateRecord,
  type SyncRecord,
} from "@/lib/os/sync";
import { enqueue, flush } from "@/lib/os/outbox";

/**
 * Local state is optimistic: the UI updates immediately, then one record write
 * goes to the server. This replaces the previous model, where any change
 * rewrote every client and task as a single JSON document — which meant two
 * devices editing different records silently overwrote each other.
 */

export type SyncState = "idle" | "saving" | "offline" | "error";

type Listener = (message: string, tone: "info" | "error") => void;

type LifeStore = LifeSnapshot & {
  undoStack: UndoEntry[];
  syncState: SyncState;
  pendingWrites: number;
  notify: Listener | null;

  setNotifier: (listener: Listener | null) => void;
  hydrate: (snap: LifeSnapshot) => void;
  refresh: () => Promise<void>;
  flushOutbox: () => Promise<void>;
  undo: () => string | null;
  dismissCoach: () => void;

  addClient: (partial: Partial<Client>) => string;
  updateClient: (id: string, patch: Partial<Client>, label?: string) => void;
  setClientStatus: (id: string, status: Status, extra?: Partial<Client>) => void;
  markContacted: (id: string) => void;
  clearClientNext: (id: string) => void;
  snoozeClient: (id: string, days?: number) => void;
  deleteClient: (id: string) => void;

  addAnimal: (partial: Partial<Animal>) => string;
  updateAnimal: (id: string, patch: Partial<Animal>, label?: string) => void;
  markFed: (id: string) => void;
  markCleaned: (id: string) => void;
  snoozeAnimal: (id: string, days?: number) => void;
  deleteAnimal: (id: string) => void;

  addTask: (partial: Partial<Task> & { lane: "content" | "personal" }) => string;
  updateTask: (id: string, patch: Partial<Task>, label?: string) => void;
  completeTask: (id: string) => void;
  snoozeTask: (id: string, days?: number) => void;
  deleteTask: (id: string) => void;
};

const collectionFor = { client: "clients", animal: "animals", task: "tasks" } as const;

export const useLifeStore = create<LifeStore>()((set, get) => {
  /** Replaces one record in its collection, matching on id. */
  function put(kind: EntityKind, record: SyncRecord) {
    const key = collectionFor[kind];
    set((state) => ({
      [key]: (state[key] as SyncRecord[]).map((r) => (r.id === record.id ? record : r)),
    }) as Partial<LifeStore>);
  }

  function drop(kind: EntityKind, id: string) {
    const key = collectionFor[kind];
    set((state) => ({
      [key]: (state[key] as SyncRecord[]).filter((r) => r.id !== id),
    }) as Partial<LifeStore>);
  }

  function insert(kind: EntityKind, record: SyncRecord) {
    const key = collectionFor[kind];
    set((state) => ({
      [key]: [record, ...(state[key] as SyncRecord[]).filter((r) => r.id !== record.id)],
    }) as Partial<LifeStore>);
  }

  function tell(message: string, tone: "info" | "error" = "info") {
    get().notify?.(message, tone);
  }

  /**
   * One in-flight write per record, chained.
   *
   * Tapping Fed and then Cleaned on the same animal fires two writes. Without
   * serialization the second would still be holding the version from before the
   * first landed and would come back as a spurious conflict.
   */
  const inFlight = new Map<string, Promise<unknown>>();

  function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = inFlight.get(key) ?? Promise.resolve();
    // Run `work` whether the previous write resolved or rejected — a failed
    // write must not strand every later write on the same record.
    const result = previous.then(work, work);
    // The chain link must never reject, or the next write inherits the failure.
    const link = result.then(
      () => undefined,
      () => undefined,
    );
    inFlight.set(key, link);
    void link.then(() => {
      // Only clear when nothing newer has queued behind this write, so the
      // map does not grow one entry per record touched.
      if (inFlight.get(key) === link) inFlight.delete(key);
    });
    return result;
  }

  /**
   * The version a record carries right now, which may have advanced since the
   * caller built its payload. Writes send this rather than the stale copy.
   */
  function currentVersion(kind: EntityKind, id: string, fallback: number): number {
    const collection = get()[collectionFor[kind]] as SyncRecord[];
    return collection.find((r) => r.id === id)?.version ?? fallback;
  }

  function pushUndo(label: string, ops: UndoOp[]) {
    set((state) => ({
      undoStack: [...state.undoStack, { label, at: Date.now(), ops }].slice(-15),
    }));
  }

  /**
   * Runs one server write around an optimistic local change. On conflict the
   * local edit is rolled back and server state is re-read, so the loser of a
   * race sees the truth rather than a silently discarded edit. When offline,
   * the write is queued and the optimistic state stands.
   */
  async function commit(
    kind: EntityKind,
    recordId: string,
    action: () => Promise<SyncRecord | void>,
    rollback: () => void,
    queued: Omit<Parameters<typeof enqueue>[0], "kind">,
  ) {
    set((s) => ({ syncState: "saving", pendingWrites: s.pendingWrites + 1 }));
    try {
      const saved = await serialize(`${kind}:${recordId}`, action);
      if (saved) put(kind, saved);
      set((s) => {
        const remaining = Math.max(0, s.pendingWrites - 1);
        return { pendingWrites: remaining, syncState: remaining === 0 ? "idle" : "saving" };
      });
    } catch (error) {
      set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) }));
      if (error instanceof OfflineError) {
        set({ syncState: "offline" });
        await enqueue({ kind, ...queued });
        tell("Saved on this device. It will sync when you are back online.", "info");
        return;
      }
      if (error instanceof ConflictError) {
        set({ syncState: "idle" });
        rollback();
        tell("That record changed on another device. Reloading the latest.", "error");
        await get().refresh();
        return;
      }
      set({ syncState: "error" });
      rollback();
      tell(error instanceof Error ? error.message : "Save failed", "error");
    }
  }

  return {
    clients: [],
    animals: [],
    tasks: [],
    coachDismissed: false,
    undoStack: [],
    syncState: "idle",
    pendingWrites: 0,
    notify: null,

    setNotifier: (listener) => set({ notify: listener }),

    hydrate: (snap) =>
      set({
        clients: snap.clients,
        animals: snap.animals,
        tasks: snap.tasks,
        coachDismissed: snap.coachDismissed,
        undoStack: [],
      }),

    refresh: async () => {
      try {
        const snap = await fetchSnapshot();
        set({
          clients: snap.clients,
          animals: snap.animals,
          tasks: snap.tasks,
          coachDismissed: snap.coachDismissed,
          syncState: "idle",
        });
      } catch (error) {
        if (error instanceof OfflineError) {
          set({ syncState: "offline" });
          return;
        }
        console.error("Refresh failed", error);
      }
    },

    flushOutbox: async () => {
      const result = await flush();
      if (result.sent > 0) {
        tell(`Synced ${result.sent} change${result.sent === 1 ? "" : "s"} made offline.`);
        await get().refresh();
      }
      if (result.conflicted > 0) {
        tell(
          `${result.conflicted} offline change${result.conflicted === 1 ? " was" : "s were"} superseded by a newer edit.`,
          "error",
        );
        await get().refresh();
      }
      if (result.remaining === 0 && get().syncState === "offline") {
        set({ syncState: "idle" });
      }
    },

    undo: () => {
      const stack = get().undoStack;
      const last = stack[stack.length - 1];
      if (!last) return null;
      set({ undoStack: stack.slice(0, -1) });

      for (const op of last.ops) {
        if (op.op === "restore") {
          insert(op.kind, op.record);
          void commit(
            op.kind,
            op.record.id,
            () => restoreRecord(op.kind, op.record),
            () => drop(op.kind, op.record.id),
            { op: "restore", record: op.record, recordId: op.record.id, version: op.record.version, label: `Undo ${last.label}` },
          );
        } else {
          const collection = get()[collectionFor[op.kind]] as SyncRecord[];
          const existing = collection.find((r) => r.id === op.id);
          if (!existing) continue;
          drop(op.kind, op.id);
          void commit(
            op.kind,
            op.id,
            () => deleteRecord(op.kind, op.id, existing.version),
            () => insert(op.kind, existing),
            { op: "delete", recordId: op.id, version: existing.version, label: `Undo ${last.label}` },
          );
        }
      }
      return last.label;
    },

    dismissCoach: () => {
      set({ coachDismissed: true });
      void fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ key: "coachDismissed", value: true }),
      }).catch(() => {
        // A dismissed coach card is not worth surfacing an error for.
      });
    },

    // --- clients -----------------------------------------------------------

    addClient: (partial) => {
      const id = rid();
      const client: Client = { ...emptyClient(), ...partial, id, version: 0 };
      insert("client", client);
      pushUndo(`Add ${client.name || "client"}`, [{ op: "remove", kind: "client", id }]);
      void commit(
        "client",
        id,
        () => createRecord("client", client),
        () => drop("client", id),
        { op: "create", record: client, recordId: id, version: 0, label: `Add ${client.name}` },
      );
      return id;
    },

    updateClient: (id, patch, label) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      const next = { ...prev, ...patch };
      put("client", next);
      pushUndo(label ?? `Edit ${prev.name}`, [{ op: "restore", kind: "client", record: prev }]);
      void commit(
        "client",
        id,
        () => updateRecord("client", { ...next, version: currentVersion("client", id, next.version) }),
        () => put("client", prev),
        { op: "update", record: next, recordId: id, version: next.version, label: label ?? `Edit ${prev.name}` },
      );
    },

    setClientStatus: (id, status, extra) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      const patch: Partial<Client> = { status, ...extra };
      if (status === "Paid" && !patch.paidDate) patch.paidDate = todayIso();
      if (status === "Lost") patch.nextAction = "";
      get().updateClient(id, patch, `Mark ${prev.name} ${status}`);
    },

    markContacted: (id) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      const today = todayIso();
      get().updateClient(
        id,
        {
          contacted: true,
          lastContacted: today,
          snoozeUntil: "",
          dueDate: !prev.dueDate || prev.dueDate <= today ? addDays(today, 3) : prev.dueDate,
        },
        `Contacted ${prev.name}`,
      );
    },

    clearClientNext: (id) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      get().updateClient(
        id,
        { nextAction: "", dueDate: "", snoozeUntil: "" },
        `Cleared next action for ${prev.name}`,
      );
    },

    snoozeClient: (id, days = 1) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      get().updateClient(id, { snoozeUntil: addDays(todayIso(), days) }, `Snooze ${prev.name}`);
    },

    deleteClient: (id) => {
      const prev = get().clients.find((c) => c.id === id);
      if (!prev) return;
      drop("client", id);
      pushUndo(`Delete ${prev.name}`, [{ op: "restore", kind: "client", record: prev }]);
      void commit(
        "client",
        id,
        () => deleteRecord("client", id, currentVersion("client", id, prev.version)),
        () => insert("client", prev),
        { op: "delete", recordId: id, version: prev.version, label: `Delete ${prev.name}` },
      );
    },

    // --- animals -----------------------------------------------------------

    addAnimal: (partial) => {
      const id = rid();
      const today = todayIso();
      const base = { ...emptyAnimal(), ...partial, id, version: 0 };
      const animal = recomputeAnimalDue({
        ...base,
        lastFed: base.lastFed || today,
        lastCleaned: base.lastCleaned || today,
      });
      insert("animal", animal);
      pushUndo(`Add ${animal.name || "animal"}`, [{ op: "remove", kind: "animal", id }]);
      void commit(
        "animal",
        id,
        () => createRecord("animal", animal),
        () => drop("animal", id),
        { op: "create", record: animal, recordId: id, version: 0, label: `Add ${animal.name}` },
      );
      return id;
    },

    updateAnimal: (id, patch, label) => {
      const prev = get().animals.find((a) => a.id === id);
      if (!prev) return;
      const next = recomputeAnimalDue({ ...prev, ...patch });
      put("animal", next);
      pushUndo(label ?? `Edit ${prev.name}`, [{ op: "restore", kind: "animal", record: prev }]);
      void commit(
        "animal",
        id,
        () => updateRecord("animal", { ...next, version: currentVersion("animal", id, next.version) }),
        () => put("animal", prev),
        { op: "update", record: next, recordId: id, version: next.version, label: label ?? `Edit ${prev.name}` },
      );
    },

    markFed: (id) => {
      const prev = get().animals.find((a) => a.id === id);
      if (!prev) return;
      get().updateAnimal(id, { lastFed: todayIso(), snoozeUntil: "" }, `Fed ${prev.name}`);
    },

    markCleaned: (id) => {
      const prev = get().animals.find((a) => a.id === id);
      if (!prev) return;
      get().updateAnimal(id, { lastCleaned: todayIso(), snoozeUntil: "" }, `Cleaned ${prev.name}`);
    },

    snoozeAnimal: (id, days = 1) => {
      const prev = get().animals.find((a) => a.id === id);
      if (!prev) return;
      get().updateAnimal(id, { snoozeUntil: addDays(todayIso(), days) }, `Snooze ${prev.name}`);
    },

    deleteAnimal: (id) => {
      const prev = get().animals.find((a) => a.id === id);
      if (!prev) return;
      drop("animal", id);
      pushUndo(`Remove ${prev.name}`, [{ op: "restore", kind: "animal", record: prev }]);
      void commit(
        "animal",
        id,
        () => deleteRecord("animal", id, currentVersion("animal", id, prev.version)),
        () => insert("animal", prev),
        { op: "delete", recordId: id, version: prev.version, label: `Remove ${prev.name}` },
      );
    },

    // --- tasks -------------------------------------------------------------

    addTask: (partial) => {
      const id = rid();
      const task: Task = { ...emptyTask(partial.lane), ...partial, id, version: 0 };
      insert("task", task);
      pushUndo(`Add ${task.title || "task"}`, [{ op: "remove", kind: "task", id }]);
      void commit(
        "task",
        id,
        () => createRecord("task", task),
        () => drop("task", id),
        { op: "create", record: task, recordId: id, version: 0, label: `Add ${task.title}` },
      );
      return id;
    },

    updateTask: (id, patch, label) => {
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return;
      const next = { ...prev, ...patch };
      put("task", next);
      pushUndo(label ?? `Edit ${prev.title}`, [{ op: "restore", kind: "task", record: prev }]);
      void commit(
        "task",
        id,
        () => updateRecord("task", { ...next, version: currentVersion("task", id, next.version) }),
        () => put("task", prev),
        { op: "update", record: next, recordId: id, version: next.version, label: label ?? `Edit ${prev.title}` },
      );
    },

    completeTask: (id) => {
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return;
      get().updateTask(id, { status: "Done", snoozeUntil: "" }, `Done: ${prev.title}`);
    },

    snoozeTask: (id, days = 1) => {
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return;
      get().updateTask(id, { snoozeUntil: addDays(todayIso(), days) }, `Snooze ${prev.title}`);
    },

    deleteTask: (id) => {
      const prev = get().tasks.find((t) => t.id === id);
      if (!prev) return;
      drop("task", id);
      pushUndo(`Delete ${prev.title}`, [{ op: "restore", kind: "task", record: prev }]);
      void commit(
        "task",
        id,
        () => deleteRecord("task", id, currentVersion("task", id, prev.version)),
        () => insert("task", prev),
        { op: "delete", recordId: id, version: prev.version, label: `Delete ${prev.title}` },
      );
    },
  };
});

export function hydrateLifeStore(snap: LifeSnapshot) {
  useLifeStore.getState().hydrate(snap);
}
