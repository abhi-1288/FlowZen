"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { ActionButton } from "@/components/profile/profile-hub/shared";
import {
  getExistingSubscription,
  isPushSupported,
  pushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

export function PushNotificationSettings() {
  const supported = isPushSupported();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;

    const refresh = () => {
      pushPermissionState().then((next) => {
        if (active) setPermission(next);
      });
      getExistingSubscription()
        .then((subscription) => {
          if (active) setSubscribed(Boolean(subscription));
        })
        .catch(() => {});
    };

    refresh();

    let listener: { removeEventListener: (event: string, cb: () => void) => void } | null = null;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          if (!active) return;
          listener = status;
          status.addEventListener("change", refresh);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
      listener?.removeEventListener("change", refresh);
    };
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    try {
      const ok = await subscribeToPush();
      setSubscribed(ok);
      setPermission(await pushPermissionState());
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    const iosHint = /iP(hone|ad|od)/.test(navigator.userAgent)
      ? " On iPhone/iPad, add FlowZen to your Home Screen (Share > Add to Home Screen) to enable them."
      : "";
    return (
      <div className="mb-5 rounded-xl border border-[var(--c-border-light)] p-4">
        <p className="text-sm text-slate-500">Browser notifications aren&apos;t supported on this browser.{iosHint}</p>
      </div>
    );
  }

  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
  const blocked = permission === "denied";

  let description = "Get alerts on this device even when the site isn't open.";
  if (subscribed) description = "Enabled — you'll get push alerts even when FlowZen is closed.";
  else if (blocked)
    description = "Notifications are blocked by your browser. Allow them in your browser settings.";
  else if (isIos) description += " On iPhone/iPad, add FlowZen to your Home Screen first.";

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--c-border-light)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700">
          {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
        </div>
        <div>
          <p className="text-sm font-medium">Browser notifications</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {!blocked ? (
        subscribed ? (
          <ActionButton variant="secondary" className="px-3" disabled={busy} onClick={disable}>
            <BellOff size={16} /> Disable
          </ActionButton>
        ) : (
          <ActionButton variant="primary" className="px-3" disabled={busy} onClick={enable}>
            <Bell size={16} /> Enable
          </ActionButton>
        )
      ) : null}
    </div>
  );
}