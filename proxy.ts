import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "./lib/auth";

// Get client IP from request headers
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const fastlyIp = request.headers.get("fastly-client-ip");
  if (fastlyIp) return fastlyIp;
  return "unknown";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Security headers - applied to all responses
  const response = NextResponse.next();
  
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      "base-uri 'self'; " +
      "object-src 'none'"
  );
  
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Restrict browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  
  // Set client IP in a cookie for rate limiting in Server Actions
  const ip = getClientIP(request);
  if (ip && ip !== "unknown") {
    response.cookies.set("rl_ip", ip, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });
  }

  if (pathname === "/login") {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (await isValidSession(session)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(session))) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
