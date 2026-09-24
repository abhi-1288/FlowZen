import { NextResponse } from "next/server";
import webpush from "web-push";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { PushSubscription } from "@/models/PushSubscription";
import { User } from "@/models/User";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:no-reply@flowzen.local";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Diagnostic endpoint — sends a real browser push to the authenticated user's
 * own push subscriptions and reports the outcome. Lets us see the send errors
 * that are otherwise swallowed in lib/push.ts.
 */
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

  ensureVapid();
  if (!vapidConfigured) {
    return NextResponse.json(
      { error: "VAPID keys not configured on the server." },
      { status: 503 },
    );
  }

  const subs = await PushSubscription.find({ user: userId }).lean();
  if (subs.length === 0) {
    return NextResponse.json({
      sent: false,
      reason: "no-subscription",
      count: 0,
      hint: "No push subscription is stored for this user. Re-enable browser notifications.",
    });
  }

  const payload = JSON.stringify({
    title: "FlowZen",
    body: "Test push — if you see this, browser push works.",
    link: "/",
    type: "info",
  });

  const results: Array<Record<string, unknown>> = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
        payload,
      );
      results.push({ ok: true, endpoint: String(sub.endpoint).slice(0, 48) });
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
      results.push({
        ok: false,
        statusCode,
        message: err instanceof Error ? err.message : String(err),
        endpoint: String(sub.endpoint).slice(0, 48),
      });
      // The subscription is dead (expired/rotated). Drop it so it stops
      // blocking delivery — the client re-syncs its live subscription.
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
        console.log("Push test: removed stale subscription (statusCode=", statusCode, ")");
      }
    }
  }

  const userDoc = await User.findById(userId).select("name").lean<{ name?: string } | null>();

  return NextResponse.json({
    sent: results.some((r) => r.ok),
    userId,
    user: userDoc?.name ?? null,
    count: subs.length,
    results,
  });
}