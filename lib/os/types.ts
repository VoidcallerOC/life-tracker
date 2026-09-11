export const STATUSES = ["Potential", "Pending", "Paid", "Lost"] as const;
export type Status = (typeof STATUSES)[number];

export const LANES = ["forge", "animals", "content", "personal"] as const;
export type Lane = (typeof LANES)[number];

export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "Todo" | "Done";

export type Client = {
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
};

export type Animal = {
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

export type Task = {
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

export type UndoEntry = {
  label: string;
  at: number;
  snapshot: LifeSnapshot;
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
