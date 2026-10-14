import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { lockSession } from "@/lib/session-lock";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Explicitly lock the current device session. No PIN is required to lock; the
 * PIN is only needed to unlock again.
 */
export async function POST(request: Request) {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return NextResponse.json({ ok: true, locked: false });
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  await lockSession(ref.userId, ref.sessionId);
  await recordAudit({
    action: "auth.pin.lock",
    actionLabel: "Session locked",
    actor: { id: ref.userId },
    result: "success",
    request,
  });

  return NextResponse.json({ ok: true, locked: true });
}
