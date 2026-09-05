import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "./lib/auth";

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
      "style-src 'self'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
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

const TOKEN_GATED = new Set(["/api/summary", "/api/admin/clients", "/api/admin/store"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (TOKEN_GATED.has(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname === "/login") {
    if (request.method === "POST" && isRateLimited(clientIp(request))) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/login?error=rate-limited", request.url)),
      );
    }
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (await isValidSession(session)) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(session))) {
    const login = new URL("/login", request.url);
    return withSecurityHeaders(NextResponse.redirect(login));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
