import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { createGreenPinResetRequest } from "@/lib/session-lock";
import { rateLimitPin } from "@/lib/rate-limit";
import { requestIp } from "@/lib/session-lock";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return jsonError("Green PIN recovery is only available in the web app.", 400);
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
    // Reason is optional and the body may be empty.
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : "";

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  let result: Awaited<ReturnType<typeof createGreenPinResetRequest>>;
  try {
    result = await createGreenPinResetRequest(ref.userId, reason);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create a recovery request.";
    return jsonError(message, 400);
  }

  await recordAudit({
    action: "auth.pin.reset.requested",
    actionLabel: "Green PIN reset requested from a locked session",
    actor: { id: ref.userId },
    result: "success",
    metadata: {
      requestId: result.requestId,
      region: result.region,
      hrContacts: result.hrContacts,
    },
    request,
  });

  return NextResponse.json(result, { status: 201 });
}
