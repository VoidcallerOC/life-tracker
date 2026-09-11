import { promises as fs } from "fs";
import path from "path";
import type { Store } from "@/lib/types";
import { isEmptyStore } from "@/lib/store";
import { starterStore } from "@/lib/lifeStore/seed";
import { assertBlobConfigured, blobEnabled, getBlob, productionStorageRequired, putBlob } from "@/lib/blob";

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

async function readFromBlob(): Promise<Store | null> {
  try {
    const result = await getBlob(BLOB_PATHNAME);
    if (!result?.stream) return null;
    const parsed = normalizeStore(await new Response(result.stream).json());
    if (!parsed) {
      console.error("Blob life-store.json is invalid");
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to read life-store.json from Blob:", error);
    return null;
  }
}

async function writeToBlob(store: Store): Promise<void> {
  const uploaded = await putBlob(BLOB_PATHNAME, JSON.stringify(store, null, 2));
  const check = await getBlob(uploaded.url);
  if (!check?.stream || !normalizeStore(await new Response(check.stream).json())) {
    console.error("Blob write verification failed for life-store.json");
    throw new Error("Blob write verification failed");
  }
}

export async function readStore(): Promise<Store> {
  let store: Store | null = null;
  if (blobEnabled()) {
    store = await readFromBlob();
  } else {
    assertBlobConfigured();
    try {
      store = normalizeStore(JSON.parse(await fs.readFile(localDataPath(), "utf8")) as unknown);
    } catch {
      // Local development may start without a data file.
    }
  }

  if (!store || isEmptyStore(store)) {
    store = starterStore();
    await writeStore(store);
  }
  return store;
}

export async function writeStore(store: Store): Promise<void> {
  if (blobEnabled()) {
    await writeToBlob(store);
    return;
  }
  assertBlobConfigured();
  if (productionStorageRequired()) throw new Error("Refusing to write life-store data to the production filesystem");
  await fs.mkdir(path.dirname(localDataPath()), { recursive: true });
  await fs.writeFile(localDataPath(), JSON.stringify(store, null, 2));
}

export async function resetStore(): Promise<Store> {
  await writeStore(EMPTY_STORE);
  return EMPTY_STORE;
}
