import { NextResponse } from "next/server";
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 5;
const PIN_WINDOW_MS = 60 * 1000;
const PIN_MAX_REQUESTS = 10;
const PIN_USER_WINDOW_MS = 60 * 1000;
const PIN_USER_MAX_REQUESTS = 8;
const MAX_ENTRIES = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const loginStore = new Map<string, Bucket>();
const pinStore = new Map<string, Bucket>();
const pinUserStore = new Map<string, Bucket>();

function evict(target: Map<string, Bucket>) {
  if (target.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, bucket] of target) {
    if (bucket.resetAt <= now) target.delete(key);
  }
}

function checkBucket(
  target: Map<string, Bucket>,
  key: string,
  windowMs: number,
  maxRequests: number
) {
  evict(target);

  const now = Date.now();
  const bucket = target.get(key);

  if (!bucket || bucket.resetAt <= now) {
    target.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (bucket.count >= maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfter,
    };
  }

  bucket.count++;
  return {
    success: true,
    remaining: maxRequests - bucket.count,
    resetAt: bucket.resetAt,
  };
}

export function rateLimit(ip: string) {
  return checkBucket(store, ip, WINDOW_MS, MAX_REQUESTS);
}

export function rateLimitLogin(ip: string, email: string) {
  return checkBucket(loginStore, `${ip}::${email}`, LOGIN_WINDOW_MS, LOGIN_MAX_REQUESTS);
}

// PIN unlock throttles. Per-IP caps broad spraying, per-user caps attempts
// spread across a user's devices/sessions (which each also have their own
// persistent failed-attempt lockout in `SessionLock`).
export function rateLimitPin(ip: string) {
  return checkBucket(pinStore, `pin::${ip}`, PIN_WINDOW_MS, PIN_MAX_REQUESTS);
}

export function rateLimitPinUser(userId: string) {
  return checkBucket(pinUserStore, `pin::user::${userId}`, PIN_USER_WINDOW_MS, PIN_USER_MAX_REQUESTS);
}
const phase2Buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): import("next/server").NextResponse | null {
  const now = Date.now();
  const bucket = phase2Buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    phase2Buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (bucket.count >= limit) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  bucket.count += 1;
  return null;
}
