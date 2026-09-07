import { promises as fs } from "node:fs";
import { get, put } from "@vercel/blob";

const LIVE_PATH = "clients.json";
const MIGRATED_PATH = "clients.migrated.json";
const PREFIX = "Client1-";
const APPLY = process.argv.includes("--apply");
const SOURCE_ARG = process.argv.find((arg) => arg.startsWith("--source="))?.slice("--source=".length) ?? "data/clients.json";
const token = (process.env.LIFE_TRACKER_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN)?.match(/vercel_blob_[A-Za-z0-9_-]+/)?.[0];
const access = process.env.BLOB_ACCESS_MODE?.trim().toLowerCase();

if (!token?.startsWith("vercel_blob_")) throw new Error("Set LIFE_TRACKER_BLOB_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN to the canonical Blob store token");
if (access !== "private" && access !== "public") throw new Error("Set BLOB_ACCESS_MODE to private or public for the canonical Blob store");

function idFor(index) {
  return `${PREFIX}${String(index + 1).padStart(3, "0")}`;
}

async function readBlob(pathname) {
  const result = await get(pathname, { access, useCache: false, token });
  if (!result?.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

async function readSource() {
  return JSON.parse(await fs.readFile(SOURCE_ARG, "utf8"));
}

function validateClients(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty JSON array`);
  for (const [index, client] of value.entries()) {
    if (!client || typeof client !== "object" || typeof client.client !== "string") {
      throw new Error(`${label} record ${index + 1} is not a valid client`);
    }
  }
}

function assertEquivalent(before, after) {
  if (before.length !== after.length) throw new Error("Record count changed during migration");
  if (JSON.stringify(before.map((client) => client.client)) !== JSON.stringify(after.map((client) => client.client))) {
    throw new Error("Client order or names changed during migration");
  }
  const ids = after.map((client) => client.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs generated");
  ids.forEach((id, index) => {
    if (id !== idFor(index)) throw new Error(`Unexpected migrated ID: ${id}`);
  });
}

async function writeBlob(pathname, value) {
  return put(pathname, JSON.stringify(value, null, 2), {
    access,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token,
  });
}

const remote = await readBlob(LIVE_PATH);
const original = remote ?? await readSource();
const source = remote ? `existing Blob ${LIVE_PATH}` : `local source ${SOURCE_ARG}`;
validateClients(original, source);
const migrated = original.map((client, index) => ({ ...client, id: idFor(index) }));
assertEquivalent(original, migrated);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = remote ? `clients.backup-${stamp}.json` : `clients.import-source-${stamp}.json`;
console.log(`Validated ${original.length} clients from ${source}.`);
console.log(`Backup/import copy: ${backupPath}`);
console.log(`Staged migration: ${MIGRATED_PATH}`);

if (!APPLY) {
  console.log("Dry run only. No Blob data was changed. Re-run with --apply to initialize/migrate the canonical store.");
  process.exit(0);
}

await writeBlob(backupPath, original);
const backupCheck = await readBlob(backupPath);
validateClients(backupCheck, "Backup/import Blob data");
if (JSON.stringify(backupCheck) !== JSON.stringify(original)) throw new Error("Backup/import verification failed; canonical data was not changed");

await writeBlob(MIGRATED_PATH, migrated);
const stagedCheck = await readBlob(MIGRATED_PATH);
validateClients(stagedCheck, "Staged Blob data");
assertEquivalent(original, stagedCheck);

await writeBlob(LIVE_PATH, stagedCheck);
const liveCheck = await readBlob(LIVE_PATH);
validateClients(liveCheck, "Final canonical Blob data");
assertEquivalent(original, liveCheck);
console.log(`Canonical migration complete. ${liveCheck.length} records are in ${LIVE_PATH}.`);
console.log(`Rollback/import copy retained at ${backupPath}.`);
