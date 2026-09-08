import type { BlobAccessType, GetBlobResult, PutBlobResult } from "@vercel/blob";

const TOKEN_PATTERN = /vercel_blob_[A-Za-z0-9_-]+/;

function sanitizeToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.match(TOKEN_PATTERN)?.[0];
}

function isBlobTokenValue(value: string | undefined): value is string {
  return !!value && TOKEN_PATTERN.test(value);
}

/** Return the one token this application is allowed to use for its canonical store. */
export function detectBlobToken(): { name: string; value: string } | null {
  const explicitNames = [
    "LIFE_TRACKER_BLOB_READ_WRITE_TOKEN",
    "BLOB_READ_WRITE_TOKEN",
    "Client1_READ_WRITE_TOKEN",
    "CLIENT1_READ_WRITE_TOKEN",
  ];

  for (const name of explicitNames) {
    const value = sanitizeToken(process.env[name]);
    if (isBlobTokenValue(value)) return { name, value };
  }

  const candidates = Object.entries(process.env)
    .filter(([name]) => name.endsWith("_READ_WRITE_TOKEN"))
    .map(([name, raw]) => ({ name, value: sanitizeToken(raw) }))
    .filter((candidate): candidate is { name: string; value: string } => isBlobTokenValue(candidate.value));

  return candidates.length === 1 ? candidates[0] : null;
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

/**
 * Vercel's older integrations did not expose BLOB_ACCESS_MODE. Private is the
 * safe default for the app's read/write token; an explicit value still wins.
 */
export function blobAccessModes(): BlobAccessType[] {
  const configured = process.env.BLOB_ACCESS_MODE?.trim().toLowerCase();
  if (configured === "private" || configured === "public") return [configured];
  return ["private", "public"];
}

export function blobAccessMode(): BlobAccessType {
  return blobAccessModes()[0];
}

export function productionStorageRequired(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function assertBlobConfigured(): void {
  if (!blobEnabled() && productionStorageRequired()) {
    throw new Error(
      "Canonical client storage is not configured. Set LIFE_TRACKER_BLOB_READ_WRITE_TOKEN (or BLOB_READ_WRITE_TOKEN) to the connected store token and redeploy.",
    );
  }
}

function isAccessModeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /access mode|public.*private|private.*public|store.*(public|private)/i.test(message);
}

export async function getBlob(pathname: string): Promise<GetBlobResult | null> {
  const { get } = await import("@vercel/blob");
  let lastError: unknown;
  for (const access of blobAccessModes()) {
    try {
      return await get(pathname, { access, useCache: false, token: blobTokenValue() });
    } catch (error) {
      lastError = error;
      if (!isAccessModeError(error)) throw error;
    }
  }
  if (lastError && !isAccessModeError(lastError)) throw lastError;
  return null;
}

export async function putBlob(pathname: string, body: string): Promise<PutBlobResult> {
  const { put } = await import("@vercel/blob");
  let lastError: unknown;
  for (const access of blobAccessModes()) {
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
      if (!isAccessModeError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Vercel Blob write failed");
}
