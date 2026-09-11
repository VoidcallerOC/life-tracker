export const SESSION_COOKIE = "lo_session";
export const SESSION_TTL_DAYS = 30;

/**
 * Session cookies are `<random-token>.<expiry>.<hmac>`.
 *
 * The token is random, so the cookie cannot be derived from the password — the
 * previous scheme hashed the password itself, which meant anyone who learned the
 * password could mint a cookie offline and no session could ever be revoked.
 *
 * Middleware verifies the HMAC and expiry statelessly (Web Crypto, edge-safe).
 * Anything that actually reads data additionally checks the session row in
 * Postgres, which is what makes revocation and a real TTL possible.
 */

function authPassword(): string | undefined {
  const value = process.env.AUTH_PASSWORD;
  return value && value.length > 0 ? value : undefined;
}

export function expectedPassword(): string {
  const password = authPassword();
  if (!password) throw new Error("AUTH_PASSWORD is not set");
  return password;
}

let warnedAboutDerivedSecret = false;

/**
 * Prefer an explicit SESSION_SECRET. Falling back to a key derived from the
 * password keeps existing deployments booting, but it means rotating the
 * password invalidates every session — hence the warning.
 */
function signingSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  if (!warnedAboutDerivedSecret) {
    warnedAboutDerivedSecret = true;
    console.warn(
      "SESSION_SECRET is not set (or is shorter than 16 chars). Falling back to a key derived " +
        "from AUTH_PASSWORD; set SESSION_SECRET so sessions survive a password rotation.",
    );
  }
  return `derived:${expectedPassword()}`;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/**
 * Compares without leaking length or position. Both sides are hashed first so
 * the comparison runs over fixed-length digests regardless of input length.
 */
export async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i += 1) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  let expected: string;
  try {
    expected = expectedPassword();
  } catch {
    return false;
  }
  return constantTimeEquals(candidate, expected);
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type SessionCookie = { token: string; expiresAt: number };

export async function mintSessionCookie(
  ttlDays = SESSION_TTL_DAYS,
): Promise<{ cookie: string; token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const payload = `${token}.${expiresAt}`;
  const signature = await hmacHex(payload);
  return { cookie: `${payload}.${signature}`, token, expiresAt: new Date(expiresAt) };
}

/**
 * Stateless verification: signature valid and not expired. Says nothing about
 * whether the session was revoked — call `isLiveSession` for that.
 */
export async function parseSessionCookie(
  value: string | undefined,
  now = Date.now(),
): Promise<SessionCookie | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [token, expiryRaw, signature] = parts;
  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  let expected: string;
  try {
    expected = await hmacHex(`${token}.${expiryRaw}`);
  } catch {
    return null;
  }
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0 ? { token, expiresAt } : null;
}

/**
 * Admin/automation key. Header only — the previous version also accepted it as
 * a `?key=` query parameter, which put the password into server logs, browser
 * history and referer headers.
 */
export async function isAuthorizedRequest(request: Request): Promise<boolean> {
  const key = request.headers.get("x-admin-key") ?? request.headers.get("x-summary-key");
  if (!key) return false;
  const configured = process.env.ADMIN_API_KEY?.trim();
  if (configured && configured.length > 0) return constantTimeEquals(key, configured);
  try {
    return await constantTimeEquals(key, expectedPassword());
  } catch {
    return false;
  }
}
