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
    if (existing && existing.length > 0) return existing;
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
