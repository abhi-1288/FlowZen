import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

const RATE_LIMIT_PREFIXES = ["/api/auth/", "/api/public/", "/api/seed/"];
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

function extractSubdomain(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname) return null;

  const baseDomains = [
    process.env.BASE_DOMAIN,
    "localhost",
  ].filter(Boolean) as string[];

  for (const base of baseDomains) {
    const suffix = `.${base}`;
    if (hostname.endsWith(suffix)) {
      const subdomain = hostname.slice(0, -suffix.length);
      if (subdomain && subdomain !== "www" && !subdomain.includes(".")) {
        return subdomain;
      }
    }
  }

  if (hostname === "localhost" || hostname === process.env.BASE_DOMAIN) {
    return null;
  }

  return null;
}

const SLUG_COOKIE = "x-company-slug";
const SLUG_HEADER = "x-company-slug";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
  const companySlug = extractSubdomain(host);

  if (request.nextUrl.pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    let response: NextResponse;

    if (companySlug) {
      const newHeaders = new Headers(request.headers);
      newHeaders.set(SLUG_HEADER, companySlug);
      response = NextResponse.next({ request: { headers: newHeaders } });
    } else {
      response = NextResponse.next();
    }

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

  if (companySlug) {
    response.cookies.set(SLUG_COOKIE, companySlug, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    response.cookies.delete(SLUG_COOKIE);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.jpg|screenshot.png|.*\\..*).*)"],
};
