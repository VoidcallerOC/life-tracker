import "server-only";
import { sql } from "@/lib/db/client";
import { sha256Hex } from "@/lib/auth";

/**
 * Only the hash of the session token is stored, so a database dump does not
 * hand out live sessions.
 */
export async function recordSession(
  token: string,
  expiresAt: Date,
  userAgent: string,
): Promise<void> {
  const db = sql();
  const hash = await sha256Hex(token);
  await db`
    INSERT INTO sessions (token_hash, expires_at, user_agent)
    VALUES (${hash}, ${expiresAt}, ${userAgent.slice(0, 400)})
    ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at
  `;
}

/** True when the session exists and has not expired or been revoked. */
export async function isLiveSession(token: string): Promise<boolean> {
  const db = sql();
  const hash = await sha256Hex(token);
  const rows = await db<{ token_hash: string }[]>`
    UPDATE sessions SET last_seen_at = now()
    WHERE token_hash = ${hash} AND expires_at > now()
    RETURNING token_hash
  `;
  return rows.length > 0;
}

export async function revokeSession(token: string): Promise<void> {
  const db = sql();
  await db`DELETE FROM sessions WHERE token_hash = ${await sha256Hex(token)}`;
}

/** Sign out every device. */
export async function revokeAllSessions(): Promise<number> {
  const db = sql();
  const rows = await db<{ token_hash: string }[]>`DELETE FROM sessions RETURNING token_hash`;
  return rows.length;
}

export async function purgeExpiredSessions(): Promise<number> {
  const db = sql();
  const rows = await db<{ token_hash: string }[]>`
    DELETE FROM sessions WHERE expires_at < now() RETURNING token_hash
  `;
  return rows.length;
}
