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

/**
 * Owns the camera and microphone for an interview.
 *
 * This deliberately sits *above* both the pre-join device check and the call
 * itself, for two reasons:
 *
 *  1. A device chosen on the pre-join screen is the same device the call uses, so
 *     the user is never prompted or handed a different camera than the one they
 *     just approved.
 *  2. The acquisition is memoised in a ref that the unmount cleanup does *not*
 *     clear. React's StrictMode double-invokes effects on mount (mount ->
 *     cleanup -> mount), and the previous implementation latched a "closed" flag
 *     in that window: the second start() bailed out, and the first
 *     getUserMedia() result was stopped on arrival. The camera light came on and
 *     went straight back off with no preview and no error. Keeping the promise
 *     lets the second start() adopt the in-flight request instead.
 *
 * The provider does not remount when the call room mounts, so that churn all
 * happens once at initial mount, before the user has clicked anything.
 */

export type MediaStatus = "idle" | "requesting" | "ready" | "error";

export type MediaDevicesValue = {
  /** The live local stream, or null before permission is granted. */
  stream: MediaStream | null;
  status: MediaStatus;
  error: string;
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  /** Empty string means "let the browser pick the default device". */
  cameraId: string;
  microphoneId: string;
  cameraOn: boolean;
  micOn: boolean;
  setCameraId: (id: string) => void;
  setMicrophoneId: (id: string) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  /**
   * Idempotent. Resolves with the live stream, or null when the request failed or
   * the provider was disposed while the browser was still opening the hardware.
   * Repeated calls for the same device selection share one getUserMedia.
   */
  acquire: () => Promise<MediaStream | null>;
  /** Drops the memoised request and asks again. */
  retry: () => Promise<MediaStream | null>;
  /** Stops the hardware. The provider can re-acquire afterwards; see release(). */
  release: () => void;
  /** Synchronous readers for consumers that need the stream after an await. */
  getStream: () => MediaStream | null;
  getError: () => string;
};

const MediaDevicesContext = createContext<MediaDevicesValue | null>(null);

export function useMediaDevices(): MediaDevicesValue {
  const value = useContext(MediaDevicesContext);
  if (!value) {
    throw new Error("useMediaDevices must be used inside a MediaDevicesProvider.");
  }
  return value;
}

/** Why the hardware is unavailable, in terms the user can act on. */
function unavailableReason(): string {
  if (typeof window === "undefined") return "Camera and microphone are not available yet.";
  if (!window.isSecureContext) {
    return "Camera and microphone access needs a secure connection. Open this page over HTTPS (or on localhost) and try again.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot open the camera or microphone. Try a recent version of Chrome, Edge, Firefox or Safari.";
  }
  return "";
}

function describeMediaError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Could not access your camera or microphone.";
  }
  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera or microphone access was blocked. Allow access in your browser, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "No camera or microphone was found. Connect a device, choose it below, and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera or microphone is already in use by another application. Close it there and try again.";
    default:
      return `Could not access your camera or microphone (${error.name}).`;
  }
}

