import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, getSessionRef, jsonError, requireUnlockedUserId } from "@/lib/api";
import { listPendingGreenPinResetRequests } from "@/lib/session-lock";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUnlockedUserId();
  if (userId instanceof NextResponse) return userId;
  if (typeof userId !== "string") return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  let requests: Awaited<ReturnType<typeof listPendingGreenPinResetRequests>>;
  try {
    requests = await listPendingGreenPinResetRequests(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load recovery requests.";
    return jsonError(message, 403);
  }

  return NextResponse.json({ requests });
}
