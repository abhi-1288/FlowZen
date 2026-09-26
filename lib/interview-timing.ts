export const INTERVIEW_JOIN_EARLY_MS = 5 * 60 * 1000;

/**
 * Statuses a participant may still join a FlowZen video room in.
 *
 * Submitting feedback is what moves an interview to "completed"
 * (app/api/recruitment/interviews/[id]/feedback/route.ts), so "completed" is the
 * natural cutoff for the rejoin option: once the interviewer has recorded their
 * feedback the candidate no longer needs to get back in. "cancelled" never
 * applies.
 *
 * Note that "in-progress" belongs here. It is set the moment either side first
 * joins, so excluding it makes the rejoin option disappear from the candidate
 * portal at the exact moment it becomes useful.
 */
export const INTERVIEW_JOINABLE_STATUSES = ["scheduled", "rescheduled", "in-progress"] as const;

export function isInterviewJoinable(status: string | null | undefined): boolean {
  return (INTERVIEW_JOINABLE_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export function getInterviewJoinOpensAt(scheduledAt: string | Date) {
  return new Date(new Date(scheduledAt).getTime() - INTERVIEW_JOIN_EARLY_MS);
}

export function isInterviewJoinWindowOpen(scheduledAt: string | Date, now = Date.now()) {
  const scheduled = new Date(scheduledAt).getTime();
  return Number.isFinite(scheduled) && now >= scheduled - INTERVIEW_JOIN_EARLY_MS;
}

export function getInterviewJoinCountdownMs(scheduledAt: string | Date, now = Date.now()) {
  return Math.max(0, getInterviewJoinOpensAt(scheduledAt).getTime() - now);
}

export function formatInterviewCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
