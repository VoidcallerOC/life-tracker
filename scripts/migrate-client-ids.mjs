import { get, list, put } from "@vercel/blob";

const LIVE_PATH = "clients.json";
const MIGRATED_PATH = "clients.migrated.json";
const PREFIX = "Client1-";
const APPLY = process.argv.includes("--apply");
const token = Object.entries(process.env)
  .filter(([name]) => name === "BLOB_READ_WRITE_TOKEN" || name.endsWith("_READ_WRITE_TOKEN"))
  .map(([, value]) => value?.split(/\r?\n/).find((line) => line.trim().startsWith("vercel_blob_"))?.trim())
  .find((value) => value?.startsWith("vercel_blob_"));

if (!token) {
  throw new Error("A *_READ_WRITE_TOKEN environment variable must contain a valid Vercel Blob token");
}

function idFor(index) {
  return `${PREFIX}${String(index + 1).padStart(3, "0")}`;
}

async function readBlob(pathname) {
  const result = await get(pathname, { access: "private", useCache: false, token });
  if (result?.statusCode === 200 && result.stream) {
    return JSON.parse(await new Response(result.stream).text());
  }

  const { blobs } = await list({ prefix: pathname, limit: 20, token });
  const match = blobs.find((blob) => blob.pathname === pathname);
  if (!match) throw new Error(`Blob ${pathname} was not found`);
  const response = await fetch(match.downloadUrl || match.url);
  if (!response.ok) throw new Error(`Unable to download ${pathname}: HTTP ${response.status}`);
  return JSON.parse(await response.text());
}

function validateClients(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty JSON array`);
  }
  for (const [index, client] of value.entries()) {
    if (!client || typeof client !== "object" || typeof client.client !== "string") {
      throw new Error(`${label} record ${index + 1} is not a valid client`);
    }
  }
}

function assertEquivalent(before, after) {
  if (before.length !== after.length) throw new Error("Record count changed during migration");
  const beforeNames = before.map((client) => client.client);
  const afterNames = after.map((client) => client.client);
  if (JSON.stringify(beforeNames) !== JSON.stringify(afterNames)) {
    throw new Error("Client order or names changed during migration");
  }
  const ids = after.map((client) => client.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs generated");
  ids.forEach((id, index) => {
    if (id !== idFor(index)) throw new Error(`Unexpected migrated ID: ${id}`);
  });
}

async function writePrivate(pathname, value) {
  await put(pathname, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}

const original = await readBlob(LIVE_PATH);
validateClients(original, "Live Blob data");
const migrated = original.map((client, index) => ({ ...client, id: idFor(index) }));
assertEquivalent(original, migrated);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `clients.backup-${stamp}.json`;
console.log(`Validated ${original.length} clients.`);
console.log(`Backup: ${backupPath}`);
console.log(`Staged migration: ${MIGRATED_PATH}`);

if (!APPLY) {
  console.log("Dry run only. No Blob data was changed. Re-run with --apply to migrate.");
  process.exit(0);
}

await writePrivate(backupPath, original);
const backupCheck = await readBlob(backupPath);
validateClients(backupCheck, "Backup Blob data");
if (JSON.stringify(backupCheck) !== JSON.stringify(original)) {
  throw new Error("Backup verification failed; live data was not changed");
}

await writePrivate(MIGRATED_PATH, migrated);
const stagedCheck = await readBlob(MIGRATED_PATH);
validateClients(stagedCheck, "Staged Blob data");
assertEquivalent(original, stagedCheck);

await writePrivate(LIVE_PATH, stagedCheck);
const liveCheck = await readBlob(LIVE_PATH);
validateClients(liveCheck, "Final live Blob data");
assertEquivalent(original, liveCheck);
console.log(`Migration complete. ${liveCheck.length} clients now use ${PREFIX}### IDs.`);
console.log(`Rollback backup retained at ${backupPath}.`);
