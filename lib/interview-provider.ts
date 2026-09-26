export type VideoProvider = "flowzen" | "zoom" | "google-meet";

export const EXTERNAL_VIDEO_PROVIDERS: Exclude<VideoProvider, "flowzen">[] = ["zoom", "google-meet"];

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
  flowzen: "FlowZen video room",
  zoom: "Zoom",
  "google-meet": "Google Meet",
};

const PROVIDER_HOST_SUFFIXES: Record<Exclude<VideoProvider, "flowzen">, string[]> = {
  zoom: ["zoom.us", "zoom.com"],
  "google-meet": ["meet.google.com"],
};

export function isExternalVideoProvider(provider: unknown): provider is Exclude<VideoProvider, "flowzen"> {
  return provider === "zoom" || provider === "google-meet";
}

export function normalizeVideoProvider(value: unknown): VideoProvider | null {
  if (value === "flowzen" || value === "zoom" || value === "google-meet") return value;
  return null;
}

export function videoProviderLabel(provider: unknown): string {
  const resolved = normalizeVideoProvider(provider) ?? "flowzen";
  return VIDEO_PROVIDER_LABELS[resolved];
}

/**
 * True when the interview runs on FlowZen's built-in WebRTC room, i.e. it is
 * online, has no physical location, and is not hosted on Zoom/Google Meet.
 * Existing rows have no `videoProvider`, so a missing value means FlowZen.
 */
export function isFlowZenVideoInterview(interview: {
  meetingType?: string | null;
  location?: string | null;
  videoProvider?: string | null;
  videoRoomTokenHash?: string | null;
} | null | undefined) {
  if (!interview) return false;
  if (interview.meetingType === "in-person") return false;
  if (String(interview.location ?? "").trim()) return false;
  if (isExternalVideoProvider(interview.videoProvider)) return false;
  return Boolean(interview.videoRoomTokenHash);
}
export function isExternalVideoInterview(interview: {
  meetingType?: string | null;
  videoProvider?: string | null;
} | null | undefined) {
  if (!interview) return false;
  if (interview.meetingType === "in-person") return false;
  return isExternalVideoProvider(interview.videoProvider);
}

/**
 * Validates an externally hosted meeting link and returns a normalised https
 * URL. Only Zoom and Google Meet hosts are accepted so a stored link can never
 * point a candidate at an arbitrary destination.
 */
export function normalizeExternalMeetingLink(
  provider: VideoProvider,
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: `A meeting link is required for ${videoProviderLabel(provider)}.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a full meeting link, including https://." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Meeting links must start with https://." };
  }

  if (!isExternalVideoProvider(provider)) {
    return { ok: false, error: "FlowZen video rooms are created automatically and do not take a link." };
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = PROVIDER_HOST_SUFFIXES[provider];
  const hostAllowed = allowed.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );

  if (!hostAllowed) {
    return {
      ok: false,
      error: `That is not a valid ${videoProviderLabel(provider)} link. Expected a ${allowed
        .map((s) => `*.${s}`)
        .join(" or ")} address.`,
    };
  }

  return { ok: true, url: parsed.toString() };
}

/** Zoom and Google Meet both accept a passcode; strip it from user input. */
export function normalizeMeetingPassword(raw: unknown) {
  return String(raw ?? "").trim().slice(0, 128);
}
