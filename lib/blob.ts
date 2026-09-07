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

  // Do not guess between multiple Blob stores. Guessing is what can make a
  // valid deployment appear to lose clients.json from the wrong store.
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

export function blobAccessMode(): BlobAccessType {
  const raw = process.env.BLOB_ACCESS_MODE?.trim().toLowerCase();
  if (raw !== "private" && raw !== "public") {
    throw new Error("BLOB_ACCESS_MODE must be explicitly set to private or public for the canonical client store");
  }
  return raw;
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
  if (productionStorageRequired()) blobAccessMode();
}

export async function getBlob(pathname: string): Promise<GetBlobResult | null> {
  const { get } = await import("@vercel/blob");
  return get(pathname, {
    access: blobAccessMode(),
    useCache: false,
    token: blobTokenValue(),
  });
}

export async function putBlob(pathname: string, body: string): Promise<PutBlobResult> {
  const { put } = await import("@vercel/blob");
  return put(pathname, body, {
    access: blobAccessMode(),
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token: blobTokenValue(),
  });
}
