import { get, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { detectBlobToken } from "@/lib/clients/storage";
import type { Client } from "@/lib/clients/types";

export const runtime = "nodejs";

const LIVE_PATH = "clients.json";
const STAGED_PATH = "clients.migrated.json";
const PREFIX = "Client1-";

function idFor(index: number): string {
  return `${PREFIX}${String(index + 1).padStart(3, "0")}`;
}

async function readBlob(pathname: string, token: string): Promise<unknown> {
  try {
    const result = await get(pathname, { access: "private", useCache: false, token });
    if (result?.statusCode === 200 && result.stream) {
      return JSON.parse(await new Response(result.stream).text());
    }
  } catch {
    // Fall back to listing when get() rejects a missing/private blob.
  }
  const { blobs } = await list({ prefix: pathname, limit: 20, token });
  const match = blobs.find((blob) => blob.pathname === pathname);
  if (!match) throw new Error(`Blob ${pathname} was not found`);
  const response = await fetch(match.downloadUrl || match.url);
  if (!response.ok) throw new Error(`Unable to download ${pathname}`);
  return response.json();
}

function validate(value: unknown, label: string): Client[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} is empty or invalid`);
  for (const client of value) {
    if (!client || typeof client !== "object" || typeof (client as Client).client !== "string") {
      throw new Error(`${label} contains an invalid client`);
    }
  }
  return value as Client[];
}

function assertEquivalent(before: Client[], after: Client[]): void {
  if (before.length !== after.length) throw new Error("Record count changed");
  if (JSON.stringify(before.map((client) => client.client)) !== JSON.stringify(after.map((client) => client.client))) {
    throw new Error("Client order or names changed");
  }
  const ids = after.map((client) => client.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs generated");
  ids.forEach((id, index) => {
    if (id !== idFor(index)) throw new Error(`Unexpected ID ${id}`);
  });
}

async function writeBlob(pathname: string, value: Client[], token: string): Promise<void> {
  await put(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}

async function migrate(request: Request) {
  const body = await request.text();
  if (body.trim() !== "MIGRATE Client1") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const detected = detectBlobToken();
  if (!detected) return NextResponse.json({ error: "No Blob token is configured" }, { status: 503 });

  try {
    const original = validate(await readBlob(LIVE_PATH, detected.value), "Live Blob data");
    const migrated = original.map((client, index) => ({ ...client, id: idFor(index) }));
    assertEquivalent(original, migrated);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `clients.backup-${stamp}.json`;
    await writeBlob(backupPath, original, detected.value);
    const backup = validate(await readBlob(backupPath, detected.value), "Backup Blob data");
    if (JSON.stringify(backup) !== JSON.stringify(original)) throw new Error("Backup verification failed");

    await writeBlob(STAGED_PATH, migrated, detected.value);
    const staged = validate(await readBlob(STAGED_PATH, detected.value), "Staged Blob data");
    assertEquivalent(original, staged);

    await writeBlob(LIVE_PATH, staged, detected.value);
    const final = validate(await readBlob(LIVE_PATH, detected.value), "Final Blob data");
    assertEquivalent(original, final);

    return NextResponse.json({ migrated: final.length, backup: backupPath });
  } catch (error) {
    console.error("Client ID migration failed", error);
    return NextResponse.json({ error: "Migration failed before completion" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return migrate(request);
}

export async function GET(request: Request) {
  const confirmation = new URL(request.url).searchParams.get("confirm");
  if (confirmation !== "MIGRATE Client1") {
    return NextResponse.json({ message: "Confirmation required" }, { status: 405 });
  }
  return migrate(new Request(request.url, { method: "POST", body: confirmation }));
}
