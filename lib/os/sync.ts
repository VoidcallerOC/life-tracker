"use client";

import type { Animal, Client, EntityKind, Task } from "@/lib/os/types";

/**
 * The write path from the browser to the API.
 *
 * Every call targets exactly one record and carries the version that record had
 * when it was read. A 409 means another device changed it first; the caller
 * rolls its optimistic edit back and reloads rather than overwriting.
 */

const paths: Record<EntityKind, string> = {
  client: "/api/clients",
  animal: "/api/animals",
  task: "/api/tasks",
};

export type SyncRecord = Client | Animal | Task;

export class ConflictError extends Error {
  constructor(readonly kind: EntityKind, readonly id: string) {
    super("This record changed on another device.");
    this.name = "ConflictError";
  }
}

export class OfflineError extends Error {
  constructor() {
    super("You are offline. The change is queued and will sync when you reconnect.");
    this.name = "OfflineError";
  }
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

async function send(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      credentials: "same-origin",
      cache: "no-store",
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (isNetworkFailure(error)) throw new OfflineError();
    throw error;
  }
  if (response.status === 401) {
    // A full document load, not a client-side route change: the session is gone,
    // so every bit of in-memory state belonging to it must be dropped too.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Signed out");
  }
  return response;
}

export async function createRecord<T extends SyncRecord>(kind: EntityKind, record: T): Promise<T> {
  const response = await send("POST", paths[kind], record);
  if (!response.ok) throw new Error(`Create failed (${response.status})`);
  return (await response.json()) as T;
}

export async function updateRecord<T extends SyncRecord>(kind: EntityKind, record: T): Promise<T> {
  const response = await send("PATCH", `${paths[kind]}/${encodeURIComponent(record.id)}`, record);
  if (response.status === 409) throw new ConflictError(kind, record.id);
  if (!response.ok) throw new Error(`Save failed (${response.status})`);
  return (await response.json()) as T;
}

export async function deleteRecord(kind: EntityKind, id: string, version: number): Promise<void> {
  const response = await send(
    "DELETE",
    `${paths[kind]}/${encodeURIComponent(id)}?version=${version}`,
  );
  if (response.status === 409) throw new ConflictError(kind, id);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete failed (${response.status})`);
  }
}

export async function restoreRecord<T extends SyncRecord>(kind: EntityKind, record: T): Promise<T> {
  const response = await send("PUT", `${paths[kind]}/${encodeURIComponent(record.id)}`, record);
  if (!response.ok) throw new Error(`Restore failed (${response.status})`);
  return (await response.json()) as T;
}

export type Snapshot = {
  clients: Client[];
  animals: Animal[];
  tasks: Task[];
  coachDismissed: boolean;
};

/** Re-reads server state — used after a conflict and when the tab regains focus. */
export async function fetchSnapshot(): Promise<Snapshot> {
  let response: Response;
  try {
    response = await fetch("/api/snapshot", {
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (isNetworkFailure(error)) throw new OfflineError();
    throw error;
  }
  if (response.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Signed out");
  }
  if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
  return (await response.json()) as Snapshot;
}
