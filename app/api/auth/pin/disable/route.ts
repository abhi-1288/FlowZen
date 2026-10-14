import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { disableUserPin, requestIp } from "@/lib/session-lock";
import { rateLimitPin } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Disable the PIN screen lock. Requires the current PIN. */
export async function DELETE(request: Request) {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return jsonError("PIN lock is only available in the web app.", 400);
  }

  const check = rateLimitPin(requestIp(request));
  if (!check.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(check.retryAfter ?? 60) } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional for disable; fall through with an empty object.
  }
  const currentPin = body.currentPin == null ? null : String(body.currentPin);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const result = await disableUserPin(ref.userId, currentPin);
  if (!result.ok) return jsonError(result.error, result.status);

  await recordAudit({
    action: "auth.pin.disabled",
    actionLabel: "PIN screen lock disabled",
    actor: { id: ref.userId },
    result: "success",
    request,
  });

  return NextResponse.json({ ok: true, enabled: false });
}
