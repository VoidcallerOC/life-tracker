import type { Client, Animal } from "@/lib/os/types";
import { addDays, todayIso } from "@/lib/os/dates";

export const CARE_PLAN = 35;
export const STALE_AFTER_DAYS = 7;
export const UNCONTACTED_CAP = 5;

export function paidAmountError(amount: number | null): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return "Paid needs a real dollar amount. Zero does not count.";
  }
  return null;
}

export function lostReasonError(reason: string): string | null {
  if (!reason.trim() || reason.trim().length < 3) {
    return "Lost needs a reason. Three months from now you will not remember why.";
  }
  return null;
}

export function deleteClientError(client: Client): string | null {
  if (client.status === "Paid") {
    return "Paid clients stay. If the job is dead, mark Lost with a reason — do not erase the history.";
  }
  return null;
}

export function addPotentialError(clients: Client[], force: boolean): string | null {
  if (force) return null;
  const uncalled = clients.filter((c) => c.status === "Potential" && !c.contacted);
  if (uncalled.length >= UNCONTACTED_CAP) {
    return `You already have ${uncalled.length} shops you have not called. Call one of those first.`;
  }
  return null;
}

export function clientNameError(name: string): string | null {
  if (!name.trim()) return "A shop needs a name.";
  return null;
}

export function animalNameError(name: string): string | null {
  if (!name.trim()) return "An animal needs a name.";
  return null;
}

export function taskTitleError(title: string): string | null {
  if (!title.trim()) return "A task needs a name.";
  return null;
}

export function taskDeadlineError(deadline: string): string | null {
  if (!deadline) return "Give it a date. Undated work is how things vanish.";
  return null;
}

export function namesMatch(typed: string, expected: string): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function recomputeAnimalDue(animal: Animal, today = todayIso()): Animal {
  const feedEvery = Math.max(1, animal.feedEveryDays || 2);
  const cleanEvery = Math.max(1, animal.cleanEveryDays || 7);
  const nextFeed = animal.lastFed ? addDays(animal.lastFed, feedEvery) : today;
  const nextClean = animal.lastCleaned ? addDays(animal.lastCleaned, cleanEvery) : today;
  const nextCareDue = nextFeed <= nextClean ? nextFeed : nextClean;
  return { ...animal, feedEveryDays: feedEvery, cleanEveryDays: cleanEvery, nextCareDue };
}

export function pendingMissingNext(clients: Client[]): Client[] {
  return clients.filter(
    (c) => (c.status === "Pending" || c.status === "Paid") && !c.nextAction.trim(),
  );
}
