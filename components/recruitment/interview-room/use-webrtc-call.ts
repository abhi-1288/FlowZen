"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSignalingClient } from "@/lib/signaling";
import { SignalingUnavailableError, type SignalMessage, type SignalingClient, type SignalPayload } from "@/lib/signaling/types";
import { RTC_CONFIGURATION } from "@/lib/webrtc-config";
import { useMediaDevices } from "@/components/recruitment/interview-room/media-devices";

export type CallPhase =
  | "idle"
  | "requesting-media"
  | "waiting-for-peer"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "peer-left"
  | "ended-by-peer"
  | "ended"
  | "failed";

export type WebRtcCallOptions = {
  roomId: string;
  role: "candidate" | "interviewer";
  displayName: string;
  onEndedByPeer?: () => void;
  onError?: (message: string) => void;
};

const MAX_ICE_RESTARTS = 3;

/**
 * Drives a 1:1 peer-to-peer interview call.
 *
 * The interviewer is always the offerer, so the two peers can never create an
 * offer at the same time and no negotiation tie-breaking is required. Camera
 * and microphone toggles flip `track.enabled` rather than adding or removing
 * tracks, which keeps the call free of renegotiation entirely.
 *
 * Local media is owned by MediaDevicesProvider, not by this hook. This hook only
 * reads the stream and hands its tracks to the peer connection, which is why it
 * deliberately never stops the local tracks itself — doing so is what used to
 * kill the camera the moment permission was granted.
 */
