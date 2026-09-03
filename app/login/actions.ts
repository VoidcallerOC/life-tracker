"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { SESSION_COOKIE, expectedPassword, sessionToken } from "@/lib/auth";

// Rate limiting: 5 attempts per 10 minutes per IP
// Uses Upstash Redis (free tier available)
// Configure via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
// Falls back to in-memory store if Upstash is not configured

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getRateLimiter() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_ATTEMPTS, "10 m"),
    analytics: true,
  });
}

// In-memory rate limit store for fallback
// Uses a Map with IP as key, stores { count, windowStart }
// This works in serverless but resets on cold start - better than nothing
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimitInMemory(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// Get client IP from headers - works with Vercel's x-forwarded-for
function getClientIP(): string {
  // In Server Actions, we can't directly access request headers
  // We'll use a workaround: store the IP in a cookie that we set from middleware
  // For now, return a placeholder - the real implementation needs middleware support
  // This is a limitation of Server Actions in Next.js
  return "rate_limit_ip";
}

// Use Upstash if configured, otherwise fall back to in-memory
async function checkRateLimit(ip: string): Promise<boolean> {
  cleanupRateLimitStore();

  // Try Upstash first if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const ratelimit = getRateLimiter();
      const { success } = await ratelimit.limit(ip);
      return success;
    } catch {
      // Fall through to in-memory if Upstash fails
      console.warn("Upstash rate limiting failed, falling back to in-memory");
    }
  }

  // In-memory fallback
  return checkRateLimitInMemory(ip);
}

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  // Get client IP - using a cookie-based approach
  // The middleware sets this cookie with the actual IP
  const cookieStore = await cookies();
  const rateLimitCookie = cookieStore.get("rl_ip");
  const ip = rateLimitCookie?.value || getClientIP();

  // Check rate limit
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    redirect("/login?error=rate-limited");
  }

  let expected: string;
  try {
    expected = expectedPassword();
  } catch {
    redirect("/login?error=config");
  }
  if (password !== expected) {
    redirect("/login?error=1");
  }

  const token = await sessionToken(expected);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
