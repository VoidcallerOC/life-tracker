import type { Client as BlobClient } from "@/lib/clients/types";
import type { AnimalRow, ContentRow, PersonalRow, Store } from "@/lib/types";
import type { Animal, Client, LifeSnapshot, Task } from "@/lib/os/types";
import { emptyAnimal, emptyClient } from "@/lib/os/types";

export function blobClientToOs(c: BlobClient): Client {
  return {
    ...emptyClient(),
    id: c.id,
    name: c.client,
    businessType: c.businessType ?? "",
    status: c.status,
    contacted: Boolean(c.contacted || c.lastContacted),
    contactName: c.contactName ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    quoted: c.quoted ?? null,
    deposit: c.deposit ?? null,
    paid: c.paid ?? null,
    paidDate: c.paidDate ?? "",
    githubRepo: c.githubRepo ?? "",
    liveUrl: c.liveUrl ?? "",
    domain: c.domain ?? "",
    nextAction: c.nextAction ?? "",
    dueDate: c.dueDate ?? "",
    notes: c.notes ?? "",
    lastContacted: c.lastContacted ?? "",
    snoozeUntil: c.snoozeUntil ?? "",
  };
}

export function osClientToBlob(c: Client): BlobClient {
  return {
    id: c.id,
    client: c.name,
    businessType: c.businessType,
    status: c.status,
    contacted: c.contacted,
    contactName: c.contactName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    quoted: c.quoted,
    deposit: c.deposit,
    paid: c.paid,
    paidDate: c.paidDate,
    githubRepo: c.githubRepo,
    liveUrl: c.liveUrl,
    domain: c.domain,
    nextAction: c.nextAction,
    notes: c.notes,
    lastContacted: c.lastContacted,
    dueDate: c.dueDate,
    snoozeUntil: c.snoozeUntil,
  };
}

export function blobAnimalToOs(a: AnimalRow): Animal {
  return {
    ...emptyAnimal(),
    id: a.id,
    name: (a.name ?? "").trim(),
    species: (a.species ?? "").trim(),
    enclosure: a.enclosure ?? "",
    lastFed: a.lastFed ?? "",
    lastCleaned: a.lastCleaned ?? "",
    nextCareDue: a.nextCareDue ?? "",
    feedEveryDays: a.feedEveryDays ?? 7,
    cleanEveryDays: a.cleanEveryDays ?? 7,
    notes: a.notes ?? "",
    snoozeUntil: a.snoozeUntil ?? "",
  };
}

export function osAnimalToBlob(a: Animal): AnimalRow {
  return {
    id: a.id,
    name: a.name,
    species: a.species,
    enclosure: a.enclosure,
    lastFed: a.lastFed,
    lastCleaned: a.lastCleaned,
    nextCareDue: a.nextCareDue,
    notes: a.notes,
    feedEveryDays: a.feedEveryDays,
    cleanEveryDays: a.cleanEveryDays,
    snoozeUntil: a.snoozeUntil,
  };
}

export function blobStoreToTasks(store: Store): Task[] {
  const content: Task[] = (store.content ?? []).map((row) => ({
    id: row.id,
    title: row.task,
    lane: "content",
    deadline: row.deadline ?? "",
    status: row.status === "Done" ? "Done" : "Todo",
    priority: "Medium",
    platform: row.platform ?? "",
    category: row.type ?? "",
    notes: row.notes ?? "",
    snoozeUntil: row.snoozeUntil ?? "",
  }));
  const personal: Task[] = (store.personal ?? []).map((row) => ({
    id: row.id,
    title: row.task,
    lane: "personal",
    deadline: row.deadline ?? "",
    status: row.status === "Done" ? "Done" : "Todo",
    priority: "Medium",
    platform: "",
    category: row.category ?? "",
    notes: row.notes ?? "",
    snoozeUntil: row.snoozeUntil ?? "",
  }));
  return [...content, ...personal];
}

export function osTasksToBlobStore(animals: Animal[], tasks: Task[]): Store {
  const content: ContentRow[] = tasks
    .filter((t) => t.lane === "content")
    .map((t) => ({
      id: t.id,
      task: t.title,
      type: t.category || "Social",
      deadline: t.deadline,
      status: t.status,
      platform: t.platform,
      notes: t.notes,
      snoozeUntil: t.snoozeUntil,
    }));
  const personal: PersonalRow[] = tasks
    .filter((t) => t.lane === "personal")
    .map((t) => ({
      id: t.id,
      task: t.title,
      category: t.category || "Life",
      deadline: t.deadline,
      status: t.status,
      notes: t.notes,
      snoozeUntil: t.snoozeUntil,
    }));
  return {
    animals: animals.map(osAnimalToBlob),
    content,
    personal,
  };
}

export function blobToSnapshot(clients: BlobClient[], store: Store): LifeSnapshot {
  return {
    clients: clients.map(blobClientToOs),
    animals: (store.animals ?? []).map(blobAnimalToOs),
    tasks: blobStoreToTasks(store),
    coachDismissed: false,
  };
}
