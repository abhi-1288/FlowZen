"use client";

import { useEffect, useRef } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export function RecruitmentSSEListener() {
  const silentRefreshCandidates = useRecruitmentStore((s) => s.silentRefreshCandidates);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource("/api/events", { withCredentials: true });

      eventSource.addEventListener("recruitment:update", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          silentRefreshCandidates();
        }, 2000);
      });

      eventSource.addEventListener("notification:new", () => {
        // handled by sidebar
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [silentRefreshCandidates]);

  return null;
}
