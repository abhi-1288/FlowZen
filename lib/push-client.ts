import { apiFetch } from "@/lib/client-utils";

const VAPID_URL = "/api/push/vapid";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getVapidPublicKey(): Promise<string | null> {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  }
  try {
    const res = await apiFetch<{ publicKey: string }>(VAPID_URL, undefined, { toast: false });
    return res.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error("Service worker registration failed:", err);
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await ensureServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function submitSubscription(subscription: PushSubscription) {
  await apiFetch<{ ok: boolean }>(
    "/api/notifications/subscribe",
    {
      method: "POST",
      body: JSON.stringify({
        ...subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    },
    { toast: false }
  );
}

async function removeSubscription(endpoint?: string) {
  await apiFetch<{ ok: boolean }>(
    "/api/notifications/subscribe",
    {
      method: "DELETE",
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    },
    { toast: false }
  );
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await ensureServiceWorker();
  if (!registration) return false;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return false;

  try {
    // The browser's subscription is the source of truth. If one already
    // exists, keep it — destroying it risks losing it forever (its endpoint
    // becomes invalid, leaving a stale record on the server). Just persist it.
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await submitSubscription(existing);
      return true;
    }

    const publicKey = await getVapidPublicKey();
    if (!publicKey) return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await submitSubscription(subscription);
    return true;
  } catch (err) {
    console.error("Push subscribe failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  let endpoint: string | undefined;
  try {
    const registration = await ensureServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint;
    if (subscription) await subscription.unsubscribe();
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
  }

  if (!endpoint) return;

  try {
    await removeSubscription(endpoint);
  } catch (err) {
    console.error("Push server cleanup failed:", err);
  }
}

/**
 * Restores an existing browser subscription to the server (e.g. after a
 * reinstall, a device switch, or when a previous sync was lost).
 */
export async function syncPushSubscription() {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const subscription = await getExistingSubscription();
    if (subscription) await submitSubscription(subscription);
  } catch (err) {
    console.error("Push sync failed:", err);
  }
}

export async function pushPermissionState(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}