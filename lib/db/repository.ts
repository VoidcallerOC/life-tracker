import "server-only";
import type { Animal, Client, LifeSnapshot, Task } from "@/lib/os/types";
import { NotFoundError, VersionConflictError, sql } from "@/lib/db/client";
import {
  animalToRow,
  clientToRow,
  rowToAnimal,
  rowToClient,
  rowToTask,
  taskToRow,
  type AnimalRecordRow,
  type ClientRow,
  type TaskRecordRow,
} from "@/lib/db/rows";

const CLIENT_COLUMNS = [
  "id", "name", "business_type", "status", "contacted", "contact_name", "phone",
  "email", "address", "quoted", "deposit", "paid", "paid_date", "github_repo",
  "live_url", "domain", "next_action", "due_date", "notes", "last_contacted",
  "snooze_until", "lost_reason",
] as const;

const ANIMAL_COLUMNS = [
  "id", "name", "species", "enclosure", "last_fed", "last_cleaned",
  "next_care_due", "feed_every_days", "clean_every_days", "notes", "snooze_until",
] as const;

const TASK_COLUMNS = [
  "id", "title", "lane", "deadline", "status", "priority", "platform",
  "category", "notes", "snooze_until",
] as const;

/**
 * Every mutation goes through one of these three shapes: insert, version-checked
 * update, or version-checked soft delete. A caller can't accidentally write the
 * whole table, which is what made the previous blob storage so easy to destroy.
 */
type Table = "clients" | "animals" | "tasks";

async function currentVersion(table: Table, id: string): Promise<number | null> {
  const db = sql();
  const rows = await db<{ version: number }[]>`
    SELECT version FROM ${db(table)} WHERE id = ${id} AND deleted_at IS NULL
  `;
  return rows.length > 0 ? rows[0].version : null;
}

async function assertWritable(table: Table, id: string, expected: number): Promise<void> {
  const version = await currentVersion(table, id);
  if (version === null) throw new NotFoundError(table, id);
  if (version !== expected) {
    throw new VersionConflictError(table, id, version);
  }
}

// --- clients ---------------------------------------------------------------

export async function listClients(): Promise<Client[]> {
  const db = sql();
  const rows = await db<ClientRow[]>`
    SELECT ${db(CLIENT_COLUMNS as unknown as string[])}, version
    FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC
  `;
  return rows.map(rowToClient);
}

export async function getClient(id: string): Promise<Client | null> {
  const db = sql();
  const rows = await db<ClientRow[]>`
    SELECT ${db(CLIENT_COLUMNS as unknown as string[])}, version
    FROM clients WHERE id = ${id} AND deleted_at IS NULL
  `;
  return rows.length > 0 ? rowToClient(rows[0]) : null;
}

export async function insertClient(client: Client): Promise<Client> {
  const db = sql();
  const rows = await db<ClientRow[]>`
    INSERT INTO clients ${db(clientToRow(client), CLIENT_COLUMNS as unknown as string[])}
    RETURNING ${db(CLIENT_COLUMNS as unknown as string[])}, version
  `;
  return rowToClient(rows[0]);
}

export async function updateClient(client: Client, expectedVersion: number): Promise<Client> {
  const db = sql();
  await assertWritable("clients", client.id, expectedVersion);
  const writable = CLIENT_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<ClientRow[]>`
    UPDATE clients SET ${db(clientToRow(client), writable)}
    WHERE id = ${client.id} AND version = ${expectedVersion} AND deleted_at IS NULL
    RETURNING ${db(CLIENT_COLUMNS as unknown as string[])}, version
  `;
  if (rows.length === 0) throw new VersionConflictError("clients", client.id, null);
  return rowToClient(rows[0]);
}

export async function softDeleteClient(id: string, expectedVersion: number): Promise<void> {
  const db = sql();
  await assertWritable("clients", id, expectedVersion);
  await db`UPDATE clients SET deleted_at = now() WHERE id = ${id} AND version = ${expectedVersion}`;
}

/** Undo of a delete: bring the row back rather than re-creating a new id. */
export async function restoreClient(client: Client): Promise<Client> {
  const db = sql();
  const writable = CLIENT_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<ClientRow[]>`
    INSERT INTO clients ${db(clientToRow(client), CLIENT_COLUMNS as unknown as string[])}
    ON CONFLICT (id) DO UPDATE SET ${db(clientToRow(client), writable)}, deleted_at = NULL
    RETURNING ${db(CLIENT_COLUMNS as unknown as string[])}, version
  `;
  return rowToClient(rows[0]);
}

// --- animals ---------------------------------------------------------------

export async function listAnimals(): Promise<Animal[]> {
  const db = sql();
  const rows = await db<AnimalRecordRow[]>`
    SELECT ${db(ANIMAL_COLUMNS as unknown as string[])}, version
    FROM animals WHERE deleted_at IS NULL ORDER BY created_at DESC
  `;
  return rows.map(rowToAnimal);
}

export async function getAnimal(id: string): Promise<Animal | null> {
  const db = sql();
  const rows = await db<AnimalRecordRow[]>`
    SELECT ${db(ANIMAL_COLUMNS as unknown as string[])}, version
    FROM animals WHERE id = ${id} AND deleted_at IS NULL
  `;
  return rows.length > 0 ? rowToAnimal(rows[0]) : null;
}

