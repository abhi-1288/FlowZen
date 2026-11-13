/**
 * Attendance day normalization.
 *
 * `Attendance.date` is a calendar-day marker, not a timestamp. It is stored as
 * the UTC instant of midnight for the *company-local* calendar date that
 * contains the event. Deriving the day from the server's local timezone (the
 * previous `new Date(); date.setHours(0, 0, 0, 0)` approach) made attendance
 * disagree with EOD/EOW compactions whenever the server ran in a different zone
 * (e.g. UTC on Vercel) than the company (e.g. Asia/Kolkata).
 *
 * Because the marker is anchored to UTC midnight of the company-local date,
 * existing range queries (`date: { $gte, $lte }`) keep working: the marker for
 * a day always falls inside that day's window for any zone with a non-negative
 * UTC offset, which covers the deployments this app targets.
 *
 * Pure module — no Mongoose import, so it can be unit-tested with `node --test`.
 */
import { dateKeyInTimeZone } from "./compaction.ts";

/** UTC-midnight marker for the company-local calendar day containing `at`. */
export function attendanceDay(
  at: Date | number | string = new Date(),
  timeZone?: string | null,
): Date {
  const key = dateKeyInTimeZone(at, timeZone);
  return new Date(`${key}T00:00:00.000Z`);
}

/** `YYYY-MM-DD` key for the company-local calendar day containing `at`. */
export function attendanceDayKey(
  at: Date | number | string = new Date(),
  timeZone?: string | null,
): string {
  return dateKeyInTimeZone(at, timeZone);
}

/** True when both instants fall on the same company-local calendar day. */
export function sameAttendanceDay(
  a: Date | number | string,
  b: Date | number | string,
  timeZone?: string | null,
): boolean {
  return attendanceDayKey(a, timeZone) === attendanceDayKey(b, timeZone);
}
