import { get, list, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { Store } from "@/lib/types";
import { blobEnabled, blobTokenValue as tokenValue } from "@/lib/blob";

const BLOB_PATHNAME = "life-store.json";

export const EMPTY_STORE: Store = { animals: [], content: [], personal: [] };

function localDataPath(): string {
  return path.join(process.cwd(), "data", "life-store.json");
}

function normalizeStore(value: unknown): Store | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<Store>;
  return {
    animals: Array.isArray(v.animals) ? v.animals : [],
    content: Array.isArray(v.content) ? v.content : [],
    personal: Array.isArray(v.personal) ? v.personal : [],
  };
}

async function parseStoreJson(text: string): Promise<Store | null> {
  if (!text.trim()) return null;
  return normalizeStore(JSON.parse(text) as unknown);
}

async function readFromBlob(): Promise<Store | null> {
  const token = tokenValue();
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
      token,
    });
    if (result && result.statusCode === 200 && result.stream) {
      const text = await new Response(result.stream).text();
      return parseStoreJson(text);
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
    return parseStoreJson(text);
  } catch {
    return null;
  }
}

async function writeToBlob(store: Store): Promise<void> {
  const body = JSON.stringify(store, null, 2);
  await put(BLOB_PATHNAME, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: tokenValue(),
  });
}

export async function readStore(): Promise<Store> {
  if (blobEnabled()) {
    const existing = await readFromBlob();
    return existing ?? EMPTY_STORE;
  }

  try {
    const raw = await fs.readFile(localDataPath(), "utf8");
    const parsed = await parseStoreJson(raw);
    if (parsed) return parsed;
  } catch {
    // No local file yet — fall through to empty.
  }
  return EMPTY_STORE;
}

export async function writeStore(store: Store): Promise<void> {
  if (blobEnabled()) {
    await writeToBlob(store);
    return;
  }
  await fs.mkdir(path.dirname(localDataPath()), { recursive: true });
  await fs.writeFile(localDataPath(), JSON.stringify(store, null, 2));
}

export async function resetStore(): Promise<Store> {
  await writeStore(EMPTY_STORE);
  return EMPTY_STORE;
}
