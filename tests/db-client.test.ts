import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DB_SCHEMA, databaseConfigured, databaseUrl, isTransactionPooler } from "@/lib/db/client";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("isTransactionPooler", () => {
  it("detects Supabase's transaction pooler", () => {
    // Getting this wrong means every query fails in production with
    // "prepared statement already exists", so the shapes are pinned here.
    expect(
      isTransactionPooler("postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres"),
    ).toBe(true);
    expect(isTransactionPooler("postgres://u:p@host:6543/postgres")).toBe(true);
    expect(isTransactionPooler("postgres://u:p@host:5432/db?pgbouncer=true")).toBe(true);
  });

  it("leaves a direct connection using prepared statements", () => {
    expect(isTransactionPooler("postgres://u:p@db.abcdef.supabase.co:5432/postgres")).toBe(false);
    expect(isTransactionPooler("postgres://postgres@127.0.0.1:5433/life_os")).toBe(false);
    expect(isTransactionPooler("postgres://u:p@ep-x.neon.tech/db?sslmode=require")).toBe(false);
  });

  it("also detects the session-pooler host, which still multiplexes", () => {
    expect(
      isTransactionPooler("postgres://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres"),
    ).toBe(true);
  });
});

describe("databaseUrl", () => {
  it("prefers DATABASE_URL and falls back to POSTGRES_URL", () => {
    process.env.POSTGRES_URL = "postgres://fallback";
    expect(databaseUrl()).toBe("postgres://fallback");

    process.env.DATABASE_URL = "postgres://primary";
    expect(databaseUrl()).toBe("postgres://primary");
  });

  it("treats blank and whitespace-only values as unset", () => {
    process.env.DATABASE_URL = "   ";
    expect(databaseUrl()).toBeUndefined();
    expect(databaseConfigured()).toBe(false);
  });

  it("trims surrounding whitespace from a pasted value", () => {
    process.env.DATABASE_URL = "  postgres://host/db\n";
    expect(databaseUrl()).toBe("postgres://host/db");
  });
});

describe("DB_SCHEMA", () => {
  it("defaults to life_os so tables never land in public", () => {
    expect(DB_SCHEMA).toBe(process.env.DATABASE_SCHEMA?.trim() || "life_os");
  });
});
