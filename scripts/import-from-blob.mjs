#!/usr/bin/env node
// One-shot import of the legacy JSON storage into Postgres.
//
//   node scripts/import-from-blob.mjs            # dry run, prints what it would write
//   node scripts/import-from-blob.mjs --apply    # actually writes
//
// Reads clients.json + life-store.json from Vercel Blob when a *_READ_WRITE_TOKEN
// is present, otherwise from ./data. Inserts are keyed on the existing record id
// and skip rows that are already present, so running it twice is safe.
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const apply = process.argv.includes("--apply");

const url = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function blobToken() {
  const preferred = ["Client1_READ_WRITE_TOKEN", "CLIENT1_READ_WRITE_TOKEN", "BLOB_READ_WRITE_TOKEN"];
  for (const name of preferred) {
    const value = process.env[name]?.trim();
    if (value?.startsWith("vercel_blob_")) return value;
  }
  for (const [name, raw] of Object.entries(process.env)) {
    const value = raw?.trim();
    if (name.endsWith("_READ_WRITE_TOKEN") && value?.startsWith("vercel_blob_")) return value;
  }
  return undefined;
}

async function loadJson(pathname) {
  const token = blobToken();
  if (token) {
    const { get } = await import("@vercel/blob");
    for (const access of ["private", "public"]) {
      try {
        const result = await get(pathname, { access, useCache: false, token });
        if (result?.stream) return await new Response(result.stream).json();
      } catch {
        // Fall through to the other access mode, then to the local file.
      }
    }
  }
  const file = path.join(process.cwd(), "data", pathname);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

const emptyToNull = (v) => (typeof v === "string" && v.length > 0 ? v.slice(0, 10) : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" ? v : "");

const clientsJson = (await loadJson("clients.json")) ?? [];
const storeJson = (await loadJson("life-store.json")) ?? { animals: [], content: [], personal: [] };

const clients = (Array.isArray(clientsJson) ? clientsJson : []).map((c) => ({
  id: str(c.id) || `c-${Math.random().toString(36).slice(2)}`,
  name: str(c.client || c.name),
  business_type: str(c.businessType),
  status: ["Potential", "Pending", "Paid", "Lost"].includes(c.status) ? c.status : "Potential",
  contacted: Boolean(c.contacted || c.lastContacted),
  contact_name: str(c.contactName),
  phone: str(c.phone),
  email: str(c.email),
  address: str(c.address),
  quoted: num(c.quoted),
  deposit: num(c.deposit),
  paid: num(c.paid),
  paid_date: emptyToNull(c.paidDate),
  github_repo: str(c.githubRepo),
  live_url: str(c.liveUrl),
  domain: str(c.domain),
  next_action: str(c.nextAction),
  due_date: emptyToNull(c.dueDate),
  notes: str(c.notes),
  last_contacted: emptyToNull(c.lastContacted),
  snooze_until: emptyToNull(c.snoozeUntil),
  lost_reason: "",
}));

const animals = (storeJson.animals ?? []).map((a) => ({
  id: str(a.id) || `a-${Math.random().toString(36).slice(2)}`,
  name: str(a.name).trim(),
  species: str(a.species).trim(),
  enclosure: str(a.enclosure),
  last_fed: emptyToNull(a.lastFed),
  last_cleaned: emptyToNull(a.lastCleaned),
  next_care_due: emptyToNull(a.nextCareDue),
  feed_every_days: Math.max(1, Number(a.feedEveryDays) || 7),
  clean_every_days: Math.max(1, Number(a.cleanEveryDays) || 7),
  notes: str(a.notes),
  snooze_until: emptyToNull(a.snoozeUntil),
}));

const tasks = [
  ...(storeJson.content ?? []).map((r) => ({
    id: str(r.id) || `t-${Math.random().toString(36).slice(2)}`,
    title: str(r.task),
    lane: "content",
    deadline: emptyToNull(r.deadline),
    status: r.status === "Done" ? "Done" : "Todo",
    priority: "Medium",
    platform: str(r.platform),
    category: str(r.type),
    notes: str(r.notes),
    snooze_until: emptyToNull(r.snoozeUntil),
  })),
  ...(storeJson.personal ?? []).map((r) => ({
    id: str(r.id) || `t-${Math.random().toString(36).slice(2)}`,
    title: str(r.task),
    lane: "personal",
    deadline: emptyToNull(r.deadline),
    status: r.status === "Done" ? "Done" : "Todo",
    priority: "Medium",
    platform: "",
    category: str(r.category),
    notes: str(r.notes),
    snooze_until: emptyToNull(r.snoozeUntil),
  })),
];

console.log(`Found ${clients.length} clients, ${animals.length} animals, ${tasks.length} tasks.`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write these rows.");
  process.exit(0);
}

const schema = (process.env.DATABASE_SCHEMA ?? "life_os").trim();
const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, {
  max: 1,
  ssl: local ? false : "require",
  onnotice: () => {},
  connection: { search_path: schema },
});

let inserted = { clients: 0, animals: 0, tasks: 0 };
await sql.begin(async (tx) => {
  for (const row of clients) {
    const r = await tx`INSERT INTO clients ${tx(row)} ON CONFLICT (id) DO NOTHING RETURNING id`;
    inserted.clients += r.length;
  }
  for (const row of animals) {
    const r = await tx`INSERT INTO animals ${tx(row)} ON CONFLICT (id) DO NOTHING RETURNING id`;
    inserted.animals += r.length;
  }
  for (const row of tasks) {
    const r = await tx`INSERT INTO tasks ${tx(row)} ON CONFLICT (id) DO NOTHING RETURNING id`;
    inserted.tasks += r.length;
  }
});

console.log(
  `Inserted ${inserted.clients} clients, ${inserted.animals} animals, ${inserted.tasks} tasks. ` +
    "Rows that already existed were left untouched.",
);
await sql.end();
