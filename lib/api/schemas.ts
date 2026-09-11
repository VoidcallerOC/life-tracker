import { z } from "zod";

/**
 * Request-body validation for every write. The blob-era code wrote whatever the
 * client sent straight to storage; these schemas are the boundary that stops a
 * malformed record from reaching Postgres.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd")
  .or(z.literal(""));

const money = z.number().finite().nonnegative().nullable();

export const clientSchema = z.object({
  id: z.string().min(1).max(200),
  version: z.number().int().nonnegative(),
  name: z.string().max(300),
  businessType: z.string().max(300).default(""),
  status: z.enum(["Potential", "Pending", "Paid", "Lost"]),
  contacted: z.boolean(),
  contactName: z.string().max(300).default(""),
  phone: z.string().max(100).default(""),
  email: z.string().max(320).default(""),
  address: z.string().max(500).default(""),
  quoted: money.default(null),
  deposit: money.default(null),
  paid: money.default(null),
  paidDate: isoDate.default(""),
  githubRepo: z.string().max(500).default(""),
  liveUrl: z.string().max(1000).default(""),
  domain: z.string().max(300).default(""),
  nextAction: z.string().max(2000).default(""),
  dueDate: isoDate.default(""),
  notes: z.string().max(20000).default(""),
  lastContacted: isoDate.default(""),
  snoozeUntil: isoDate.default(""),
  lostReason: z.string().max(2000).default(""),
});

export const animalSchema = z.object({
  id: z.string().min(1).max(200),
  version: z.number().int().nonnegative(),
  name: z.string().max(300),
  species: z.string().max(300).default(""),
  enclosure: z.string().max(300).default(""),
  lastFed: isoDate.default(""),
  lastCleaned: isoDate.default(""),
  nextCareDue: isoDate.default(""),
  feedEveryDays: z.number().int().min(1).max(365),
  cleanEveryDays: z.number().int().min(1).max(365),
  notes: z.string().max(20000).default(""),
  snoozeUntil: isoDate.default(""),
});

export const taskSchema = z.object({
  id: z.string().min(1).max(200),
  version: z.number().int().nonnegative(),
  title: z.string().max(500),
  lane: z.enum(["content", "personal"]),
  deadline: isoDate.default(""),
  status: z.enum(["Todo", "Done"]),
  priority: z.enum(["High", "Medium", "Low"]),
  platform: z.string().max(200).default(""),
  category: z.string().max(200).default(""),
  notes: z.string().max(20000).default(""),
  snoozeUntil: isoDate.default(""),
});

export const schemas = {
  client: clientSchema,
  animal: animalSchema,
  task: taskSchema,
} as const;

export type EntityKind = keyof typeof schemas;
