import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { validatePin } from "@/lib/pin";
import { isSessionLocked, requestIp, setUserPin } from "@/lib/session-lock";
import { rateLimitPin } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Enable a PIN for the first time, or change an existing one. Changing always
 * requires the current PIN. The PIN is hashed before storage and never logged.
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const validation = validatePin(body.pin);
  if (!validation.ok) return jsonError(validation.error, 400);
  const currentPinRaw = body.currentPin == null ? null : String(body.currentPin);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  if (await isSessionLocked(ref.userId, ref.sessionId)) {
    return NextResponse.json({ error: "Session is locked.", locked: true }, { status: 423 });
  }

  const result = await setUserPin(
    ref.userId,
    ref.sessionId,
    validation.pin,
    currentPinRaw,
    validation.length,
  );
  if (!result.ok) return jsonError(result.error, result.status);

  await recordAudit({
    action: "auth.pin.set",
    actionLabel: "PIN screen lock configured",
    actor: { id: ref.userId },
    result: "success",
    metadata: { length: validation.length },
    request,
  });

  return NextResponse.json({ ok: true, length: result.length });
}
