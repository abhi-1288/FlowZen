function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function saveSubscription(subscription) {
  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Failed to save push subscription");
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "FlowZen";
  const options = {
    body: data.body || "",
    icon: "/Logos/logo.jpg",
    badge: "/Logos/logo.jpg",
    data: {
      link: data.link || "",
      url: data.url || (data.link || "/"),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const relativeUrl = notificationData.link || notificationData.url || "/";
  const target = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch("/api/push/vapid");
        const { publicKey } = await response.json();
        if (!publicKey) return;
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
        await saveSubscription(subscription);
      } catch (err) {
        console.error("pushsubscriptionchange failed:", err);
      }
    })()
  );
});