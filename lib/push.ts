import webpush from "web-push";
import { connectDb } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { PushSubscription } from "@/models/PushSubscription";

let vapidConfigured = false;

interface LeanNotification {
  title?: string;
  message?: string;
  body?: string;
  link?: string;
  type?: string;
}

interface LeanSubscription {
  _id?: unknown;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

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
 * Sends a browser push for the user's most recent unread notification.
 * Safe to fire-and-forget: always swallows errors.
 */
export async function sendNotificationPush(userId: string) {
  ensureVapid();
  if (!vapidConfigured) return;

  try {
    await connectDb();
    const [latest, subs] = await Promise.all([
      Notification.findOne({ user: userId, readAt: null }).sort({ createdAt: -1 }).lean<LeanNotification | null>(),
      PushSubscription.find({ user: userId }).lean<LeanSubscription[]>(),
    ]);
    if (!latest || subs.length === 0) return;

    const payload = JSON.stringify({
      title: String(latest.title ?? "FlowZen"),
      body: String(latest.body || latest.message || ""),
      link: String(latest.link ?? ""),
      type: String(latest.type ?? "info"),
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            },
            payload
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is gone/expired — clean it up so we stop hitting it.
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            console.error("Push send failed:", err);
          }
        }
      })
    );
  } catch (err) {
    console.error("sendNotificationPush error:", err);
  }
}