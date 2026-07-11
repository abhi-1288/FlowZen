import { createHmac } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.MOBILE_JWT_SECRET || "flowzen-mobile-fallback-secret";

interface MobileTokenPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  iat: number;
  exp: number;
}

function base64url(data: Buffer | string): string {
  return (typeof data === "string" ? Buffer.from(data) : data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signMobileToken(payload: Omit<MobileTokenPayload, "iat" | "exp">): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + 365 * 24 * 60 * 60 })
  );
  const signature = base64url(
    createHmac("sha256", SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = base64url(
      createHmac("sha256", SECRET).update(`${header}.${body}`).digest()
    );
    if (signature !== expected) return null;
    const payload: MobileTokenPayload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the mobile user ID from a Request's Authorization header.
 * Returns null if the token is missing or invalid.
 *
 * Usage in any API route:
 *   import { requireMobileUserId } from "@/lib/mobile-auth";
 *   const userId = await requireMobileUserId(request);
 *   if (!userId) return jsonError("Unauthorized", 401);
 */
export async function requireMobileUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyMobileToken(auth.slice(7));
  return payload?.sub ?? null;
}
