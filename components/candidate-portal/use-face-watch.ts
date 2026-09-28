"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Warns when more than one person appears to be in shot.
 *
 * Two very different strategies, and it is worth being blunt about the weaker
 * one:
 *
 *  1. `FaceDetector` (the Shape Detection API) counts faces properly. It ships
 *     in Chromium behind a flag and is not available in Firefox or Safari, so on
 *     most machines this branch never runs.
 *
 *  2. The fallback samples the video into a small canvas, splits it into a 3x3
 *     grid, and measures motion energy per cell between frames. Cells that
 *     sustain movement indicate a person-shaped region. It can tell "one person
 *     moving" from "movement in two separate places", which is what actually
 *     matters for catching a second person in frame — but it is a motion
 *     heuristic, not face detection. A fan, a pet, or a strong lamp moving will
 *     trip it.
 *
 * Because of (2) this only ever *warns*. It is never used to block or to reject.
 */
export function useFaceWatch(
  stream: MediaStream | null,
  active: boolean,
  options?: { intervalMs?: number; onExtraFaces?: (count: number) => void }
) {
  const [extraFaces, setExtraFaces] = useState(0);
  const [mode, setMode] = useState<"detector" | "motion" | "off">("off");

  const onExtraFacesRef = useRef(options?.onExtraFaces);

  // Synced in an effect rather than during render: the callback identity changes
  // on every parent render, and writing a ref while rendering is not allowed.
  useEffect(() => {
    onExtraFacesRef.current = options?.onExtraFaces;
  }, [options?.onExtraFaces]);

  const intervalMs = options?.intervalMs ?? 2000;
  const previousRef = useRef<{ cells: number[]; at: number } | null>(null);
  const consecutiveRef = useRef(0);
  const lastReportedRef = useRef(0);

  useEffect(() => {
    if (!active || !stream || stream.getVideoTracks().length === 0) {
      setExtraFaces(0);
      setMode("off");
      return;
    }

    const track = stream.getVideoTracks()[0];
    const Detector = (window as any).FaceDetector as
      | (new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        })
      | undefined;

    if (Detector) {
      setMode("detector");
      const detector = new Detector({ fastMode: true, maxDetectedFaces: 4 });
      const probe = document.createElement("video");
      probe.muted = true;
      probe.playsInline = true;
      probe.srcObject = stream;
      let cancelled = false;
      const timer = window.setInterval(async () => {
        if (cancelled || probe.readyState < 2) return;
        try {
          const found = await detector.detect(probe);
          if (cancelled) return;
          if (found.length > 1) {
            setExtraFaces(found.length);
            if (Date.now() - lastReportedRef.current > intervalMs) {
              lastReportedRef.current = Date.now();
              onExtraFacesRef.current?.(found.length);
            }
          } else {
            setExtraFaces(0);
            consecutiveRef.current = 0;
          }
        } catch {
          // A detector that throws on a given frame is not evidence of anything;
          // stop rather than spam.
          cancelled = true;
          setMode("off");
          window.clearInterval(timer);
        }
      }, intervalMs);
      void probe.play().catch(() => {});
      return () => {
        cancelled = true;
        window.clearInterval(timer);
        probe.srcObject = null;
      };
    }

    // ── Motion-grid fallback ────────────────────────────────────────────────
    setMode("motion");
    const probe = document.createElement("video");
    probe.muted = true;
    probe.playsInline = true;
    probe.srcObject = stream;
    void probe.play().catch(() => {});

    const canvas = document.createElement("canvas");
    const GRID = 3;
    const CELL = 32;
    canvas.width = GRID * CELL;
    canvas.height = GRID * CELL;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const timer = window.setInterval(() => {
      if (!ctx || probe.readyState < 2 || probe.videoWidth === 0) return;
      ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const cells = new Array(GRID * GRID).fill(0);
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          let total = 0;
          for (let py = 0; py < CELL; py++) {
            const row = (y * CELL + py) * canvas.width;
            for (let px = 0; px < CELL; px++) {
              const i = (row + x * CELL + px) * 4;
              total += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
          }
          cells[y * GRID + x] = total / (CELL * CELL);
        }
      }

      const previous = previousRef.current;
      previousRef.current = { cells, at: Date.now() };
      if (!previous) return;

      // A cell counts as "occupied" when it both has some light and is changing.
      // The brightness floor is what stops a static poster on the wall from
      // looking like a person once anything else in frame moves.
      const active = cells.filter((v, i) => {
        const lit = v > 28 && v < 240;
        return lit && Math.abs(v - previous.cells[i]) > 2.5;
      }).length;

      // Two consecutive samples, so a single frame of a hand reaching past the
      // lens does not read as a second person.
      if (active >= 2) {
        consecutiveRef.current += 1;
        if (consecutiveRef.current >= 2) {
          setExtraFaces(active);
          if (Date.now() - lastReportedRef.current > intervalMs * 3) {
            lastReportedRef.current = Date.now();
            onExtraFacesRef.current?.(active);
          }
        }
      } else {
        consecutiveRef.current = 0;
        setExtraFaces(0);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      probe.srcObject = null;
      previousRef.current = null;
    };
  }, [stream, active, intervalMs]);

  return { extraFaces, mode, warned: extraFaces > 1 };
}
