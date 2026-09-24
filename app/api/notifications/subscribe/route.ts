import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { PushSubscription } from "@/models/PushSubscription";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";

function parseSubscription(body: Record<string, any>) {
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("http") || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth, userAgent: typeof body?.userAgent === "string" ? body.userAgent : "" };
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const subscription = parseSubscription(body);
  if (!subscription) return jsonError("Invalid subscription", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  // Upsert by endpoint so a device is always owned by its current user.
  await PushSubscription.updateOne(
    { endpoint: subscription.endpoint },
    {
      $set: {
        user: userId,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        userAgent: subscription.userAgent,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  let endpoint: string | undefined;
  try {
    const body = await request.json().catch(() => null);
    endpoint = typeof body?.endpoint === "string" && body.endpoint.trim() ? body.endpoint.trim() : undefined;
  } catch {
    // ignore — treat as "remove all"
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const filter: Record<string, any> = { user: userId };
  if (endpoint) filter.endpoint = endpoint;
  await PushSubscription.deleteMany(filter);

  return NextResponse.json({ ok: true });
}