"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { PIN_IDLE_TIMEOUT_MS } from "@/lib/pin";
import { PinLockOverlay } from "@/components/auth/pin-lock-overlay";

type PinStatus = {
  enabled: boolean;
  locked: boolean;
  length: number | null;
  lockoutUntil: number | null;
  failedAttempts: number;
  ready: boolean;
};

const INITIAL_STATUS: PinStatus = {
  enabled: false,
  locked: false,
  length: null,
  lockoutUntil: null,
  failedAttempts: 0,
  ready: false,
};

const HEARTBEAT_INTERVAL_MS = 60_000;
const IDLE_CHECK_MS = 30_000;

type PinLockContextValue = {
  enabled: boolean;
  locked: boolean;
  length: number | null;
  ready: boolean;
  lockNow: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PinLockContext = createContext<PinLockContextValue>({
  enabled: false,
  locked: false,
  length: null,
  ready: false,
  lockNow: async () => {},
  refresh: async () => {},
});

export function usePinLock() {
  return useContext(PinLockContext);
}

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus, data: session } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const [status, setStatus] = useState<PinStatus>(INITIAL_STATUS);
  const lastActivityRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const broadcast = useCallback((type: "locked" | "unlocked") => {
    try {
      channelRef.current?.postMessage({ type });
    } catch {
      // BroadcastChannel is best-effort cross-tab sync.
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch("/api/auth/pin/status", { cache: "no-store" });
      if (!response.ok) {
        setStatus((previous) => ({ ...previous, ready: true }));
        return;
      }
      const data = await response.json();
      setStatus({
        enabled: Boolean(data.enabled),
        locked: Boolean(data.locked),
        length: data.length ?? null,
        lockoutUntil: data.lockoutUntil ?? null,
        failedAttempts: data.failedAttempts ?? 0,
        ready: true,
      });
    } catch {
      setStatus((previous) => ({ ...previous, ready: true }));
    }
  }, [isAuthenticated]);

  const sendHeartbeat = useCallback(async () => {
    lastHeartbeatRef.current = Date.now();
    try {
      const response = await fetch("/api/auth/pin/heartbeat", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      setStatus((previous) => ({
        ...previous,
        enabled: Boolean(data.enabled),
        locked: Boolean(data.locked),
        length: data.length ?? previous.length,
        lockoutUntil: data.lockoutUntil ?? null,
        ready: true,
      }));
    } catch {
      // Offline; the next interval will retry.
    }
  }, []);

  const lockNow = useCallback(async () => {
    setStatus((previous) => ({ ...previous, locked: previous.enabled }));
    broadcast("locked");
    try {
      await fetch("/api/auth/pin/lock", { method: "POST", cache: "no-store" });
    } catch {
      // Server state is authoritative; the idle interval will retry.
    }
  }, [broadcast]);

  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(INITIAL_STATUS);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("flowzen-pin-lock");
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "unlocked") {
        setStatus((previous) => ({ ...previous, locked: false }));
      } else if (event.data?.type === "locked") {
        setStatus((previous) => ({ ...previous, locked: true }));
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !status.enabled) return;

    let throttle: number | null = null;
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (document.visibilityState === "visible" && !status.locked) {
        if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
          void sendHeartbeat();
        }
      }
    };
    const onActivity = () => {
      if (throttle) return;
      throttle = window.setTimeout(() => {
        throttle = null;
        markActivity();
      }, 1000);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!status.locked && Date.now() - lastActivityRef.current > PIN_IDLE_TIMEOUT_MS) {
        void lockNow();
        return;
      }
      void refresh();
    };

    const events = ["pointerdown", "keydown", "mousemove", "wheel", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      if (throttle) window.clearTimeout(throttle);
    };
  }, [isAuthenticated, status.enabled, status.locked, sendHeartbeat, lockNow, refresh]);

  useEffect(() => {
    if (!isAuthenticated || !status.enabled) return;
    const idleTimer = window.setInterval(() => {
      if (status.locked || document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current > PIN_IDLE_TIMEOUT_MS) {
        void lockNow();
      } else if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
        void sendHeartbeat();
      }
    }, IDLE_CHECK_MS);
    const pollTimer = window.setInterval(() => void refresh(), HEARTBEAT_INTERVAL_MS);
    return () => {
      window.clearInterval(idleTimer);
      window.clearInterval(pollTimer);
    };
  }, [isAuthenticated, status.enabled, status.locked, lockNow, sendHeartbeat, refresh]);

  const handleUnlocked = useCallback(() => {
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    setStatus((previous) => ({ ...previous, locked: false }));
    broadcast("unlocked");
  }, [broadcast]);

  const value = useMemo<PinLockContextValue>(
    () => ({
      enabled: status.enabled,
      locked: status.locked,
      length: status.length,
      ready: status.ready,
      lockNow,
      refresh,
    }),
    [status.enabled, status.locked, status.length, status.ready, lockNow, refresh],
  );

  // Avoid a brief flash of protected content on reload while the first status
  // check is in flight for users who have a PIN configured.
  const showGate = isAuthenticated && (session?.user?.pinEnabled ?? false) && !status.ready;

  return (
    <PinLockContext.Provider value={value}>
      {children}
      {showGate ? (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-white dark:bg-[#0a0a0a]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600 dark:border-zinc-800 dark:border-t-zinc-300" />
        </div>
      ) : null}
      {status.locked && status.length ? (
        <PinLockOverlay
          length={status.length}
          lockoutUntil={status.lockoutUntil}
          onUnlocked={handleUnlocked}
          onStatus={() => void refresh()}
        />
      ) : null}
    </PinLockContext.Provider>
  );
}
