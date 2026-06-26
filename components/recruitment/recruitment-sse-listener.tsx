"use client";

import { useEffect, useRef } from "react";
import { useRecruitmentStore } from "@/store/recruitment-store";

export function RecruitmentSSEListener() {
  const silentRefreshCandidates = useRecruitmentStore((s) => s.silentRefreshCandidates);
  const fetchJobs = useRecruitmentStore((s) => s.fetchJobs);
  const fetchOffers = useRecruitmentStore((s) => s.fetchOffers);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function refreshAfterDebounce(key: string, fn: () => void, ms: number) {
      if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]!);
      debounceRef.current[key] = setTimeout(fn, ms);
    }

    function connect() {
      eventSource = new EventSource("/api/events", { withCredentials: true });

      eventSource.addEventListener("recruitment:update", (e) => {
        let type = "";
        try {
          const data = JSON.parse(e.data);
          type = data?.type || "";
        } catch {}
        if (type.includes("offer") || type.includes("sign")) {
          refreshAfterDebounce("offers", () => fetchOffers({ page: "1", limit: "10" }), 2000);
        }
        refreshAfterDebounce("candidates", () => silentRefreshCandidates(), 2000);
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
      for (const key of Object.keys(debounceRef.current)) {
        clearTimeout(debounceRef.current[key]!);
      }
    };
  }, [silentRefreshCandidates, fetchJobs, fetchOffers]);

  return null;
}