export async function insertAnimal(animal: Animal): Promise<Animal> {
  const db = sql();
  const rows = await db<AnimalRecordRow[]>`
    INSERT INTO animals ${db(animalToRow(animal), ANIMAL_COLUMNS as unknown as string[])}
    RETURNING ${db(ANIMAL_COLUMNS as unknown as string[])}, version
  `;
  return rowToAnimal(rows[0]);
}

export async function updateAnimal(animal: Animal, expectedVersion: number): Promise<Animal> {
  const db = sql();
  await assertWritable("animals", animal.id, expectedVersion);
  const writable = ANIMAL_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<AnimalRecordRow[]>`
    UPDATE animals SET ${db(animalToRow(animal), writable)}
    WHERE id = ${animal.id} AND version = ${expectedVersion} AND deleted_at IS NULL
    RETURNING ${db(ANIMAL_COLUMNS as unknown as string[])}, version
  `;
  if (rows.length === 0) throw new VersionConflictError("animals", animal.id, null);
  return rowToAnimal(rows[0]);
}

export async function softDeleteAnimal(id: string, expectedVersion: number): Promise<void> {
  const db = sql();
  await assertWritable("animals", id, expectedVersion);
  await db`UPDATE animals SET deleted_at = now() WHERE id = ${id} AND version = ${expectedVersion}`;
}

export async function restoreAnimal(animal: Animal): Promise<Animal> {
  const db = sql();
  const writable = ANIMAL_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<AnimalRecordRow[]>`
    INSERT INTO animals ${db(animalToRow(animal), ANIMAL_COLUMNS as unknown as string[])}
    ON CONFLICT (id) DO UPDATE SET ${db(animalToRow(animal), writable)}, deleted_at = NULL
    RETURNING ${db(ANIMAL_COLUMNS as unknown as string[])}, version
  `;
  return rowToAnimal(rows[0]);
}

// --- tasks -----------------------------------------------------------------

export async function listTasks(): Promise<Task[]> {
  const db = sql();
  const rows = await db<TaskRecordRow[]>`
    SELECT ${db(TASK_COLUMNS as unknown as string[])}, version
    FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC
  `;
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const db = sql();
  const rows = await db<TaskRecordRow[]>`
    SELECT ${db(TASK_COLUMNS as unknown as string[])}, version
    FROM tasks WHERE id = ${id} AND deleted_at IS NULL
  `;
  return rows.length > 0 ? rowToTask(rows[0]) : null;
}

export async function insertTask(task: Task): Promise<Task> {
  const db = sql();
  const rows = await db<TaskRecordRow[]>`
    INSERT INTO tasks ${db(taskToRow(task), TASK_COLUMNS as unknown as string[])}
    RETURNING ${db(TASK_COLUMNS as unknown as string[])}, version
  `;
  return rowToTask(rows[0]);
}

export async function updateTask(task: Task, expectedVersion: number): Promise<Task> {
  const db = sql();
  await assertWritable("tasks", task.id, expectedVersion);
  const writable = TASK_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<TaskRecordRow[]>`
    UPDATE tasks SET ${db(taskToRow(task), writable)},
      completed_at = ${task.status === "Done" ? new Date() : null}
    WHERE id = ${task.id} AND version = ${expectedVersion} AND deleted_at IS NULL
    RETURNING ${db(TASK_COLUMNS as unknown as string[])}, version
  `;
  if (rows.length === 0) throw new VersionConflictError("tasks", task.id, null);
  return rowToTask(rows[0]);
}

export async function softDeleteTask(id: string, expectedVersion: number): Promise<void> {
  const db = sql();
  await assertWritable("tasks", id, expectedVersion);
  await db`UPDATE tasks SET deleted_at = now() WHERE id = ${id} AND version = ${expectedVersion}`;
}

export async function restoreTask(task: Task): Promise<Task> {
  const db = sql();
  const writable = TASK_COLUMNS.filter((c) => c !== "id") as unknown as string[];
  const rows = await db<TaskRecordRow[]>`
    INSERT INTO tasks ${db(taskToRow(task), TASK_COLUMNS as unknown as string[])}
    ON CONFLICT (id) DO UPDATE SET ${db(taskToRow(task), writable)}, deleted_at = NULL
    RETURNING ${db(TASK_COLUMNS as unknown as string[])}, version
  `;
  return rowToTask(rows[0]);
}

// --- settings --------------------------------------------------------------

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const db = sql();
  const rows = await db<{ value: T }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length > 0 ? rows[0].value : fallback;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO settings (key, value) VALUES (${key}, ${db.json(value as never)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

// --- snapshot --------------------------------------------------------------

/** One round-trip per table to build the initial page payload. */
export async function readSnapshot(): Promise<LifeSnapshot> {
  const [clients, animals, tasks, coachDismissed] = await Promise.all([
    listClients(),
    listAnimals(),
    listTasks(),
    readSetting<boolean>("coachDismissed", false),
  ]);
  return { clients, animals, tasks, coachDismissed };
}
