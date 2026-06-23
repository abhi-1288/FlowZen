"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useNotificationToast } from "@/lib/toast-context";
import { apiFetch } from "@/lib/client-utils";

export function GlobalNotificationListener() {
  const { data: session } = useSession();
  const { showNotificationToast } = useNotificationToast();
  const audioUnlocked = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const unlock = () => {
      if (audioUnlocked.current) return;
      const audio = new Audio("/sound/notification_sound.mp3");
      audio.volume = 0.01;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        audioRef.current = audio;
        audioUnlocked.current = true;
      }).catch(() => {});
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock, { once: true });

    let eventSource: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/events", { withCredentials: true });

        eventSource.addEventListener("notification:new", () => {
          if (!mounted) return;
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else {
            new Audio("/sound/notification_sound.mp3").play().catch(() => {});
          }
          apiFetch<{ notifications: any[] }>("/api/notifications")
            .then((res) => {
              const latest = res.notifications?.[0];
              if (latest) showNotificationToast(String(latest.title ?? "Notification"), String(latest.body ?? ""));
            })
            .catch(() => {});
        });

        eventSource.onerror = () => {
          if (mounted) {
            eventSource?.close();
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error("SSE connection failed:", err);
      }
    };

    connect();

    return () => {
      mounted = false;
      eventSource?.close();
      document.removeEventListener("click", unlock);
    };
  }, [session?.user?.id, showNotificationToast]);

  return null;
}
