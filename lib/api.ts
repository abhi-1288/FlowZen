import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";

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
  const headerStore = await headers();
  const auth = headerStore.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const payload = verifyMobileToken(auth.slice(7));
    if (payload?.sub) return payload.sub;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
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
