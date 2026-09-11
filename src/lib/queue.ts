import type { Animal, Client, Lane, QueueItem, Task } from "./types";
import { STALE_AFTER_DAYS } from "./guardrails";
import { addDays, daysUntil, todayIso } from "./dates";

function snoozed(until: string, today: string): boolean {
  return Boolean(until && until > today);
}

function rank(item: QueueItem, today: string): number {
  const d = daysUntil(item.deadline, new Date(today + "T12:00:00"));
  if (item.kind === "animal-care") {
    if (d != null && d < 0) return 0;
    if (d === 0) return 1;
    return 8;
  }
  if (d != null && d < 0) return 2;
  if (d === 0) return 3;
  if (item.kind === "client-missing-next") return 4;
  if (item.kind === "client-stale") return 5;
  if (d === 1) return 6;
  if (item.kind === "client-next") return 7;
  return 9;
}

export function buildQueue(
  clients: Client[],
  animals: Animal[],
  tasks: Task[],
  now = new Date(),
): QueueItem[] {
  const today = todayIso(now);
  const items: QueueItem[] = [];

  for (const a of animals) {
    if (snoozed(a.snoozeUntil, today)) continue;
    if (!a.nextCareDue) continue;
    const d = daysUntil(a.nextCareDue, now);
    if (d == null || d > 1) continue;
    const feedDue = !a.lastFed || addDays(a.lastFed, a.feedEveryDays) <= today;
    items.push({
      id: `animal:${a.id}`,
      lane: "animals",
      kind: "animal-care",
      sourceId: a.id,
      title: a.name || "Unnamed animal",
      why: a.species
        ? `${a.species}${a.enclosure ? ` · ${a.enclosure}` : ""}`
        : "Care is due.",
      deadline: a.nextCareDue,
      primaryLabel: feedDue ? "Fed today" : "Cleaned today",
    });
  }

  for (const t of tasks) {
    if (t.status === "Done") continue;
    if (snoozed(t.snoozeUntil, today)) continue;
    if (!t.deadline) continue;
    const d = daysUntil(t.deadline, now);
    if (d == null || d > 1) continue;
    items.push({
      id: `task:${t.id}`,
      lane: t.lane,
      kind: "task",
      sourceId: t.id,
      title: t.title,
      why: t.notes || (t.platform ? `Post on ${t.platform}` : t.category || ""),
      deadline: t.deadline,
      primaryLabel: "Mark done",
    });
  }

  for (const c of clients) {
    if (c.status === "Lost") continue;
    if (snoozed(c.snoozeUntil, today)) continue;

    const missingNext =
      (c.status === "Pending" || c.status === "Paid") && !c.nextAction.trim();
    if (missingNext) {
      items.push({
        id: `missing:${c.id}`,
        lane: "forge",
        kind: "client-missing-next",
        sourceId: c.id,
        title: c.name,
        why: `${c.status} with no next action. Blank is how jobs die.`,
        deadline: "",
        primaryLabel: "Set next action",
        phone: c.phone || undefined,
      });
      continue;
    }

    const staleDays = c.lastContacted
      ? daysUntil(addDays(c.lastContacted, STALE_AFTER_DAYS), now)
      : null;
    const touched = c.contacted || Boolean(c.lastContacted);
    const isStale =
      c.status !== "Paid" &&
      touched &&
      staleDays != null &&
      staleDays < 0;

    if (isStale) {
      const last = c.lastContacted ? `Last touch ${c.lastContacted}.` : "Never contacted.";
      items.push({
        id: `stale:${c.id}`,
        lane: "forge",
        kind: "client-stale",
        sourceId: c.id,
        title: c.name,
        why: `${c.nextAction || "Follow up."} ${last}`,
        deadline: c.dueDate || (c.lastContacted ? addDays(c.lastContacted, STALE_AFTER_DAYS) : today),
        primaryLabel: c.contacted ? "Mark contacted" : "I called",
        phone: c.phone || undefined,
      });
      continue;
    }

    if (c.nextAction.trim() && (c.status === "Pending" || c.status === "Paid" || c.status === "Potential")) {
      const due = c.dueDate;
      const d = due ? daysUntil(due, now) : null;
      if (due && d != null && d <= 1) {
        items.push({
          id: `next:${c.id}`,
          lane: "forge",
          kind: "client-next",
          sourceId: c.id,
          title: c.name,
          why: c.nextAction,
          deadline: due,
          primaryLabel: c.status === "Potential" ? "I called" : "Done with this",
          phone: c.phone || undefined,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const ra = rank(a, today);
    const rb = rank(b, today);
    if (ra !== rb) return ra - rb;
    return (a.deadline || "9999").localeCompare(b.deadline || "9999");
  });
}

export function laterTasks(tasks: Task[], now = new Date()): Task[] {
  const today = todayIso(now);
  return tasks
    .filter((t) => t.status !== "Done")
    .filter((t) => {
      if (snoozed(t.snoozeUntil, today)) return true;
      if (!t.deadline) return true;
      const d = daysUntil(t.deadline, now);
      return d != null && d > 1;
    })
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
}

export function laneLabel(lane: Lane): string {
  switch (lane) {
    case "forge":
      return "Forge";
    case "animals":
      return "Animals";
    case "content":
      return "Content";
    case "personal":
      return "Personal";
  }
}

export function countOverdue(items: QueueItem[], now = new Date()): number {
  return items.filter((it) => {
    const d = daysUntil(it.deadline, now);
    return d != null && d < 0;
  }).length;
}
