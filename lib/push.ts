import webpush from "web-push";
import { connectDb } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { PushSubscription } from "@/models/PushSubscription";

let vapidConfigured = false;
let vapidWarned = false;

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

export interface PushNotificationInput {
  id?: unknown;
  title?: string;
  body?: string;
  link?: string;
  type?: string;
}

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    if (!vapidWarned) {
      vapidWarned = true;
      console.warn("Push: VAPID keys missing (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
    }
    return;
  }
  const subject = process.env.VAPID_SUBJECT ?? "mailto:no-reply@flowzen.local";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Sends a browser push for a notification. Prefers the just-created
 * notification when the caller passes it (deterministic), otherwise falls back
 * to the user's most recent notification. Safe to fire-and-forget: always
 * swallows errors.
 */
export async function sendNotificationPush(
  userId: string,
  notification?: PushNotificationInput | null,
) {
  ensureVapid();
  if (!vapidConfigured) return;

  try {
    await connectDb();
    const subs = await PushSubscription.find({ user: userId }).lean<LeanSubscription[]>();
    if (subs.length === 0) {
      console.log("Push: no subscriptions found for userId=", userId);
      return;
    }

    let source: LeanNotification | null = null;

    if (notification?.id) {
      const doc = await Notification.findById(notification.id).lean<LeanNotification | null>();
      if (doc) source = doc;
    }
    if (!source && notification?.title) {
      source = {
        title: String(notification.title),
        body: String(notification.body ?? ""),
        link: String(notification.link ?? ""),
        type: String(notification.type ?? "info"),
      };
    }
    if (!source) {
      source = await Notification.findOne({ user: userId })
        .sort({ createdAt: -1 })
        .lean<LeanNotification | null>();
    }
    if (!source) return;

    const payload = JSON.stringify({
      title: String(source.title ?? "FlowZen"),
      body: String(source.body || source.message || ""),
      link: String(source.link ?? ""),
      type: String(source.type ?? "info"),
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
          console.log("Push sent OK for userId=", userId);
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is gone/expired — clean it up so we stop hitting it.
            await PushSubscription.deleteOne({ _id: sub._id });
          } else if (statusCode === 401 || statusCode === 403) {
            // VAPID/subscription key mismatch — subscription is unusable.
            console.error(
              "Push send rejected (VAPID/subscription key mismatch), removing stale subscription:",
              statusCode,
            );
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            console.error("Push send failed:", statusCode, err);
          }
        }
      })
    );
  } catch (err) {
    console.error("sendNotificationPush error:", err);
  }
}