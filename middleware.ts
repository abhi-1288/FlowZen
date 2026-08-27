import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// Rate-limit only high-risk write paths. The bare /api/auth/ prefix is NOT
// limited because it includes the error endpoint (/api/auth/error) and the
// session/csrf/providers metadata endpoints — throttling those would mask
// NextAuth's error redirect (returning a raw 429 at /api/auth/error) and
// break normal session polling. Brute-force protection stays on the callback.
const RATE_LIMIT_PREFIXES = ["/api/auth/callback/", "/api/public/", "/api/seed/"];
const RATE_LIMIT_EXACT = ["/api/version"];

function isRateLimitedRoute(pathname: string) {
  if (RATE_LIMIT_EXACT.includes(pathname)) return true;
  return RATE_LIMIT_PREFIXES.some((p) => pathname.startsWith(p));
}

function getClientIp(request: NextRequest) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "127.0.0.1";
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    let response: NextResponse;

    response = NextResponse.next();

    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }

    if (isRateLimitedRoute(request.nextUrl.pathname)) {
      const ip = getClientIp(request);
      const { success, remaining, resetAt, retryAfter } = rateLimit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later.", retryAfter },
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "X-RateLimit-Limit": "10",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
              "Retry-After": String(retryAfter),
            },
          }
        );
      }

      response.headers.set("X-RateLimit-Limit", "10");
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    }

    return response;
  }

  const response = NextResponse.next();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.jpg|screenshot.png|.*\\..*).*)"],
};
