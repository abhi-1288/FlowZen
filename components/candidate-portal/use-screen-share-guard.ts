"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Best-effort screen-share detection.
 *
 * Stated plainly, because this is the weakest of the checks: a web page cannot
 * inspect another application's capture session. If a candidate shares their
 * screen through OS-level tooling, a remote desktop app, or a browser extension,
 * nothing in this file will see it.
 *
 * What is actually detectable, and what this does:
 *
 *  1. `getDisplayMedia` invoked *on this page*. Wrapping the method on
 *     `navigator.mediaDevices` catches a cast started by this document, which is
 *     the "no casting anywhere" case in scope for our own page. An injected
 *     script that grabs a reference to the original before we wrap it would slip
 *     through — hence the warning, not a block.
 *  2. Losing focus or visibility, which is what starting a share usually does.
 *     That signal is already handled by the focus guard, so it is not duplicated
 *     here.
 *
 * A detected attempt is reported and can block, but the copy the candidate sees
 * says "detected" rather than "confirmed", because it is not proof.
 */
export function useScreenShareGuard(
  active: boolean,
  options?: { block?: boolean; onDetected?: (detail: string) => void }
) {
  const [detected, setDetected] = useState(false);
  const [detail, setDetail] = useState("");
  const onDetectedRef = useRef(options?.onDetected);

  // Synced in an effect, not during render — see the note in use-face-watch.
  useEffect(() => {
    onDetectedRef.current = options?.onDetected;
  }, [options?.onDetected]);

  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const devices = navigator.mediaDevices as any;
    if (!devices || typeof devices.getDisplayMedia !== "function") return;

    const original = devices.getDisplayMedia.bind(devices);
    const report = (why: string) => {
      const message = `${why} (${new Date().toLocaleTimeString()})`;
      setDetected(true);
      setDetail(message);
      onDetectedRef.current?.(message);
    };

    let patched = false;
    try {
      const wrapped = function (this: unknown, ...args: unknown[]) {
        report("Screen sharing or casting was requested from the exam page");
        return original(...(args as [any]));
      };
      Object.defineProperty(devices, "getDisplayMedia", {
        value: wrapped,
        configurable: true,
        writable: true,
      });
      patched = true;
    } catch {
      // Some browsers freeze the mediaDevices object. Detection is unavailable
      // and that is acceptable — the focus guard still covers the common case.
      patched = false;
    }

    return () => {
      if (!patched) return;
      try {
        Object.defineProperty(devices, "getDisplayMedia", {
          value: original,
          configurable: true,
          writable: true,
        });
      } catch {
        // Leave the wrapper in place rather than risk throwing in a cleanup.
      }
    };
  }, [active]);

  return {
    detected,
    detail,
    /** True when the caller should cover the paper. */
    blocked: Boolean(options?.block) && detected,
    acknowledge: () => setDetected(false),
  };
}
