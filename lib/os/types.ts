export const STATUSES = ["Potential", "Pending", "Paid", "Lost"] as const;
export type Status = (typeof STATUSES)[number];

export const LANES = ["forge", "animals", "content", "personal"] as const;
export type Lane = (typeof LANES)[number];

export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "Todo" | "Done";

/**
 * `version` is the row version last read from the server. Every write sends it
 * back so a stale device gets a 409 instead of clobbering a newer edit. Records
 * created locally and not yet persisted carry version 0.
 */
export type Versioned = { version: number };

export type Client = Versioned & {
  id: string;
  name: string;
  businessType: string;
  status: Status;
  contacted: boolean;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  quoted: number | null;
  deposit: number | null;
  paid: number | null;
  paidDate: string;
  githubRepo: string;
  liveUrl: string;
  domain: string;
  nextAction: string;
  dueDate: string;
  notes: string;
  lastContacted: string;
  snoozeUntil: string;
  lostReason: string;
};

export type Animal = Versioned & {
  id: string;
  name: string;
  species: string;
  enclosure: string;
  lastFed: string;
  lastCleaned: string;
  nextCareDue: string;
  feedEveryDays: number;
  cleanEveryDays: number;
  notes: string;
  snoozeUntil: string;
};

export type Task = Versioned & {
  id: string;
  title: string;
  lane: "content" | "personal";
  deadline: string;
  status: TaskStatus;
  priority: Priority;
  platform: string;
  category: string;
  notes: string;
  snoozeUntil: string;
};

export type LifeSnapshot = {
  clients: Client[];
  animals: Animal[];
  tasks: Task[];
  coachDismissed: boolean;
};

export type EntityKind = "client" | "animal" | "task";

/**
 * An undo step is the set of writes that reverses one user action. Storing the
 * inverse records (rather than a whole-app snapshot, as the JSON-blob version
 * did) means undo touches only the rows the action touched, so it no longer
 * reverts edits another device made in the meantime.
 */
export type UndoOp =
  | { op: "restore"; kind: EntityKind; record: Client | Animal | Task }
  | { op: "remove"; kind: EntityKind; id: string };

export type UndoEntry = {
  label: string;
  at: number;
  ops: UndoOp[];
};

export type QueueKind =
  | "animal-care"
  | "task"
  | "client-stale"
  | "client-missing-next"
  | "client-next";

export type QueueItem = {
  id: string;
  lane: Lane;
  kind: QueueKind;
  sourceId: string;
  title: string;
  why: string;
  deadline: string;
  primaryLabel: string;
  phone?: string;
};

export function emptyClient(): Omit<Client, "id"> {
  return {
    version: 0,
    lostReason: "",
    name: "",
    businessType: "",
    status: "Potential",
    contacted: false,
    contactName: "",
    phone: "",
    email: "",
    address: "",
    quoted: null,
    deposit: null,
    paid: null,
    paidDate: "",
    githubRepo: "",
    liveUrl: "",
    domain: "",
    nextAction: "",
    dueDate: "",
    notes: "",
    lastContacted: "",
    snoozeUntil: "",
  };
}

export function emptyAnimal(): Omit<Animal, "id"> {
  return {
    version: 0,
    name: "",
    species: "",
    enclosure: "",
    lastFed: "",
    lastCleaned: "",
    nextCareDue: "",
    feedEveryDays: 2,
    cleanEveryDays: 7,
    notes: "",
    snoozeUntil: "",
  };
}

export function emptyTask(lane: "content" | "personal"): Omit<Task, "id"> {
  return {
    version: 0,
    title: "",
    lane,
    deadline: "",
    status: "Todo",
    priority: "Medium",
    platform: lane === "content" ? "X" : "",
    category: lane === "personal" ? "Life" : "",
    notes: "",
    snoozeUntil: "",
  };
}

export function rid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function normalizeClient(raw: Partial<Client> & { client?: string }): Client {
  const base = emptyClient();
  return {
    ...base,
    ...raw,
    id: raw.id || rid(),
    name: (raw.name || raw.client || "").trim(),
    githubRepo: raw.githubRepo ?? "",
    liveUrl: raw.liveUrl ?? "",
    domain: raw.domain ?? "",
    dueDate: raw.dueDate ?? "",
    snoozeUntil: raw.snoozeUntil ?? "",
    contacted: Boolean(raw.contacted || raw.lastContacted),
  };
}