function buildConstraints(cameraId: string, microphoneId: string): MediaStreamConstraints {
  return {
    video: {
      // Only pin a device the user explicitly chose; otherwise let the browser
      // decide rather than failing on a deviceId that has since gone away.
      ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
      width: { ideal: 1280 },
      height: { ideal: 720 },
      // `ideal`, not a bare string: a bare value is an exact constraint and
      // throws OverconstrainedError on devices exposing only a rear camera.
      facingMode: { ideal: "user" },
    },
    audio: {
      ...(microphoneId ? { deviceId: { exact: microphoneId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** A stream whose tracks have all ended cannot be shown or sent. */
function isLive(stream: MediaStream | null): boolean {
  if (!stream) return false;
  return stream.active || stream.getTracks().some((track) => track.readyState === "live");
}

export function MediaDevicesProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<MediaStatus>("idle");
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const errorRef = useRef("");
  // Keyed on the device selection so switching devices re-requests, while a
  // StrictMode remount with the same selection reuses the existing request.
  const acquireRef = useRef<{ key: string; promise: Promise<MediaStream> } | null>(null);
  const disposedRef = useRef(false);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCameras(all.filter((device) => device.kind === "videoinput"));
      setMicrophones(all.filter((device) => device.kind === "audioinput"));
    } catch {
      // Enumeration is a convenience; the call works without the picker.
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    void refreshDevices();
    if (!navigator.mediaDevices?.addEventListener) return;
    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      // Release the hardware, but keep the memoised request: a StrictMode remount
      // reuses it, while a genuine remount gets a fresh hook instance anyway.
      disposedRef.current = true;
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [refreshDevices]);

  /** Waits for a request and installs its stream, or records why it failed. */
  const settle = useCallback(
    async (key: string, promise: Promise<MediaStream>): Promise<MediaStream | null> => {
      let incoming: MediaStream;
      try {
        incoming = await promise;
      } catch (requestError) {
        if (acquireRef.current?.promise === promise) acquireRef.current = null;
        if (disposedRef.current) return null;
        const message = describeMediaError(requestError);
        errorRef.current = message;
        setError(message);
        setStatus("error");
        return null;
      }

      if (disposedRef.current) {
        // The provider went away while the browser was still opening the camera.
        // Release it instead of handing dead tracks to the UI.
        stopTracks(incoming);
        return null;
      }
      if (acquireRef.current?.key !== key) {
        // A different device was selected while this request was in flight.
        stopTracks(incoming);
        return streamRef.current;
      }

      const previous = streamRef.current;
      if (previous && previous !== incoming) stopTracks(previous);
      streamRef.current = incoming;
      setStream(incoming);
      setCameraOn(incoming.getVideoTracks().some((track) => track.enabled));
      setMicOn(incoming.getAudioTracks().some((track) => track.enabled));
      errorRef.current = "";
      setError("");
      setStatus("ready");
      // Labels are only populated once permission has been granted.
      void refreshDevices();
      return incoming;
    },
    [refreshDevices]
  );

  const releaseStream = useCallback(() => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  const acquire = useCallback(async (): Promise<MediaStream | null> => {
    if (disposedRef.current) return null;

    const unavailable = unavailableReason();
    if (unavailable) {
      errorRef.current = unavailable;
      setError(unavailable);
      setStatus("error");
      return null;
    }

    const key = `${cameraId}|${microphoneId}`;
    const existing = acquireRef.current;
    if (existing && existing.key === key) {
      // Already requested for this selection. Adopt the in-flight or settled
      // result rather than prompting again — this is what keeps StrictMode to a
      // single getUserMedia call.
      if (isLive(streamRef.current)) return streamRef.current;
      const settled = await settle(existing.key, existing.promise);
      if (settled) return settled;
      // The memoised request failed or was released; fall through and re-ask.
      acquireRef.current = null;
    }

    releaseStream();
    setStatus("requesting");
    setError("");
    errorRef.current = "";

    const promise = navigator.mediaDevices.getUserMedia(buildConstraints(cameraId, microphoneId));
    acquireRef.current = { key, promise };
    return settle(key, promise);
  }, [cameraId, microphoneId, releaseStream, settle]);

  const retry = useCallback(async (): Promise<MediaStream | null> => {
    acquireRef.current = null;
    releaseStream();
    setStatus("idle");
    setError("");
    errorRef.current = "";
    return acquire();
  }, [acquire, releaseStream]);

  /**
   * Stops the hardware but leaves the provider able to open it again.
   *
   * This deliberately does not latch `disposedRef` (that belongs to the unmount
   * cleanup) and it drops the memoised request: keeping a promise that has
   * already resolved to a stopped stream would let the next acquire() re-install
   * dead tracks, because `settle` cannot tell a settled-dead stream from a live
   * one. The status resets so the pre-join panel falls back to its "check camera"
   * prompt instead of claiming a stream it no longer has.
   */
  const release = useCallback(() => {
    acquireRef.current = null;
    releaseStream();
    setStatus("idle");
    setError("");
    errorRef.current = "";
  }, [releaseStream]);

  const toggleCamera = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }, []);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  // Stable readers so consumers can read the stream/error after an await without
  // depending on a context object that changes identity every render.
  const getStream = useCallback(() => streamRef.current, []);
  const getError = useCallback(() => errorRef.current, []);

  const value = useMemo<MediaDevicesValue>(
    () => ({
      stream,
      status,
      error,
      cameras,
      microphones,
      cameraId,
      microphoneId,
      cameraOn,
      micOn,
      setCameraId,
      setMicrophoneId,
      toggleCamera,
      toggleMic,
      acquire,
      retry,
      release,
      getStream,
      getError,
    }),
    [
      stream,
      status,
      error,
      cameras,
      microphones,
      cameraId,
      microphoneId,
      cameraOn,
      micOn,
      toggleCamera,
      toggleMic,
      acquire,
      retry,
      release,
      getStream,
      getError,
    ]
  );

  return <MediaDevicesContext.Provider value={value}>{children}</MediaDevicesContext.Provider>;
}
