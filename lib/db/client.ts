import "server-only";
import postgres from "postgres";

/**
 * A single pooled connection shared across hot reloads and lambda invocations.
 * Serverless runtimes reuse the module scope between requests, so caching the
 * pool here is what keeps us from opening a connection per request.
 */
declare global {
  var __lifeOsSql: postgres.Sql | undefined;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Provision a Postgres database and set DATABASE_URL, then run `npm run db:migrate`.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/** Schema owning every Life OS table. Overridable for an isolated test database. */
export const DB_SCHEMA = process.env.DATABASE_SCHEMA?.trim() || "life_os";

export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function databaseConfigured(): boolean {
  return databaseUrl() !== undefined;
}

export function sql(): postgres.Sql {
  if (globalThis.__lifeOsSql) return globalThis.__lifeOsSql;
  const url = databaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();

  const instance = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    // Hosted Postgres (Supabase, Neon, Vercel) terminates TLS with its own CA.
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
    transform: { undefined: null },
    // Life OS owns its own schema so the database can host other applications
    // without name collisions. Unqualified table names resolve here.
    connection: { search_path: DB_SCHEMA },
  });
  globalThis.__lifeOsSql = instance;
  return instance;
}

/** Raised when a write is rejected because the row changed since it was read. */
export class VersionConflictError extends Error {
  constructor(
    readonly entity: string,
    readonly id: string,
    readonly current: unknown,
  ) {
    super(`${entity} ${id} was modified by another device`);
    this.name = "VersionConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}
