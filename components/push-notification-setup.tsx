"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ensureServiceWorker, syncPushSubscription, unsubscribeFromPush } from "@/lib/push-client";

/**
 * Registers the service worker (required for web push) while a user is signed
 * in, restores any existing browser subscription to the server, and removes
 * this device's subscription on sign-out. Requests no permission itself —
 * that happens via the toggle in Profile > Notifications.
 */
export function PushNotificationSetup() {
  const { status, data: session } = useSession();
  const userId = session?.user?.id;
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevUserId.current !== undefined && prevUserId.current && !userId) {
      // User signed out — drop this device's subscription for them.
      unsubscribeFromPush().catch(() => {});
    }
    prevUserId.current = userId;
  }, [userId]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    ensureServiceWorker();
    syncPushSubscription().catch(() => {});
  }, [status, userId]);

  return null;
}