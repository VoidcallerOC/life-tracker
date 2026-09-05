import { get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { Client } from "./types";
import { blobEnabled, blobTokenValue as tokenValue } from "@/lib/blob";

export { detectBlobToken, blobEnabled, blobTokenName } from "@/lib/blob";

const BLOB_PATHNAME = "clients.json";

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

async function fetchBlobText(url: string, token?: string): Promise<string | null> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return null;
  return res.text();
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
    const match =
      blobs.find((b) => b.pathname === BLOB_PATHNAME) ??
      blobs.find((b) => b.pathname.startsWith(BLOB_PATHNAME));
    if (!match) return null;
    const url = match.downloadUrl || match.url;
    const text = await fetchBlobText(url, token);
    if (!text) return null;
    return parseClientsJson(text);
  } catch {
    return null;
  }
}

async function writeToBlob(clients: Client[]): Promise<void> {
  const body = JSON.stringify(clients, null, 2);
  await put(BLOB_PATHNAME, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token: tokenValue(),
  });
}

export async function readClients(): Promise<Client[]> {
  if (blobEnabled()) {
    const existing = await readFromBlob();
    if (existing) return existing;
    // Only seed when the blob truly does not exist. Never overwrite a
    // read failure — that was wiping live edits after Save.
    return loadShippedSeed();
  }

  try {
    const raw = await fs.readFile(localDataPath(), "utf8");
    const parsed = await parseClientsJson(raw);
    if (parsed) return parsed;
  } catch {
    // No local file yet.
  }
  return loadShippedSeed();
}

export async function writeClients(clients: Client[]): Promise<void> {
  if (clients.length === 0) {
    throw new Error("Refusing to write an empty client list");
  }
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
