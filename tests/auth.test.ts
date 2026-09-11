import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_DAYS,
  constantTimeEquals,
  isAuthorizedRequest,
  mintSessionCookie,
  parseSessionCookie,
  randomToken,
  verifyPassword,
} from "@/lib/auth";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.AUTH_PASSWORD = "correct-horse";
  process.env.SESSION_SECRET = "a-long-enough-session-secret-value";
  delete process.env.ADMIN_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("session cookies", () => {
  it("issues a different cookie every time", async () => {
    const a = await mintSessionCookie();
    const b = await mintSessionCookie();
    expect(a.cookie).not.toBe(b.cookie);
    expect(a.token).not.toBe(b.token);
  });

  it("is not derivable from the password", async () => {
    // The previous scheme made the cookie a hash of the password, so anyone who
    // knew the password could mint one offline. The token must not contain it.
    const { cookie } = await mintSessionCookie();
    expect(cookie).not.toContain("correct-horse");
  });

  it("round-trips a freshly minted cookie", async () => {
    const { cookie, token } = await mintSessionCookie();
    const parsed = await parseSessionCookie(cookie);
    expect(parsed?.token).toBe(token);
  });

  it("rejects a tampered signature", async () => {
    const { cookie } = await mintSessionCookie();
    const [token, expiry, signature] = cookie.split(".");
    const flipped = signature.startsWith("a") ? `b${signature.slice(1)}` : `a${signature.slice(1)}`;
    expect(await parseSessionCookie(`${token}.${expiry}.${flipped}`)).toBeNull();
  });

  it("rejects a cookie whose expiry was extended by hand", async () => {
    const { cookie } = await mintSessionCookie();
    const [token, , signature] = cookie.split(".");
    const future = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
    expect(await parseSessionCookie(`${token}.${future}.${signature}`)).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const { cookie } = await mintSessionCookie();
    const wayLater = Date.now() + (SESSION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(await parseSessionCookie(cookie, wayLater)).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect(await parseSessionCookie(undefined)).toBeNull();
    expect(await parseSessionCookie("")).toBeNull();
    expect(await parseSessionCookie("not-a-cookie")).toBeNull();
    expect(await parseSessionCookie("a.b")).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { cookie } = await mintSessionCookie();
    process.env.SESSION_SECRET = "an-entirely-different-secret-key";
    expect(await parseSessionCookie(cookie)).toBeNull();
  });
});

describe("randomToken", () => {
  it("produces distinct, full-length hex", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
    expect([...tokens][0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("password verification", () => {
  it("accepts the configured password and rejects near-misses", async () => {
    expect(await verifyPassword("correct-horse")).toBe(true);
    expect(await verifyPassword("correct-horse ")).toBe(false);
    expect(await verifyPassword("Correct-Horse")).toBe(false);
    expect(await verifyPassword("")).toBe(false);
  });

  it("rejects everything when no password is configured", async () => {
    delete process.env.AUTH_PASSWORD;
    expect(await verifyPassword("anything")).toBe(false);
    expect(await verifyPassword("")).toBe(false);
  });

  it("compares without revealing length", async () => {
    expect(await constantTimeEquals("short", "a-much-longer-value")).toBe(false);
    expect(await constantTimeEquals("same", "same")).toBe(true);
  });
});

describe("admin key", () => {
  function request(headers: Record<string, string>, url = "https://example.com/api/summary") {
    return new Request(url, { headers });
  }

  it("accepts the key in the x-admin-key header", async () => {
    process.env.ADMIN_API_KEY = "admin-secret";
    expect(await isAuthorizedRequest(request({ "x-admin-key": "admin-secret" }))).toBe(true);
  });

  it("refuses a key supplied in the query string", async () => {
    // The old implementation accepted ?key=, which leaks the password into
    // logs, history and referer headers.
    process.env.ADMIN_API_KEY = "admin-secret";
    expect(
      await isAuthorizedRequest(request({}, "https://example.com/api/summary?key=admin-secret")),
    ).toBe(false);
  });

  it("falls back to the login password when no admin key is set", async () => {
    expect(await isAuthorizedRequest(request({ "x-admin-key": "correct-horse" }))).toBe(true);
  });

  it("rejects a missing or wrong key", async () => {
    expect(await isAuthorizedRequest(request({}))).toBe(false);
    expect(await isAuthorizedRequest(request({ "x-admin-key": "nope" }))).toBe(false);
  });
});
