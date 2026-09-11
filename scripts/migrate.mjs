#!/usr/bin/env node
// Applies every db/migrations/*.sql file that has not been applied yet, in
// filename order. Each file runs inside a transaction and is recorded in
// schema_migrations, so re-running is a no-op.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const url = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {} });

const dir = path.join(process.cwd(), "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;
const applied = new Set(
  (await sql`SELECT version FROM schema_migrations`).map((r) => r.version),
);

let count = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip ${file} (already applied)`);
    continue;
  }
  const body = await readFile(path.join(dir, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO schema_migrations (version) VALUES (${file})`;
  });
  console.log(`applied ${file}`);
  count += 1;
}

console.log(count === 0 ? "Database already up to date." : `Applied ${count} migration(s).`);
await sql.end();
