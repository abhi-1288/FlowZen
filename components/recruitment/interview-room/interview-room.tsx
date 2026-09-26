"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, Video, VideoOff } from "lucide-react";
import { EndCallConfirm } from "@/components/recruitment/interview-room/end-call-confirm";
import { useWebRtcCall } from "@/components/recruitment/interview-room/use-webrtc-call";
import { useMediaDevices } from "@/components/recruitment/interview-room/media-devices";
import { VideoSurface } from "@/components/recruitment/interview-room/video-surface";
import type { SignalRole } from "@/lib/signaling/types";

export type RoomCredentials = {
  roomId: string;
  role: SignalRole;
  displayName: string;
  peerName: string;
  signaling: "supabase" | "firebase";
  iceServers: RTCIceServer[];
};

function statusMessage(phase: ReturnType<typeof useWebRtcCall>["phase"], peerPresent: boolean) {
  switch (phase) {
    case "requesting-media":
      return "Requesting camera and microphone access…";
    case "waiting-for-peer":
      return peerPresent ? "Peer joined — connecting…" : "Waiting for the other participant to join…";
    case "connecting":
      return "Connecting securely…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Connection interrupted — reconnecting…";
    case "peer-left":
      return "The other participant left the call.";
    case "ended-by-peer":
      return "The interviewer ended the call.";
    case "failed":
      return "The call could not be started.";
    default:
      return "";
  }
}

const GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

/**
 * Plays the peer's audio on a detached element.
 *
 * Remote audio is deliberately not attached to the remote video tile, because
 * muting the element is how feedback is avoided. Playback is still subject to the
 * autoplay policy, and since getUserMedia usually resolves after an awaited
 * click the original user gesture may no longer count, so a refused play() is
 * retried on the next interaction instead of failing silently.
 */
function useRemoteAudio(stream: MediaStream | null) {
  const ref = useRef<HTMLAudioElement>(null);
  // Which stream playback was refused for, rather than a boolean needing a reset.
  const [blockedFor, setBlockedFor] = useState<MediaStream | null>(null);

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
    for (const name of GESTURE_EVENTS) {
      window.addEventListener(name, tryPlay, { passive: true });
    }
    return () => {
      cancelled = true;
      for (const name of GESTURE_EVENTS) {
        window.removeEventListener(name, tryPlay);
      }
      element.srcObject = null;
    };
  }, [stream]);

  return { audioRef: ref, needsGesture: Boolean(stream) && blockedFor === stream };
}

export function InterviewRoom({
  credentials,
  candidateName,
  jobTitle,
  onEnd,
  onPeerEnded,
  compact: compactProp,
}: {
  credentials: RoomCredentials;
  candidateName: string;
  jobTitle: string;
  onEnd: () => void;
  onPeerEnded: () => void;
  /**
   * Tightens the chrome for the small docked panel. The room always fills its
   * container, so the parent decides how much room the call gets.
   */
  compact?: boolean;
}) {
  const compact = compactProp ?? false;
  const isInterviewer = credentials.role === "interviewer";
  const peerLabel = isInterviewer ? candidateName : credentials.peerName;
  const media = useMediaDevices();

  const call = useWebRtcCall({
    roomId: credentials.roomId,
    role: credentials.role,
    displayName: credentials.displayName,
    onEndedByPeer: onPeerEnded,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { audioRef, needsGesture: needsAudioGesture } = useRemoteAudio(call.remoteStream);

  async function startRetry() {
    setRetrying(true);
    try {
      await call.retry();
    } finally {
      setRetrying(false);
    }
  }

  async function confirmEnd() {
    setEnding(true);
    await call.hangUp();
    setEnding(false);
    setConfirmOpen(false);
    onEnd();
  }

  const status = statusMessage(call.phase, call.peerPresent);
  const showOverlay = call.phase === "failed";
  const hasLocalMedia = Boolean(media.stream);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
      <div
        className={`flex shrink-0 items-center border-b border-white/10 px-3 py-2 ${
          compact || !isInterviewer ? "justify-end" : "justify-between gap-2"
        }`}
      >
        {/* In the docked panel the surrounding chrome already names the peer, so
            the room header only carries the hang-up control. */}
        {compact || !isInterviewer ? null : (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{peerLabel}</p>
            <p className="truncate text-[11px] text-slate-400">{jobTitle}</p>
          </div>
        )}
        {isInterviewer ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={call.phase === "failed" || call.phase === "ended-by-peer"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PhoneOff size={14} />
            End call
          </button>
        ) : (
          // Candidates had no way out of a call at all — only the interviewer got
          // a control, so a candidate could only escape by navigating away.
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <PhoneOff size={14} />
            Leave
          </button>
        )}
      </div>

      {/* min-h-0 on the column and on the remote tile is what lets them shrink
          inside a 440px dock instead of overflowing it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
        <VideoSurface
          stream={call.remoteStream}
          label={peerLabel}
          className="min-h-0 flex-1"
        />

        <div className="flex shrink-0 items-end justify-between gap-2.5">
          <VideoSurface
            stream={media.stream}
            muted
            mirror
            label="You"
            className={compact ? "h-20 w-28 shrink-0" : "h-28 w-40 shrink-0"}
          />

          <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
            <p
              className={`text-right text-[11px] font-medium leading-4 ${
                call.phase === "connected"
                  ? "text-emerald-400"
                  : call.phase === "failed"
                    ? "text-rose-400"
                    : "text-slate-400"
              }`}
            >
              {status}
            </p>

            {needsAudioGesture && call.remoteStream ? (
              <p className="rounded-lg bg-amber-500/15 px-2 py-1 text-right text-[10px] font-medium leading-4 text-amber-200">
                Click anywhere to hear them
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={media.toggleMic}
                disabled={!hasLocalMedia}
                aria-label={call.micOn ? "Mute microphone" : "Unmute microphone"}
                title={call.micOn ? "Mute microphone" : "Unmute microphone"}
                className={`grid place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  compact ? "h-9 w-9" : "h-11 w-11"
                } ${
                  call.micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-600 text-white hover:bg-rose-700"
                }`}
              >
                {call.micOn ? <Mic size={compact ? 15 : 18} /> : <MicOff size={compact ? 15 : 18} />}
              </button>

              <button
                type="button"
                onClick={media.toggleCamera}
                disabled={!hasLocalMedia}
                aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
                title={call.cameraOn ? "Turn camera off" : "Turn camera on"}
                className={`grid place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  compact ? "h-9 w-9" : "h-11 w-11"
                } ${
                  call.cameraOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-600 text-white hover:bg-rose-700"
                }`}
              >
                {call.cameraOn ? <Video size={compact ? 15 : 18} /> : <VideoOff size={compact ? 15 : 18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {showOverlay ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/90 px-5 text-center">
          <div className="max-w-xs">
            <h3 className="text-sm font-semibold text-white">Call unavailable</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{call.error}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void startRetry()}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={14} /> {retrying ? "Retrying…" : "Try again"}
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!compact ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 hidden items-center gap-1.5 rounded-lg bg-slate-950/75 px-2 py-1 text-[10px] font-medium text-emerald-300 backdrop-blur sm:flex">
          <ShieldCheck size={12} /> Secure peer-to-peer interview
        </div>
      ) : null}

      <EndCallConfirm
        open={confirmOpen}
        candidateName={peerLabel}
        busy={ending}
        onConfirm={() => void confirmEnd()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
