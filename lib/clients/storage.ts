import { get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { Client } from "./types";

const BLOB_PATHNAME = "clients.json";
const CLIENT_ID_PREFIX = "Client1-";

// Detect the Blob token under any name Vercel might have assigned. Custom
// store names get a store-name prefix (e.g. MY_STORE_READ_WRITE_TOKEN), so
// hard-coding BLOB_READ_WRITE_TOKEN misses those. Sanitizes the value:
// grabs the first non-empty line that looks like a Blob token, so a
// multi-line paste (token + store-id, or full .env.local dump) still works.
function sanitizeToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("vercel_blob_")) return trimmed;
  }
  const first = raw.split(/\s+/).map((s) => s.trim()).find(Boolean);
  return first || undefined;
}

function isBlobTokenValue(v: string | undefined): v is string {
  return !!v && v.startsWith("vercel_blob_");
}

export function detectBlobToken(): { name: string; value: string } | null {
  const preferred = ["BLOB", "READ", "WRITE", "TOKEN"].join("_");
  const direct = sanitizeToken(process.env[preferred]);
  if (isBlobTokenValue(direct)) return { name: preferred, value: direct };

  const suffix = ["READ", "WRITE", "TOKEN"].join("_");
  for (const [k, raw] of Object.entries(process.env)) {
    const v = sanitizeToken(raw);
    if (isBlobTokenValue(v) && k.endsWith(`_${suffix}`)) {
      return { name: k, value: v };
    }
  }
  return null;
}

export function blobEnabled(): boolean {
  return detectBlobToken() !== null;
}

export function blobTokenName(): string | null {
  return detectBlobToken()?.name ?? null;
}

function tokenValue(): string | undefined {
  return detectBlobToken()?.value;
}

function localDataPath(): string {
  return path.join(process.cwd(), "data", "clients.json");
}

function normalizeClients(value: unknown): Client[] | null {
  if (!Array.isArray(value)) return null;

  return value.map((record) => {
    const client = record as Partial<Client>;
    return {
      ...client,
      contacted:
        typeof client.contacted === "boolean"
          ? client.contacted
          : Boolean(client.lastContacted),
      paidDate: typeof client.paidDate === "string" ? client.paidDate : "",
    } as Client;
  });
}

function migrateClientIds(clients: Client[]): { clients: Client[]; changed: boolean } {
  let changed = false;
  const migrated = clients.map((client, index) => {
    const id = `${CLIENT_ID_PREFIX}${String(index + 1).padStart(3, "0")}`;
    if (client.id === id) return client;
    changed = true;
    return { ...client, id };
  });
  return { clients: migrated, changed };
}

async function loadShippedSeed(): Promise<Client[]> {
  const filePath = localDataPath();
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = normalizeClients(JSON.parse(raw) as unknown);
  if (!parsed) {
    throw new Error("Shipped data/clients.json is not an array");
  }
  return parsed;
}

async function parseClientsJson(text: string): Promise<Client[] | null> {
  if (!text.trim()) return null;
  return normalizeClients(JSON.parse(text) as unknown);
}

async function readFromBlob(): Promise<Client[] | null> {
  const token = tokenValue();
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
      token,
    });
    if (result && result.statusCode === 200 && result.stream) {
      const text = await new Response(result.stream).text();
      return parseClientsJson(text);
    }
  } catch {
    // Blob may not exist yet — fall through to list().
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 20, token });
    const match = blobs.find((b) => b.pathname === BLOB_PATHNAME);
    if (!match) return null;
    const url = match.downloadUrl || match.url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return parseClientsJson(text);
  } catch {
    return null;
  }
}

// Fails hard on any write error. The previous silent private→public fallback
// could leak client PII if the private ACL API glitched. Better to surface
// the error than to publish the CRM.
async function writeToBlob(clients: Client[]): Promise<void> {
  const body = JSON.stringify(clients, null, 2);
  await put(BLOB_PATHNAME, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: tokenValue(),
  });
}

export async function readClients(): Promise<Client[]> {
  if (blobEnabled()) {
    const existing = await readFromBlob();
    if (existing && existing.length > 0) {
      const migrated = migrateClientIds(existing);
      if (migrated.changed) await writeToBlob(migrated.clients);
      return migrated.clients;
    }
    const seed = await loadShippedSeed();
    await writeToBlob(seed);
    return seed;
  }

  try {
    const raw = await fs.readFile(localDataPath(), "utf8");
    const parsed = await parseClientsJson(raw);
    if (parsed) return parsed;
  } catch {
    // Fall through to seed + write.
  }

  const seed = await loadShippedSeed();
  await fs.mkdir(path.dirname(localDataPath()), { recursive: true });
  await fs.writeFile(localDataPath(), JSON.stringify(seed, null, 2));
  return seed;
}

export async function writeClients(clients: Client[]): Promise<void> {
  if (blobEnabled()) {
    await writeToBlob(clients);
    return;
  }
  await fs.mkdir(path.dirname(localDataPath()), { recursive: true });
  await fs.writeFile(localDataPath(), JSON.stringify(clients, null, 2));
}

export async function resetToShippedSeed(): Promise<Client[]> {
  const seed = await loadShippedSeed();
  await writeClients(seed);
  return seed;
}
