"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";

const GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;
/** How long to wait for a frame before calling the device "acquired but silent". */
const FRAME_TIMEOUT_MS = 2500;

/**
 * A `<video>` bound to a MediaStream, with a placeholder while there is nothing
 * to show.
 *
 * Autoplay is not always available: getUserMedia typically resolves after an
 * awaited click handler, by which point iOS has already discarded the user
 * gesture that would have unlocked playback. So a refused `play()` is retried on
 * the next real interaction, and until then the user is told why there is no
 * picture rather than being left looking at a black rectangle.
 *
 * It also distinguishes "we hold a live track" from "frames are actually
 * arriving". Those are genuinely different failures — a camera claimed by another
 * app, a revoked permission, or a device that opened but never delivers — and
 * collapsing them into one black box is what makes this so hard to debug.
 */
export function VideoSurface({
  stream,
  muted,
  mirror,
  label,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Tracks which stream playback was refused for, rather than a boolean that
  // needs resetting when the stream changes.
  const [blockedFor, setBlockedFor] = useState<MediaStream | null>(null);
  const [noFramesFor, setNoFramesFor] = useState<MediaStream | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    if (!stream) return;

    let cancelled = false;
    const tryPlay = () => {
      element.play().then(
        () => {
          if (!cancelled) setBlockedFor(null);
        },
        () => {
          if (!cancelled) setBlockedFor(stream);
        }
      );
    };

    tryPlay();

    // Playback succeeding is not the same as a picture arriving. If nothing has
    // decoded by the time the timeout fires, say so — a black tile with no
    // explanation is indistinguishable from a broken component.
    const hasVideoTrack = stream.getVideoTracks().length > 0;
    const frameTimer = hasVideoTrack
      ? window.setTimeout(() => {
          if (cancelled) return;
          if (element.videoWidth === 0) setNoFramesFor(stream);
        }, FRAME_TIMEOUT_MS)
      : null;

    // A frame can also show up later (a slow device waking up), so clear the
    // warning as soon as one is decoded.
    const onPlaying = () => {
      if (!cancelled && element.videoWidth > 0) setNoFramesFor(null);
    };
    element.addEventListener("playing", onPlaying);
    element.addEventListener("loadeddata", onPlaying);

    for (const name of GESTURE_EVENTS) {
      window.addEventListener(name, tryPlay, { passive: true });
    }
    return () => {
      cancelled = true;
      if (frameTimer !== null) window.clearTimeout(frameTimer);
      element.removeEventListener("playing", onPlaying);
      element.removeEventListener("loadeddata", onPlaying);
      for (const name of GESTURE_EVENTS) {
        window.removeEventListener(name, tryPlay);
      }
      element.srcObject = null;
    };
  }, [stream]);

  const blocked = Boolean(stream) && blockedFor === stream;
  const noFrames = Boolean(stream) && noFramesFor === stream;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 ${className ?? ""}`}>
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-600">
          <Video size={28} />
        </div>
      )}

      {noFrames ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/85 px-3 text-center">
          <div>
            <VideoOff size={20} className="mx-auto text-amber-400" />
            <p className="mt-1.5 text-[11px] font-medium leading-4 text-amber-200">
              Camera is on but no picture is arriving. Try another camera, or close any app that may be using it.
            </p>
          </div>
        </div>
      ) : null}

      {stream && blocked && !noFrames ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/70 px-3 text-center">
          <p className="text-[11px] font-medium text-slate-300">Click anywhere to start the video</p>
        </div>
      ) : null}

      {label ? (
        <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/75 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
          {label}
        </span>
      ) : null}
    </div>
  );
}
