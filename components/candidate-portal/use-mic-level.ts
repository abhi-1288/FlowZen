"use client";

import { useEffect, useRef, useState } from "react";
import { NOISE_SAMPLE_INTERVAL_MS, dbToMeterFraction, rmsToDb } from "@/lib/assessment-proctoring";

/**
 * Loudness of the live microphone, in dBFS.
 *
 * This is a *measurement*, not a recording. An AnalyserNode in
 * `getByteTimeDomainData` mode hands back the raw waveform; we take its RMS and
 * convert to decibels relative to full scale. Nothing is buffered, written to
 * disk or sent anywhere, and the AudioContext is closed as soon as the
 * assessment ends so the mic is genuinely released.
 *
 * `getFloatTimeDomainData` would give more precision, but it is not in Safari's
 * older implementations, and the byte version is accurate enough for a
 * "this room is loud" warning.
 */
export function useMicLevel(stream: MediaStream | null, active: boolean) {
  const [db, setDb] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);

  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      setDb(null);
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) {
      setDb(null);
      return;
    }

    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    let context: AudioContext;
    try {
      context = new Ctor();
    } catch {
      setSupported(false);
      return;
    }
    contextRef.current = context;

    const analyser = context.createAnalyser();
    // Small window: we want the current room, not a smoothed average, and a short
    // FFT keeps the response inside the 500ms sample period.
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    sourceRef.current = context.createMediaStreamSource(stream);
    sourceRef.current.connect(analyser);
    // Deliberately not connected to context.destination — that would echo the
    // candidate's own voice back at them through the speakers.

    const buffer = new Uint8Array(analyser.fftSize);
    bufferRef.current = buffer;

    const sample = () => {
      // getByteTimeDomainData is centred on 128, so subtract before squaring or
      // an idle mic reads as loud rather than silent.
      analyser.getByteTimeDomainData(buffer as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const centred = (buffer[i] - 128) / 128;
        sum += centred * centred;
      }
      setDb(rmsToDb(Math.sqrt(sum / buffer.length)));
    };

    sample();
    timerRef.current = window.setInterval(sample, NOISE_SAMPLE_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      try {
        sourceRef.current?.disconnect();
        analyser.disconnect();
      } catch {
        // Already torn down; nothing to do.
      }
      sourceRef.current = null;
      analyserRef.current = null;
      bufferRef.current = null;
      void context.close().catch(() => {});
      contextRef.current = null;
    };
  }, [stream, active]);

  return {
    db,
    supported,
    /** 0..1 position for a meter widget. */
    fraction: db === null ? 0 : dbToMeterFraction(db),
    /** True when the reading is above the configured limit. */
    isLoud: (thresholdDb: number) => (db === null ? false : db > thresholdDb),
  };
}
