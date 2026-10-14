import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError } from "@/lib/api";
import { heartbeatSession, requestIp } from "@/lib/session-lock";
import { rateLimitPin } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Activity ping. Only refreshes `lastActiveAt` while the session is unlocked and
 * the tab is visible, so an idle (or hidden) tab still ages out and locks.
 */
export async function POST(request: Request) {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) {
    return NextResponse.json({ enabled: false, locked: false, length: null });
  }

  const check = rateLimitPin(requestIp(request));
  if (!check.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(check.retryAfter ?? 60) } },
    );
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const state = await heartbeatSession(ref.userId, ref.sessionId);
  return NextResponse.json(state);
}
