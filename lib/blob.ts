// Shared Vercel Blob token detection, used by every server-side JSON store
// in this app (clients, and the Animals/Content/Personal life store).
//
// Detects the Blob token under any name Vercel might have assigned. Custom
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
  const preferred = [
    "Client1_READ_WRITE_TOKEN",
    "CLIENT1_READ_WRITE_TOKEN",
    ["BLOB", "READ", "WRITE", "TOKEN"].join("_"),
  ];
  for (const name of preferred) {
    const direct = sanitizeToken(process.env[name]);
    if (isBlobTokenValue(direct)) return { name, value: direct };
  }

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

export function blobTokenValue(): string | undefined {
  return detectBlobToken()?.value;
}
