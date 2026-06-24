import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 15)));
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  const filter: Record<string, any> = { user: userId };
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) filter.createdAt.$gte = from;
    }
    if (toDate) {
      const to = new Date(toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  const unreadFilter = { ...filter, readAt: null };
  const [total, unreadCount, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter),
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);

  return NextResponse.json({
    notifications: serializeDocs(notifications),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    unreadCount,
  });
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
