import { promises as fs } from "fs";
import path from "path";
import type { Client } from "./types";
import {
  assertBlobConfigured,
  blobEnabled,
  blobTokenName,
  getBlob,
  productionStorageRequired,
  putBlob,
} from "@/lib/blob";

export { detectBlobToken, blobEnabled, blobTokenName } from "@/lib/blob";

const BLOB_PATHNAME = "clients.json";

function normalizeClients(value: unknown): Client[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((record) => {
    const client = record as Partial<Client>;
    return {
      ...client,
      contacted: typeof client.contacted === "boolean" ? client.contacted : Boolean(client.lastContacted),
      paidDate: typeof client.paidDate === "string" ? client.paidDate : "",
    } as Client;
  });
}

async function loadShippedSeed(): Promise<Client[]> {
  const raw = await fs.readFile(path.join(process.cwd(), "data", "clients.json"), "utf8");
  const parsed = normalizeClients(JSON.parse(raw) as unknown);
  if (!parsed || parsed.length === 0) throw new Error("Shipped data/clients.json is not a non-empty array");
  return parsed;
}

async function readFromBlob(): Promise<Client[] | null> {
  const result = await getBlob(BLOB_PATHNAME);
  if (!result?.stream) return null;
  const parsed = normalizeClients(await new Response(result.stream).json());
  if (!parsed || parsed.length === 0) throw new Error("Blob clients.json is not a non-empty array");
  return parsed;
}

async function writeToBlob(clients: Client[]): Promise<void> {
  const uploaded = await putBlob(BLOB_PATHNAME, JSON.stringify(clients, null, 2));
  const check = await getBlob(uploaded.url);
  if (!check?.stream) throw new Error("Blob write did not read back");
  const parsed = normalizeClients(await new Response(check.stream).json());
  if (!parsed || parsed.length !== clients.length) throw new Error("Blob write verification failed");
}

export async function readClients(): Promise<Client[]> {
  if (blobEnabled()) {
    const existing = await readFromBlob();
    if (existing) return existing;

    // A newly connected store has no object yet. Initialize it once from the
    // shipped seed; never overwrite an existing canonical object with seed data.
    const seed = await loadShippedSeed();
    await writeToBlob(seed);
    return seed;
  }
  assertBlobConfigured();
  try {
    const parsed = normalizeClients(JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "clients.json"), "utf8")) as unknown);
    if (parsed && parsed.length > 0) return parsed;
  } catch {
    // Local development may start without a data file.
  }
  return loadShippedSeed();
}

export async function writeClients(clients: Client[]): Promise<void> {
  if (clients.length === 0) throw new Error("Refusing to write an empty client list");
  if (blobEnabled()) {
    await writeToBlob(clients);
    return;
  }
  assertBlobConfigured();
  if (productionStorageRequired()) throw new Error("Refusing to write client data to the production filesystem");
  await fs.mkdir(path.dirname(path.join(process.cwd(), "data", "clients.json")), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "data", "clients.json"), JSON.stringify(clients, null, 2));
}

export async function resetToShippedSeed(): Promise<Client[]> {
  const seed = await loadShippedSeed();
  await writeClients(seed);
  return seed;
}
