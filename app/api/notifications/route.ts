import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(30);
  return NextResponse.json({ notifications: serializeDocs(notifications) });
}

export async function PATCH() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  await Notification.deleteMany({ user: userId });
  return NextResponse.json({ ok: true });
}
