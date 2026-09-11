"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, expectedPassword, mintSessionCookie, parseSessionCookie, verifyPassword } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db/client";
import { recordSession, revokeAllSessions, revokeSession } from "@/lib/db/sessions";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  try {
    expectedPassword();
  } catch {
    redirect("/login?error=config");
  }
  if (!(await verifyPassword(password))) {
    redirect("/login?error=1");
  }

  const { cookie, token, expiresAt } = await mintSessionCookie();
  if (databaseConfigured()) {
    const headerList = await headers();
    await recordSession(token, expiresAt, headerList.get("user-agent") ?? "");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  const parsed = await parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (parsed && databaseConfigured()) {
    await revokeSession(parsed.token);
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Sign out every device — the thing the old deterministic cookie made impossible. */
export async function logoutEverywhereAction() {
  if (databaseConfigured()) await revokeAllSessions();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
