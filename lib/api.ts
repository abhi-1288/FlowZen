import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { isSessionLocked } from "@/lib/session-lock";
import { createHash } from "crypto";
import { getToken } from "next-auth/jwt";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function databaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const isConnectionError =
    message.includes("ECONNREFUSED") ||
    message.includes("MongooseServerSelectionError") ||
    message.includes("Server selection timed out");

  if (!isConnectionError) return null;

  return jsonError(
    "MongoDB is not reachable. Start MongoDB locally or update MONGODB_URI in .env.local to a running MongoDB Atlas connection string.",
    503
  );
}

export function isObjectId(id: string | undefined) {
  return Boolean(id && Types.ObjectId.isValid(id));
}

export async function requireUserId() {
  const ref = await getSessionRef();
  if (!ref) return null;
  // Mobile Bearer sessions and legacy tokens without a session id are not
  // PIN-gated (the PIN lock is a web-app feature).
  if (ref.isMobile || !ref.sessionId) return ref.userId;

  try {
    // Server-authoritative lock enforcement: while a session is locked every
    // authenticated API route 401s, regardless of what the client renders.
    const locked = await isSessionLocked(ref.userId, ref.sessionId);
    return locked ? null : ref.userId;
  } catch {
    // Fail open on a database blip so a transient outage cannot lock every
    // member out of the app (they would otherwise be unable to reach unlock).
    return ref.userId;
  }
}

export type SessionRef = {
  userId: string;
  sessionId: string | null;
  isMobile: boolean;
};

/**
 * Resolve the authenticated identity plus the per-device session id. Used by
 * the PIN routes, which must remain reachable while a session is locked and
 * therefore cannot go through `requireUserId`.
 */
export async function getSessionRef(): Promise<SessionRef | null> {
  const headerStore = await headers();
  const auth = headerStore.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const payload = verifyMobileToken(auth.slice(7));
    if (payload?.sub) return { userId: payload.sub, sessionId: null, isMobile: true };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return null;

  // Existing sessions issued before the PIN lock feature carry no `sid`. Give
  // them a stable per-token device id derived from the signed JWT so the feature
  // works without forcing an immediate re-login. The value is never trusted for
  // anything beyond keying the per-device `SessionLock` record.
  let sessionId = session?.user?.sessionId ?? null;
  if (!sessionId) {
    try {
      const reqHeaders = await headers();
      const token = await getToken({
        req: { headers: Object.fromEntries(reqHeaders.entries()) } as any,
        secret: process.env.NEXTAUTH_SECRET,
      });
      sessionId = `legacy-${createHash("sha256")
        .update(`${userId}::${token?.iat ?? 0}::${token?.jti ?? "legacy"}`)
        .digest("hex")}`;
    } catch {
      sessionId = `legacy-${createHash("sha256").update(`${userId}::fallback`).digest("hex")}`;
    }
  }

  return {
    userId,
    sessionId,
    isMobile: false,
  };
}

/**
 * Like `requireUserId`, but returns a 423 Locked response instead of null so a
 * sensitive endpoint can tell the client "you are authenticated but locked".
 */
export async function requireUnlockedUserId(): Promise<string | NextResponse> {
  const ref = await getSessionRef();
  if (!ref) return jsonError("Unauthorized", 401);
  if (ref.isMobile || !ref.sessionId) return ref.userId;
  try {
    if (await isSessionLocked(ref.userId, ref.sessionId)) {
      return NextResponse.json(
        { error: "Session is locked.", locked: true },
        { status: 423 },
      );
    }
  } catch {
    // Fail open (see requireUserId).
  }
  return ref.userId;
}

export function serializeDoc<T extends { toObject: () => Record<string, unknown> }>(doc: T) {
  const raw = doc.toObject();
  raw.id = String(raw._id);
  delete raw._id;
  delete raw.__v;
  return raw;
}

export function serializeDocs<T extends { toObject: () => Record<string, unknown> }>(docs: T[]) {
  return docs.map((doc) => serializeDoc(doc));
}
