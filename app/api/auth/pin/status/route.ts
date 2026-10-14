import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { getSessionState } from "@/lib/session-lock";

export const dynamic = "force-dynamic";

const DISABLED_STATE = {
  enabled: false,
  locked: false,
  length: null,
  lockoutUntil: null,
  failedAttempts: 0,
};

/**
 * Read-only PIN lock status for the current device session. Must stay reachable
 * while the session is locked (the overlay polls it), so it intentionally does
 * not use `requireUserId`.
 */
export async function GET() {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return NextResponse.json(DISABLED_STATE);
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const state = await getSessionState(ref.userId, ref.sessionId);
  return NextResponse.json(state);
}
