import { createHash, randomBytes } from "crypto";
import { interviewSlug } from "@/lib/interview-slug";

export { interviewSlug } from "@/lib/interview-slug";

const INVITE_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export function getInterviewInviteExpiry(scheduledAt?: string | Date) {
  const scheduled = scheduledAt ? new Date(scheduledAt).getTime() : Number.NaN;
  const base = Number.isFinite(scheduled) ? Math.max(Date.now(), scheduled) : Date.now();
  return new Date(base + INVITE_WINDOW_MS);
}

export function createInterviewRoom(
  origin: string,
  jobTitle: string,
  candidateName: string,
  scheduledAt?: string | Date
) {
  const token = randomBytes(24).toString("base64url");
  const path = `/recruitment/interview/${interviewSlug(jobTitle)}/${interviewSlug(candidateName)}`;
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: getInterviewInviteExpiry(scheduledAt),
    meetingLink: `${origin}${path}?access=${encodeURIComponent(token)}`,
  };
}
