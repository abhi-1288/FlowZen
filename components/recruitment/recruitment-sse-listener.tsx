"use client";

import { useEffect } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export function RecruitmentSSEListener() {
  const silentRefreshCandidates = useRecruitmentStore((s) => s.silentRefreshCandidates);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource("/api/events", { withCredentials: true });

      eventSource.addEventListener("recruitment:update", () => {
        silentRefreshCandidates();
      });

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [silentRefreshCandidates]);

  return null;
}
