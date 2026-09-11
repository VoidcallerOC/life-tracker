import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionCookie } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db/client";
import { isLiveSession } from "@/lib/db/sessions";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * The authoritative check, used by every route that reads or writes data.
 * Middleware only validates the cookie signature; this additionally confirms the
 * session row still exists, which is what makes "sign out everywhere" real.
 */
export async function currentSession(): Promise<{ token: string } | null> {
  const store = await cookies();
  const parsed = await parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!parsed) return null;
  if (!databaseConfigured()) return parsed;
  return (await isLiveSession(parsed.token)) ? parsed : null;
}

export async function requireSession(): Promise<{ token: string }> {
  const session = await currentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
