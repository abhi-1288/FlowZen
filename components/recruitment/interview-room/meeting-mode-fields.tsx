"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import {
  EXTERNAL_VIDEO_PROVIDERS,
  VIDEO_PROVIDER_LABELS,
  videoProviderLabel,
  type VideoProvider,
} from "@/lib/interview-provider";

export type MeetingMode = "flowzen" | "external" | "in-person";

export type FlowZenQuotaState = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
  resetsAt: string;
} | null;

export function useFlowZenQuota() {
  const [quota, setQuota] = useState<FlowZenQuotaState>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ used: number; limit: number; remaining: number; exhausted: boolean; resetsAt: string }>(
      "/api/recruitment/interview-quota",
      undefined,
      { toast: false }
    )
      .then((res) => {
        if (active) setQuota(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return quota;
}

function QuotaNotice({ quota, tone }: { quota: FlowZenQuotaState; tone: "warning" | "info" }) {
  if (!quota) return null;
  const resetsOn = new Date(quota.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

  if (quota.exhausted) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="flex items-start gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            You have used all {quota.limit} FlowZen video rooms this month. Your allowance resets on {resetsOn}.
          </span>
        </p>
        <p className="mt-1.5 pl-[22px] text-xs text-amber-700 dark:text-amber-300">
          Choose Zoom, Google Meet or an in-person interview for this round, or schedule it after {resetsOn}.
        </p>
      </div>
    );
  }

  if (tone === "info") {
    return (
      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          {quota.remaining} of {quota.limit} FlowZen video rooms remaining this month. Allowance resets on {resetsOn}.
        </span>
      </p>
    );
  }

  return null;
}

/**
 * Meeting type selector shared by both scheduling modals. Owns the
 * FlowZen / Zoom / Google Meet / in-person choice, the external link and
 * passcode inputs, and the monthly FlowZen room notice.
 */
export function MeetingModeFields({
  mode,
  onModeChange,
  provider,
  onProviderChange,
  meetingLink,
  onMeetingLinkChange,
  meetingPassword,
  onMeetingPasswordChange,
  quota,
  locationFields,
  neu = true,
}: {
  mode: MeetingMode;
  onModeChange: (mode: MeetingMode) => void;
  provider: Exclude<VideoProvider, "flowzen">;
  onProviderChange: (provider: Exclude<VideoProvider, "flowzen">) => void;
  meetingLink: string;
  onMeetingLinkChange: (value: string) => void;
  meetingPassword: string;
  onMeetingPasswordChange: (value: string) => void;
  quota: FlowZenQuotaState;
  locationFields?: React.ReactNode;
  neu?: boolean;
}) {
  const inputClass = neu
    ? "neu-inset w-full rounded-lg px-3 py-2.5 text-sm"
    : "w-full rounded-lg border border-[var(--c-border-light)] bg-transparent px-3 py-2.5 text-sm";

  const flowzenBlocked = Boolean(quota?.exhausted);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">Meeting Type</span>
        <select
          name="meetingType"
          value={mode}
          onChange={(event) => onModeChange(event.target.value as MeetingMode)}
          className={inputClass}
        >
          <option value="flowzen">Online — FlowZen video room</option>
          <option value="external">Online — Zoom or Google Meet</option>
          <option value="in-person">In-person (location)</option>
        </select>
      </label>

      <input type="hidden" name="videoProvider" value={mode === "external" ? provider : "flowzen"} />
      {mode === "external" ? (
        <>
          <input type="hidden" name="meetingLink" value={meetingLink} />
          <input type="hidden" name="meetingPassword" value={meetingPassword} />
        </>
      ) : null}

      {mode === "flowzen" ? (
        <>
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-slate-600 dark:text-zinc-400">
            A private peer-to-peer video room is created automatically. Joining unlocks five minutes before the
            scheduled time and only the candidate and assigned interviewer can enter.
          </p>
          <QuotaNotice quota={quota} tone={flowzenBlocked ? "warning" : "info"} />
        </>
      ) : mode === "external" ? (
        <div className="space-y-3 rounded-lg border border-[var(--c-border-light)] p-3">
          <div className="flex flex-wrap gap-2">
            {EXTERNAL_VIDEO_PROVIDERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onProviderChange(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  provider === option
                    ? "bg-indigo-600 text-white"
                    : "bg-muted text-slate-600 hover:bg-surface-hover dark:text-zinc-300"
                }`}
              >
                {VIDEO_PROVIDER_LABELS[option]}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              {videoProviderLabel(provider)} meeting link
            </span>
            <input
              type="url"
              inputMode="url"
              value={meetingLink}
              onChange={(event) => onMeetingLinkChange(event.target.value)}
              placeholder={
                provider === "zoom"
                  ? "https://us06web.zoom.us/j/123456789"
                  : "https://meet.google.com/abc-defg-hij"
              }
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
              Must be a valid {provider === "zoom" ? "zoom.us" : "meet.google.com"} address starting with https://
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Passcode <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="text"
              value={meetingPassword}
              onChange={(event) => onMeetingPasswordChange(event.target.value)}
              placeholder={provider === "zoom" ? "e.g. 482913" : "Leave blank if none"}
              autoComplete="off"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
              Shared with the candidate and the interviewer by email.
            </span>
          </label>
        </div>
      ) : (
        locationFields
      )}
    </div>
  );
}
