"use client";

import { Loader2, Mic, MicOff, RefreshCw, Video, VideoOff } from "lucide-react";
import { useMediaDevices } from "@/components/recruitment/interview-room/media-devices";
import { VideoSurface } from "@/components/recruitment/interview-room/video-surface";

function label(device: MediaDeviceInfo, index: number) {
  return device.label || `${device.kind === "videoinput" ? "Camera" : "Microphone"} ${index + 1}`;
}

/**
 * The pre-join device check: asks for camera and microphone access, shows a live
 * preview, and lets the user pick which devices the call will use.
 *
 * This is where permission is meant to be granted, because a prompt is far less
 * alarming when it is clearly attached to a "check my camera" button than when it
 * appears the instant a call begins. Anything granted here is already live when
 * the call starts, so joining does not re-prompt.
 */
export function DeviceCheckPanel({ className }: { className?: string }) {
  const media = useMediaDevices();
  const { status, error, stream, cameras, microphones, cameraOn, micOn } = media;

  if (status === "idle") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void media.acquire()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <Video size={16} /> Check camera &amp; microphone
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Your browser will ask for permission. You can pick your devices before joining.
        </p>
      </div>
    );
  }

  if (status === "requesting") {
    return (
      <div className={className}>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <Loader2 size={16} className="animate-spin" /> Requesting camera and microphone access…
        </div>
      </div>
    );
  }

  if (status === "error" || !stream) {
    return (
      <div className={className}>
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs leading-5 text-rose-200">
          {error || "Could not access your camera or microphone."}
        </p>
        <button
          type="button"
          onClick={() => void media.retry()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <VideoSurface stream={stream} muted mirror label="You" className="aspect-video w-full" />

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Camera</span>
          <select
            value={media.cameraId}
            onChange={(event) => media.setCameraId(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-400"
          >
            <option value="">Default (browser choice)</option>
            {cameras.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {label(device, index)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Microphone</span>
          <select
            value={media.microphoneId}
            onChange={(event) => media.setMicrophoneId(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-400"
          >
            <option value="">Default (browser choice)</option>
            {microphones.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {label(device, index)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={media.toggleMic}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${
            micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {micOn ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <button
          type="button"
          onClick={media.toggleCamera}
          aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
          title={cameraOn ? "Turn camera off" : "Turn camera on"}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${
            cameraOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
        <button
          type="button"
          onClick={() => void media.retry()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
        >
          <RefreshCw size={13} /> Run the check again
        </button>
      </div>
    </div>
  );
}
