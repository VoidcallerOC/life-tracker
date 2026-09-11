"use client";

import type { EntityKind } from "@/lib/os/types";
import {
  ConflictError,
  OfflineError,
  createRecord,
  deleteRecord,
  restoreRecord,
  updateRecord,
  type SyncRecord,
} from "@/lib/os/sync";

/**
 * A durable queue of writes that could not reach the server.
 *
 * Marking an animal fed in a basement with no signal has to survive closing the
 * app, so the queue lives in IndexedDB rather than memory. Entries replay in
 * order when connectivity returns; a conflict on replay is dropped (the server's
 * copy already moved on) and surfaced to the caller.
 */

const DB_NAME = "life-os-outbox";
const STORE = "writes";
const DB_VERSION = 1;

export type OutboxEntry = {
  id: number;
  kind: EntityKind;
  op: "create" | "update" | "delete" | "restore";
  record?: SyncRecord;
  recordId: string;
  version: number;
  label: string;
  queuedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function outboxAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueue(entry: Omit<OutboxEntry, "id" | "queuedAt">): Promise<void> {
  if (!outboxAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add({ ...entry, queuedAt: Date.now() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function pending(): Promise<OutboxEntry[]> {
  if (!outboxAvailable()) return [];
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await promisify(tx.objectStore(STORE).getAll() as IDBRequest<OutboxEntry[]>);
  db.close();
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

async function remove(id: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export type FlushResult = { sent: number; conflicted: number; remaining: number };

/**
 * Replays queued writes oldest-first. Stops at the first genuine network
 * failure so ordering is preserved for the next attempt.
 */
export async function flush(): Promise<FlushResult> {
  const entries = await pending();
  let sent = 0;
  let conflicted = 0;

  for (const entry of entries) {
    try {
      switch (entry.op) {
        case "create":
          if (entry.record) await createRecord(entry.kind, entry.record);
          break;
        case "update":
          if (entry.record) await updateRecord(entry.kind, entry.record);
          break;
        case "restore":
          if (entry.record) await restoreRecord(entry.kind, entry.record);
          break;
        case "delete":
          await deleteRecord(entry.kind, entry.recordId, entry.version);
          break;
      }
      await remove(entry.id);
      sent += 1;
    } catch (error) {
      if (error instanceof OfflineError) {
        return { sent, conflicted, remaining: entries.length - sent - conflicted };
      }
      if (error instanceof ConflictError) {
        // The server already has a newer version of this record; the queued
        // edit is stale, so drop it rather than blocking the rest of the queue.
        await remove(entry.id);
        conflicted += 1;
        continue;
      }
      // A malformed or rejected entry would otherwise wedge the queue forever.
      console.error("Dropping unreplayable outbox entry", entry, error);
      await remove(entry.id);
    }
  }

  return { sent, conflicted, remaining: 0 };
}

export async function clearOutbox(): Promise<void> {
  if (!outboxAvailable()) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
  db.close();
}
