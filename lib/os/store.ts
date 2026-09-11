import { create } from "zustand";
import type { Animal, Client, LifeSnapshot, Status, Task, UndoEntry } from "@/lib/os/types";
import { emptyAnimal, emptyClient, emptyTask, rid } from "@/lib/os/types";
import { addDays, todayIso } from "@/lib/os/dates";
import { recomputeAnimalDue } from "@/lib/os/guardrails";

type LifeStore = LifeSnapshot & {
  undoStack: UndoEntry[];
  undo: () => string | null;
  dismissCoach: () => void;
  replaceAll: (snap: LifeSnapshot, label: string) => void;
  resetToStarter: () => void;
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

function snapshotOf(s: LifeSnapshot): LifeSnapshot {
  return {
    clients: s.clients.map((c) => ({ ...c })),
    animals: s.animals.map((a) => ({ ...a })),
    tasks: s.tasks.map((t) => ({ ...t })),
    coachDismissed: s.coachDismissed,
  };
}

export const useLifeStore = create<LifeStore>()((set, get) => ({
      clients: [],
      animals: [],
      tasks: [],
      coachDismissed: false,
      undoStack: [],
      undo: () => {
        const stack = get().undoStack;
        const last = stack[stack.length - 1];
        if (!last) return null;
        set({
          ...last.snapshot,
          undoStack: stack.slice(0, -1),
        });
        return last.label;
      },
      dismissCoach: () => set({ coachDismissed: true }),
      replaceAll: (snap, label) => {
        const current = get();
        set({
          ...snap,
          undoStack: [
            ...current.undoStack,
            { label, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      resetToStarter: () => {
        // Blob is the source of truth — reset is a no-op on the live app.
      },
      addClient: (partial) => {
        const id = rid();
        const current = get();
        const client: Client = { ...emptyClient(), ...partial, id };
        set({
          clients: [client, ...current.clients],
          undoStack: [
            ...current.undoStack,
            { label: `Add ${client.name || "client"}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
        return id;
      },
      updateClient: (id, patch, label) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        set({
          clients: current.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          undoStack: [
            ...current.undoStack,
            { label: label ?? `Edit ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      setClientStatus: (id, status, extra) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        const patch: Partial<Client> = { status, ...extra };
        if (status === "Paid" && !patch.paidDate) patch.paidDate = todayIso();
        if (status === "Lost") patch.nextAction = "";
        set({
          clients: current.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          undoStack: [
            ...current.undoStack,
            {
              label: `Mark ${prev.name} ${status}`,
              at: Date.now(),
              snapshot: snapshotOf(current),
            },
          ].slice(-15),
        });
      },
      markContacted: (id) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        set({
          clients: current.clients.map((c) =>
            c.id === id
              ? {
                  ...c,
                  contacted: true,
                  lastContacted: todayIso(),
                  snoozeUntil: "",
                  dueDate:
                    !c.dueDate || c.dueDate <= todayIso() ? addDays(todayIso(), 3) : c.dueDate,
                }
              : c,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Contacted ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      clearClientNext: (id) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        set({
          clients: current.clients.map((c) =>
            c.id === id ? { ...c, nextAction: "", dueDate: "", snoozeUntil: "" } : c,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Cleared next action for ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      snoozeClient: (id, days = 1) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        set({
          clients: current.clients.map((c) =>
            c.id === id ? { ...c, snoozeUntil: addDays(todayIso(), days) } : c,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Snooze ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      deleteClient: (id) => {
        const current = get();
        const prev = current.clients.find((c) => c.id === id);
        if (!prev) return;
        set({
          clients: current.clients.filter((c) => c.id !== id),
          undoStack: [
            ...current.undoStack,
            { label: `Delete ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      addAnimal: (partial) => {
        const id = rid();
        const current = get();
        const today = todayIso();
        const base = { ...emptyAnimal(), ...partial, id };
        const stamped = {
          ...base,
          lastFed: base.lastFed || today,
          lastCleaned: base.lastCleaned || today,
        };
        const animal = recomputeAnimalDue(stamped);
        set({
          animals: [animal, ...current.animals],
          undoStack: [
            ...current.undoStack,
            { label: `Add ${animal.name || "animal"}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
        return id;
      },
      updateAnimal: (id, patch, label) => {
        const current = get();
        const prev = current.animals.find((a) => a.id === id);
        if (!prev) return;
        const next = recomputeAnimalDue({ ...prev, ...patch });
        set({
          animals: current.animals.map((a) => (a.id === id ? next : a)),
          undoStack: [
            ...current.undoStack,
            { label: label ?? `Edit ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      markFed: (id) => {
        const current = get();
        const prev = current.animals.find((a) => a.id === id);
        if (!prev) return;
        const next = recomputeAnimalDue({ ...prev, lastFed: todayIso(), snoozeUntil: "" });
        set({
          animals: current.animals.map((a) => (a.id === id ? next : a)),
          undoStack: [
            ...current.undoStack,
            { label: `Fed ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      markCleaned: (id) => {
        const current = get();
        const prev = current.animals.find((a) => a.id === id);
        if (!prev) return;
        const next = recomputeAnimalDue({ ...prev, lastCleaned: todayIso(), snoozeUntil: "" });
        set({
          animals: current.animals.map((a) => (a.id === id ? next : a)),
          undoStack: [
            ...current.undoStack,
            { label: `Cleaned ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      snoozeAnimal: (id, days = 1) => {
        const current = get();
        const prev = current.animals.find((a) => a.id === id);
        if (!prev) return;
        set({
          animals: current.animals.map((a) =>
            a.id === id ? { ...a, snoozeUntil: addDays(todayIso(), days) } : a,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Snooze ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      deleteAnimal: (id) => {
        const current = get();
        const prev = current.animals.find((a) => a.id === id);
        if (!prev) return;
        set({
          animals: current.animals.filter((a) => a.id !== id),
          undoStack: [
            ...current.undoStack,
            { label: `Remove ${prev.name}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      addTask: (partial) => {
        const id = rid();
        const current = get();
        const task: Task = { ...emptyTask(partial.lane), ...partial, id };
        set({
          tasks: [task, ...current.tasks],
          undoStack: [
            ...current.undoStack,
            { label: `Add ${task.title || "task"}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
        return id;
      },
      updateTask: (id, patch, label) => {
        const current = get();
        const prev = current.tasks.find((t) => t.id === id);
        if (!prev) return;
        set({
          tasks: current.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          undoStack: [
            ...current.undoStack,
            { label: label ?? `Edit ${prev.title}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      completeTask: (id) => {
        const current = get();
        const prev = current.tasks.find((t) => t.id === id);
        if (!prev) return;
        set({
          tasks: current.tasks.map((t) =>
            t.id === id ? { ...t, status: "Done", snoozeUntil: "" } : t,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Done: ${prev.title}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      snoozeTask: (id, days = 1) => {
        const current = get();
        const prev = current.tasks.find((t) => t.id === id);
        if (!prev) return;
        set({
          tasks: current.tasks.map((t) =>
            t.id === id ? { ...t, snoozeUntil: addDays(todayIso(), days) } : t,
          ),
          undoStack: [
            ...current.undoStack,
            { label: `Snooze ${prev.title}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
      deleteTask: (id) => {
        const current = get();
        const prev = current.tasks.find((t) => t.id === id);
        if (!prev) return;
        set({
          tasks: current.tasks.filter((t) => t.id !== id),
          undoStack: [
            ...current.undoStack,
            { label: `Delete ${prev.title}`, at: Date.now(), snapshot: snapshotOf(current) },
          ].slice(-15),
        });
      },
}));

export function hydrateLifeStore(snap: LifeSnapshot) {
  useLifeStore.setState({
    clients: snap.clients,
    animals: snap.animals,
    tasks: snap.tasks,
    coachDismissed: snap.coachDismissed,
    undoStack: [],
  });
}
