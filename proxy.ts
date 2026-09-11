import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, parseSessionCookie } from "./lib/auth";

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; windowStart: number }>();

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > LOGIN_ATTEMPT_LIMIT;
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "worker-src 'self'; " +
      "manifest-src 'self'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      "base-uri 'self'; " +
      "object-src 'none'",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return response;
}

/**
 * Routes authenticated by the admin key header rather than a session cookie.
 * They verify the key themselves; middleware just steps out of the way.
 */
const TOKEN_GATED = new Set([
  "/api/summary",
  "/api/admin/clients",
  "/api/admin/store",
  "/api/cron/notify",
]);

/** API routes answer 401 rather than redirecting to the login page. */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (TOKEN_GATED.has(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  // The service worker and manifest must be reachable before login, or an
  // installed app can never boot far enough to show the login screen.
  if (pathname === "/sw.js" || pathname === "/manifest.webmanifest" || pathname === "/offline") {
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname === "/login") {
    if (request.method === "POST" && isRateLimited(clientIp(request))) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/login?error=rate-limited", request.url)),
      );
    }
    const session = await parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    if (session) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Signature and expiry only. Revocation is enforced server-side by
  // `requireSession`, which can reach the database; middleware cannot.
  const session = await parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (isApiRoute(pathname)) {
      return withSecurityHeaders(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    const login = new URL("/login", request.url);
    const response = NextResponse.redirect(login);
    response.cookies.delete(SESSION_COOKIE);
    return withSecurityHeaders(response);
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
