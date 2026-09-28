"use client";

import { Mic, MicOff, VideoOff } from "lucide-react";
import { VideoSurface } from "@/components/recruitment/interview-room/video-surface";
import { dbToMeterFraction } from "@/lib/assessment-proctoring";

/**
 * The candidate's own camera, pinned to the bottom-right of the viewport.
 *
 * `fixed` rather than `absolute` so it tracks the viewport instead of the scroll
 * container — the exam is a long list of questions, and a tile that scrolled out
 * of view would be pointless.
 *
 * There is deliberately no toggle. The camera is muted and shown only to the
 * person sitting the exam, is never recorded, and never leaves the browser. A
 * "hide my camera" button would be privacy theatre with no integrity benefit.
 */
export function SelfieTile({
  stream,
  micDb,
  requireMic,
  micLevel,
}: {
  stream: MediaStream | null;
  micDb: number | null;
  requireMic: boolean;
  micLevel?: number;
}) {
  const micOk = !requireMic || Boolean(stream?.getAudioTracks().some((t) => t.enabled));
  const fraction = micLevel ?? dbToMeterFraction(micDb ?? -100);
  const loud = requireMic && micDb !== null && micDb > -35;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-40 sm:w-48">
      <VideoSurface
        stream={stream}
        muted
        mirror
        className="aspect-video w-full border border-slate-700/60 shadow-2xl"
      />
      <div className="mt-1 flex items-center gap-1.5 rounded-md bg-slate-950/80 px-2 py-1 backdrop-blur">
        {micOk ? (
          <>
            <Mic size={11} className={loud ? "text-rose-400" : "text-emerald-400"} />
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${
                  loud ? "bg-rose-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <MicOff size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-400">No mic</span>
          </>
        )}
      </div>
      {!stream && (
        <div className="mt-1 flex items-center gap-1.5 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] text-amber-300 backdrop-blur">
          <VideoOff size={11} /> Camera stopped
        </div>
      )}
    </div>
  );
}
