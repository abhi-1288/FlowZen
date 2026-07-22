const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const loginStore = new Map<string, Bucket>();

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
