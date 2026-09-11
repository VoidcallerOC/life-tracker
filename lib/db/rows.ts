import type { Animal, Client, Task } from "@/lib/os/types";
import { emptyAnimal, emptyClient, emptyTask } from "@/lib/os/types";

/**
 * Values postgres.js accepts as bound parameters. Typing the row builders with
 * this (rather than `unknown`) is what lets `sql(row, ...columns)` type-check.
 */
export type WritableRow = Record<string, string | number | boolean | Date | null>;

/**
 * Postgres hands back `Date` for date columns and `null` for empties; the app
 * speaks 'yyyy-mm-dd' and ''. These two helpers are the only place that gap is
 * bridged, so a date can't silently arrive as a timestamp somewhere downstream.
 */
export function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIsoDate(value: string | null | undefined): string | null {
  return value && value.length > 0 ? value.slice(0, 10) : null;
}

function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type ClientRow = {
  id: string;
  name: string;
  business_type: string;
  status: Client["status"];
  contacted: boolean;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  quoted: string | number | null;
  deposit: string | number | null;
  paid: string | number | null;
  paid_date: Date | null;
  github_repo: string;
  live_url: string;
  domain: string;
  next_action: string;
  due_date: Date | null;
  notes: string;
  last_contacted: Date | null;
  snooze_until: Date | null;
  lost_reason: string;
  version: number;
};

export function rowToClient(row: ClientRow): Client {
  return {
    ...emptyClient(),
    id: row.id,
    name: row.name,
    businessType: row.business_type,
    status: row.status,
    contacted: row.contacted,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    quoted: toNumber(row.quoted),
    deposit: toNumber(row.deposit),
    paid: toNumber(row.paid),
    paidDate: toIsoDate(row.paid_date),
    githubRepo: row.github_repo,
    liveUrl: row.live_url,
    domain: row.domain,
    nextAction: row.next_action,
    dueDate: toIsoDate(row.due_date),
    notes: row.notes,
    lastContacted: toIsoDate(row.last_contacted),
    snoozeUntil: toIsoDate(row.snooze_until),
    lostReason: row.lost_reason,
    version: row.version,
  };
}

export function clientToRow(client: Client): WritableRow {
  return {
    id: client.id,
    name: client.name,
    business_type: client.businessType,
    status: client.status,
    contacted: client.contacted,
    contact_name: client.contactName,
    phone: client.phone,
    email: client.email,
    address: client.address,
    quoted: client.quoted,
    deposit: client.deposit,
    paid: client.paid,
    paid_date: fromIsoDate(client.paidDate),
    github_repo: client.githubRepo,
    live_url: client.liveUrl,
    domain: client.domain,
    next_action: client.nextAction,
    due_date: fromIsoDate(client.dueDate),
    notes: client.notes,
    last_contacted: fromIsoDate(client.lastContacted),
    snooze_until: fromIsoDate(client.snoozeUntil),
    lost_reason: client.lostReason,
  };
}

export type AnimalRecordRow = {
  id: string;
  name: string;
  species: string;
  enclosure: string;
  last_fed: Date | null;
  last_cleaned: Date | null;
  next_care_due: Date | null;
  feed_every_days: number;
  clean_every_days: number;
  notes: string;
  snooze_until: Date | null;
  version: number;
};

export function rowToAnimal(row: AnimalRecordRow): Animal {
  return {
    ...emptyAnimal(),
    id: row.id,
    name: row.name,
    species: row.species,
    enclosure: row.enclosure,
    lastFed: toIsoDate(row.last_fed),
    lastCleaned: toIsoDate(row.last_cleaned),
    nextCareDue: toIsoDate(row.next_care_due),
    feedEveryDays: row.feed_every_days,
    cleanEveryDays: row.clean_every_days,
    notes: row.notes,
    snoozeUntil: toIsoDate(row.snooze_until),
    version: row.version,
  };
}

export function animalToRow(animal: Animal): WritableRow {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    enclosure: animal.enclosure,
    last_fed: fromIsoDate(animal.lastFed),
    last_cleaned: fromIsoDate(animal.lastCleaned),
    next_care_due: fromIsoDate(animal.nextCareDue),
    feed_every_days: Math.max(1, animal.feedEveryDays || 1),
    clean_every_days: Math.max(1, animal.cleanEveryDays || 1),
    notes: animal.notes,
    snooze_until: fromIsoDate(animal.snoozeUntil),
  };
}

export type TaskRecordRow = {
  id: string;
  title: string;
  lane: Task["lane"];
  deadline: Date | null;
  status: Task["status"];
  priority: Task["priority"];
  platform: string;
  category: string;
  notes: string;
  snooze_until: Date | null;
  version: number;
};

export function rowToTask(row: TaskRecordRow): Task {
  return {
    ...emptyTask(row.lane),
    id: row.id,
    title: row.title,
    lane: row.lane,
    deadline: toIsoDate(row.deadline),
    status: row.status,
    priority: row.priority,
    platform: row.platform,
    category: row.category,
    notes: row.notes,
    snoozeUntil: toIsoDate(row.snooze_until),
    version: row.version,
  };
}

export function taskToRow(task: Task): WritableRow {
  return {
    id: task.id,
    title: task.title,
    lane: task.lane,
    deadline: fromIsoDate(task.deadline),
    status: task.status,
    priority: task.priority,
    platform: task.platform,
    category: task.category,
    notes: task.notes,
    snooze_until: fromIsoDate(task.snoozeUntil),
  };
}
