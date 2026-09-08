import type { BlobAccessType, GetBlobResult, PutBlobResult } from "@vercel/blob";

// Vercel Blob stores are either public or private. The access mode is a
// property of the store, not of an individual request. Prefer the configured
// mode, but tolerate an existing store created with the other mode so a
// deployment cannot become unreadable during a store migration.
function sanitizeToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("vercel_blob_")) return trimmed;
  }
  return raw.split(/\s+/).map((part) => part.trim()).find(Boolean);
}

function isBlobTokenValue(value: string | undefined): value is string {
  return !!value && value.startsWith("vercel_blob_");
}

export function detectBlobToken(): { name: string; value: string } | null {
  const preferred = ["Client1_READ_WRITE_TOKEN", "CLIENT1_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"];
  for (const name of preferred) {
    const value = sanitizeToken(process.env[name]);
    if (isBlobTokenValue(value)) return { name, value };
  }

  for (const [name, raw] of Object.entries(process.env)) {
    const value = sanitizeToken(raw);
    if (isBlobTokenValue(value) && name.endsWith("_READ_WRITE_TOKEN")) {
      return { name, value };
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

export function blobTokenValue(): string | undefined {
  return detectBlobToken()?.value;
}

function configuredAccess(): BlobAccessType {
  const value = (process.env.BLOB_ACCESS_MODE ?? "private").trim().toLowerCase();
  if (value !== "private" && value !== "public") {
    throw new Error("BLOB_ACCESS_MODE must be either private or public");
  }
  return value;
}

export function blobAccessMode(): BlobAccessType {
  return configuredAccess();
}

export function blobAccessModes(): BlobAccessType[] {
  const first = configuredAccess();
  return [first, first === "private" ? "public" : "private"];
}

export function isBlobAccessModeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /access mode|public.*private|private.*public|store.*(public|private)/i.test(message);
}

export function productionStorageRequired(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function assertBlobConfigured(): void {
  if (!blobEnabled() && productionStorageRequired()) {
    throw new Error(
      "Vercel Blob is not configured. Connect a Blob store to this project and set its *_READ_WRITE_TOKEN, then redeploy.",
    );
  }
}

export async function getBlob(pathname: string): Promise<GetBlobResult | null> {
  const { get } = await import("@vercel/blob");
  let lastError: unknown;
  for (const access of blobAccessModes()) {
    try {
      const result = await get(pathname, {
        access,
        useCache: false,
        token: blobTokenValue(),
      });
      if (result) return result;
    } catch (error) {
      lastError = error;
      if (!isBlobAccessModeError(error)) break;
    }
  }
  if (lastError && !isBlobAccessModeError(lastError)) throw lastError;
  return null;
}

export async function putBlob(pathname: string, body: string): Promise<PutBlobResult> {
  const { put } = await import("@vercel/blob");
  let lastError: unknown;
  for (const [index, access] of blobAccessModes().entries()) {
    try {
      return await put(pathname, body, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json",
        token: blobTokenValue(),
      });
    } catch (error) {
      lastError = error;
      if (index === 0 && isBlobAccessModeError(error)) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Vercel Blob write failed");
}
