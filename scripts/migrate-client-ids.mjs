import { get, put } from "@vercel/blob";

const LIVE_PATH = "clients.json";
const MIGRATED_PATH = "clients.migrated.json";
const PREFIX = "Client1-";
const APPLY = process.argv.includes("--apply");
const token = Object.entries(process.env)
  .filter(([name]) => name === "BLOB_READ_WRITE_TOKEN" || name.endsWith("_READ_WRITE_TOKEN"))
  .map(([, value]) => value?.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith("vercel_blob_")))
  .find((value) => value?.startsWith("vercel_blob_"));
const configuredAccess = process.env.BLOB_ACCESS_MODE?.trim().toLowerCase() === "public" ? "public" : "private";
const accessModes = [configuredAccess, configuredAccess === "private" ? "public" : "private"];

if (!token) throw new Error("A *_READ_WRITE_TOKEN environment variable must contain a valid Vercel Blob token");

function idFor(index) {
  return `${PREFIX}${String(index + 1).padStart(3, "0")}`;
}

function isAccessModeError(error) {
  return /access mode|public.*private|private.*public|store.*(public|private)/i.test(String(error?.message ?? error));
}

async function readBlob(pathname) {
  let lastError;
  for (const access of accessModes) {
    try {
      const result = await get(pathname, { access, useCache: false, token });
      if (!result?.stream) return null;
      return JSON.parse(await new Response(result.stream).text());
    } catch (error) {
      lastError = error;
      if (!isAccessModeError(error)) throw error;
    }
  }
  throw lastError;
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

async function writePrivate(pathname, value) {
  let lastError;
  for (const access of accessModes) {
    try {
      return await put(pathname, JSON.stringify(value, null, 2), {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
        contentType: "application/json",
        token,
      });
    } catch (error) {
      lastError = error;
      if (!isAccessModeError(error)) throw error;
    }
  }
  throw lastError;
}

const original = await readBlob(LIVE_PATH);
if (!original) throw new Error(`Blob ${LIVE_PATH} was not found in access modes: ${accessModes.join(", ")}`);
validateClients(original, "Live Blob data");
const migrated = original.map((client, index) => ({ ...client, id: idFor(index) }));
assertEquivalent(original, migrated);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `clients.backup-${stamp}.json`;
console.log(`Validated ${original.length} clients using ${configuredAccess} Blob access.`);
console.log(`Backup: ${backupPath}`);
console.log(`Staged migration: ${MIGRATED_PATH}`);

if (!APPLY) {
  console.log("Dry run only. No Blob data was changed. Re-run with --apply to migrate.");
  process.exit(0);
}

await writePrivate(backupPath, original);
const backupCheck = await readBlob(backupPath);
validateClients(backupCheck, "Backup Blob data");
if (JSON.stringify(backupCheck) !== JSON.stringify(original)) throw new Error("Backup verification failed; live data was not changed");

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
