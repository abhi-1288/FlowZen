import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { validatePin } from "@/lib/pin";
import { authenticateUnlock, requestIp } from "@/lib/session-lock";
import { rateLimitPin, rateLimitPinUser } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Verify a PIN for the current device session. Server-authoritative; on success
 * the session is marked unlocked in the database, which is what actually
 * re-enables the rest of the API for this device.
 */
export async function POST(request: Request) {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return jsonError("PIN lock is only available in the web app.", 400);
  }

  const ipCheck = rateLimitPin(requestIp(request));
  if (!ipCheck.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfter ?? 60) } },
    );
  }
  const userCheck = rateLimitPinUser(ref.userId);
  if (!userCheck.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(userCheck.retryAfter ?? 60) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const validation = validatePin(body.pin);
  if (!validation.ok) return jsonError(validation.error, 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const result = await authenticateUnlock(ref.userId, ref.sessionId, validation.pin);

  await recordAudit({
    action: result.ok ? "auth.pin.unlock" : "auth.pin.unlock.failed",
    actionLabel: result.ok ? "Session unlocked with PIN" : "PIN unlock failed",
    actor: { id: ref.userId },
    result: result.ok ? "success" : "failed",
    metadata: result.ok ? undefined : { failedAttempts: result.failedAttempts ?? 0 },
    request,
  });

  if (!result.ok) {
    const headers: Record<string, string> = {};
    if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
    return NextResponse.json(
      {
        error: result.error,
        locked: true,
        failedAttempts: result.failedAttempts ?? 0,
        lockoutUntil: result.lockoutUntil ?? null,
        retryAfter: result.retryAfter ?? null,
      },
      { status: result.status, headers },
    );
  }

  return NextResponse.json({ ok: true, locked: false });
}
