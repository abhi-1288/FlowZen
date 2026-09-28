"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Detects leaving the exam: fullscreen exited, tab hidden, window defocused, or
 * the window minimised (which browsers report as a blur).
 *
 * Honest limits, because a candidate will eventually work out what this cannot
 * see:
 *   - ESC and F11 both leave fullscreen, and this can only notice afterwards.
 *   - A second monitor does not fire `blur`, so a fullscreen exam on one screen
 *     with a browser on another is not detected.
 *   - Nothing here prevents any of it. It produces a signal, and the exam
 *     decides what to do about it.
 *
 * `fullscreenSupported` is reported separately so the caller can degrade to a
 * warning. iPhone Safari has no element fullscreen API at all, and blocking on
 * a request that can never succeed would lock the candidate out forever.
 */
export function useFocusGuard(
  active: boolean,
  options?: { requireFullscreen?: boolean; blockOnFocusLoss?: boolean }
) {
  const requireFullscreen = options?.requireFullscreen !== false;
  const blockOnFocusLoss = options?.blockOnFocusLoss !== false;

  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(true);
  // Whether the API exists is a fixed property of the browser, so it is read once
  // on mount rather than synced from an effect that could never see a change.
  const [fullscreenSupported] = useState(() => {
    if (typeof document === "undefined") return false;
    const element = document.documentElement as any;
    return (
      typeof element?.requestFullscreen === "function" ||
      typeof element?.webkitRequestFullscreen === "function"
    );
  });

  // Adopt the current state on mount and whenever proctoring turns on, so a
  // candidate who is already fullscreen is not briefly "violating" on load.
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const element = document.documentElement as any;
    const sync = () => {
      setFullscreen(Boolean(document.fullscreenElement || element.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [active]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const onVisibility = () => setVisible(document.visibilityState === "visible");
    const onFocus = () => setFocused(true);
    // No blur listener is needed for state: `focused` is the inverse of the last
    // focus/blur event, and reading it lazily avoids missing an event between
    // render and listener registration.
    const onBlur = () => setFocused(false);

    onVisibility();
    setFocused(document.hasFocus());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [active]);

  // Where the Fullscreen API is missing entirely, the fullscreen condition is
  // dropped rather than left permanently unsatisfiable. iPhone Safari would
  // otherwise block on a request that can never succeed.
  const fullscreenMissing =
    active && requireFullscreen && fullscreenSupported && !fullscreen;
  const hidden = active && !visible;
  const defocused = active && !focused;
  const focusMissing = blockOnFocusLoss && (hidden || defocused);

  const blocked = active && (fullscreenMissing || focusMissing);

  /** Why the paper is covered, in the candidate's words. */
  const reason = hidden
    ? "You switched to another tab or application."
    : defocused
      ? "This window lost focus."
      : fullscreenMissing
        ? "The exam left fullscreen."
        : "";

  return {
    fullscreen,
    visible,
    focused,
    fullscreenSupported,
    fullscreenMissing,
    hidden,
    defocused,
    blocked,
    reason,
    /** Must be called from a click handler; browsers require a user gesture. */
    requestFullscreen: useCallback(async () => {
      if (typeof document === "undefined") return false;
      const element = document.documentElement as any;
      try {
        if (element.requestFullscreen) {
          await element.requestFullscreen({ navigationUI: "hide" });
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else {
          return false;
        }
        return true;
      } catch {
        // Blocked by permissions policy, or the gesture was consumed. Not fatal:
        // the caller falls back to the warning path.
        return false;
      }
    }, []),
  };
}