export function useWebRtcCall({
  roomId,
  role,
  displayName,
  onEndedByPeer,
  onError,
}: WebRtcCallOptions) {
  const media = useMediaDevices();
  const { acquire, getStream, getError } = media;

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const [peerName, setPeerName] = useState("");
  const [error, setError] = useState("");

  const signalingRef = useRef<SignalingClient | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const iceRestartsRef = useRef(0);
  const remoteDescriptionSetRef = useRef(false);
  // Incremented by every start(). An async continuation whose generation is stale
  // has been superseded and must not write state.
  const generationRef = useRef(0);
  // True once the hook is unmounted. Unlike a one-way latch it is re-armed by
  // start(), so React's StrictMode mount -> cleanup -> mount cycle leaves the call
  // usable instead of permanently disabling it.
  const disposedRef = useRef(false);
  // Lets the connection-state handler reach the restart helper, which is
  // declared after the peer-connection factory that installs the handler.
  const attemptIceRestartRef = useRef<(pc: RTCPeerConnection) => Promise<void>>(async () => {});

  const callbacksRef = useRef({ onEndedByPeer, onError });

  // Keep the latest callbacks reachable from long-lived signal handlers without
  // re-subscribing to the signalling channel on every render.
  useEffect(() => {
    callbacksRef.current = { onEndedByPeer, onError };
  }, [onEndedByPeer, onError]);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("failed");
    callbacksRef.current.onError?.(message);
  }, []);

  /**
   * Sends a signal, reporting a dropped send instead of discarding it.
   *
   * This used to be `signalingRef.current?.send(...)` in seven places, which
   * silently threw away the offer, answer, ICE candidates and the hang-up notice
   * whenever signalling was not up yet — producing a call that simply never
   * connected with nothing in the console.
   */
  const sendSignal = useCallback(
    async (payload: SignalPayload) => {
      const signaling = signalingRef.current;
      if (!signaling) {
        fail("Lost the signalling connection. Rejoin the call to continue.");
        return;
      }
      try {
        await signaling.send(payload);
      } catch (sendError) {
        fail(
          sendError instanceof Error
            ? sendError.message
            : "Lost the signalling connection. Rejoin the call to continue."
        );
      }
    },
    [fail]
  );

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnectionRef.current = pc;
    makingOfferRef.current = false;
    iceRestartsRef.current = 0;
    remoteDescriptionSetRef.current = false;
    pendingCandidatesRef.current = [];

    const stream = getStream();
    if (stream) {
      stream.getTracks().forEach((track) => {
        const alreadyAdded = pc.getSenders().some((sender) => sender.track === track);
        if (!alreadyAdded) pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (event) => {
      const [incoming] = event.streams;
      const stream = incoming ?? remoteStreamRef.current ?? new MediaStream();
      if (!incoming) stream.addTrack(event.track);
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal({ kind: "ice", candidate: event.candidate.toJSON() });
      }
    };

    // Buffer ICE candidates that arrive before the remote description is set.
    pc.onnegotiationneeded = async () => {
      if (role !== "interviewer" || disposedRef.current) return;
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription(await pc.createOffer());
        const description = pc.localDescription;
        if (description) {
          await sendSignal({ kind: "offer", sdp: description.toJSON() });
        }
      } catch (offerError) {
        fail(
          offerError instanceof Error
            ? offerError.message
            : "Could not start the call. Please rejoin."
        );
      } finally {
        makingOfferRef.current = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (disposedRef.current) return;
      switch (pc.connectionState) {
        case "connected":
          iceRestartsRef.current = 0;
          setPhase("connected");
          break;
        case "disconnected":
          // A brief blip resolves itself; surface a reconnecting state.
          setPhase("reconnecting");
          break;
        case "failed":
          void attemptIceRestartRef.current(pc);
          break;
        case "closed":
          break;
        default:
          break;
      }
    };

    return pc;
  }, [fail, getStream, role, sendSignal]);

  const attemptIceRestart = useCallback(
    async (pc: RTCPeerConnection) => {
      if (disposedRef.current || role !== "interviewer") {
        setPhase("peer-left");
        return;
      }
      if (iceRestartsRef.current >= MAX_ICE_RESTARTS) {
        setPhase("peer-left");
        return;
      }
      iceRestartsRef.current += 1;
      setPhase("reconnecting");
      try {
        await pc.restartIce();
        await pc.setLocalDescription(await pc.createOffer({ iceRestart: true }));
        const description = pc.localDescription;
        if (description) {
          await sendSignal({ kind: "offer", sdp: description.toJSON() });
        }
      } catch {
        setPhase("peer-left");
      }
    },
    [role, sendSignal]
  );

  useEffect(() => {
    attemptIceRestartRef.current = attemptIceRestart;
  }, [attemptIceRestart]);

  const applyRemoteCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    if (!remoteDescriptionSetRef.current) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // A candidate for a rejected/discarded generation is safe to drop.
    }
  }, []);

  const drainPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleMessage = useCallback(
    async (message: SignalMessage) => {
      if (disposedRef.current) return;

      if (message.kind === "offer") {
        if (role === "interviewer") {
          // Only the interviewer offers; ignore a duplicate rather than glare.
          return;
        }
        try {
          const pc = createPeerConnection();
          setPhase("connecting");
          await pc.setRemoteDescription(message.sdp);
          remoteDescriptionSetRef.current = true;
          await drainPendingCandidates();
          await pc.setLocalDescription(await pc.createAnswer());
          const description = pc.localDescription;
          if (description) {
            await sendSignal({ kind: "answer", sdp: description.toJSON() });
          }
        } catch (answerError) {
          fail(
            answerError instanceof Error
              ? answerError.message
              : "Could not answer the incoming call."
          );
        }
        return;
      }

      if (message.kind === "answer") {
        if (role !== "interviewer") return;
        const pc = peerConnectionRef.current;
        if (!pc || pc.signalingState !== "have-local-offer") return;
        try {
          await pc.setRemoteDescription(message.sdp);
          remoteDescriptionSetRef.current = true;
          await drainPendingCandidates();
          setPhase("connecting");
        } catch (answerError) {
          fail(
            answerError instanceof Error
              ? answerError.message
              : "Could not complete the call handshake."
          );
        }
        return;
      }

      if (message.kind === "ice") {
        await applyRemoteCandidate(message.candidate);
        return;
      }

      if (message.kind === "bye") {
        setPhase("ended-by-peer");
        callbacksRef.current.onEndedByPeer?.();
      }
    },
    [applyRemoteCandidate, createPeerConnection, drainPendingCandidates, fail, role, sendSignal]
  );

  const teardown = useCallback(async () => {
    // Unsubscribe for real. This used to just drop the reference, which meant the
    // unmount cleanup's `signalingRef.current?.disconnect()` was always a no-op:
    // on Supabase the channel stayed joined and presence was never untracked, and
    // on Firebase the local presence node and its listeners survived the call.
    const signaling = signalingRef.current;
    signalingRef.current = null;
    if (signaling) {
      try {
        await signaling.disconnect();
      } catch {
        // The socket may already be gone; nothing left to release.
      }
    }

    try {
      peerConnectionRef.current?.close();
    } catch {
      // already closed
    }
    peerConnectionRef.current = null;

    // Only the remote side is ours to release. Local tracks belong to
    // MediaDevicesProvider, which outlives this hook.
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
  }, []);

  const start = useCallback(async () => {
    const generation = ++generationRef.current;
    // Re-arm on every start so a StrictMode remount recovers, then supersede any
    // in-flight attempt.
    disposedRef.current = false;
    setError("");

    // Media is usually already live from the pre-join device check, so only show
    // the permission phase when there is genuinely nothing to show yet.
    if (!getStream()) setPhase("requesting-media");
    const stream = await acquire();

    if (generation !== generationRef.current) return;
    if (disposedRef.current) return;
    if (!stream) {
      // Every exit from here lands on a terminal phase, so the screen can never
      // be left frozen on "Requesting camera and microphone access…".
      fail(getError() || "Could not access your camera or microphone.");
      return;
    }

    const signaling = createSignalingClient();
    signalingRef.current = signaling;
    signaling.onMessage((message) => void handleMessage(message));
    signaling.onPeerPresence((presence) => {
      setPeerPresent(presence.present);
      if (presence.name) setPeerName(presence.name);
      if (presence.present && role === "interviewer") {
        // Creating the connection triggers onnegotiationneeded, which offers.
        createPeerConnection();
        setPhase("connecting");
      }
      if (!presence.present && peerConnectionRef.current?.connectionState === "connected") {
        setPhase("peer-left");
      }
    });

    try {
      await signaling.connect(roomId, role, displayName);
      if (generation !== generationRef.current) return;
      setPhase((current) => (current === "requesting-media" ? "waiting-for-peer" : current));
    } catch (signalingError) {
      signalingRef.current = null;
      if (generation !== generationRef.current) return;
      if (signalingError instanceof SignalingUnavailableError) {
        fail(signalingError.message);
      } else {
        fail("Could not reach the signalling service. Check your connection and try again.");
      }
    }
  }, [acquire, createPeerConnection, displayName, fail, getError, getStream, handleMessage, role, roomId]);

  /** Starts the call. Re-runnable: a retry after a failure goes through here. */
  const retry = useCallback(async () => {
    await teardown();
    await start();
  }, [start, teardown]);

  // Swapping devices mid-call keeps the same senders, so no renegotiation and no
  // visible interruption beyond the new picture.
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc || !media.stream) return;
    const senders = pc.getSenders();
    void (async () => {
      try {
        const videoSender = senders.find((sender) => sender.track?.kind === "video");
        const audioSender = senders.find((sender) => sender.track?.kind === "audio");
        const videoTrack = media.stream?.getVideoTracks()[0];
        const audioTrack = media.stream?.getAudioTracks()[0];
        if (videoSender && videoTrack) await videoSender.replaceTrack(videoTrack);
        if (audioSender && audioTrack) await audioSender.replaceTrack(audioTrack);
      } catch {
        // A send we cannot replace is not fatal; the call continues on the old one.
      }
    })();
  }, [media.stream]);

  /** Tell the peer we are leaving, then release local resources. */
  const hangUp = useCallback(async () => {
    await sendSignal({ kind: "bye" });
    await teardown();
    setPhase("ended");
  }, [sendSignal, teardown]);

  /** Release resources without notifying the peer (navigation, unmount). */
  const leaveSilently = useCallback(async () => {
    await teardown();
  }, [teardown]);

  // Starting is owned here rather than by the room so the effect and its teardown
  // live together. `start` is stable (every dependency is a stable callback or a
  // primitive), so this runs once per room with no lint suppression.
  useEffect(() => {
    void start();
  }, [roomId, start]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      generationRef.current += 1;
      void signalingRef.current?.disconnect();
      signalingRef.current = null;
      const pc = peerConnectionRef.current;
      try {
        pc?.close();
      } catch {
        // already closed
      }
      peerConnectionRef.current = null;
      remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    };
  }, []);

  return {
    phase,
    error,
    remoteStream,
    peerPresent,
    peerName,
    cameraOn: media.cameraOn,
    micOn: media.micOn,
    isInterviewer: role === "interviewer",
    start,
    retry,
    hangUp,
    leaveSilently,
    toggleCamera: media.toggleCamera,
    toggleMic: media.toggleMic,
  };
}
