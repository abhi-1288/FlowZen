/**
 * Job date/time contract.
 *
 * Everything in here treats a job's `autoCloseDate` / `assessmentDate` (and the
 * mock test's `opensAt` / `closesAt`) as a true instant that the HR user meant
 * in Asia/Kolkata time: the wall clock they typed in the form is interpreted in
 * IST, stored as an absolute instant, and shown back to them in IST.
 *
 * The mechanics that make that work:
 *   - writers pin the entered wall clock to `+05:30` with `wallClockToIso`, so
 *     the stored value is a real instant regardless of the browser's or the
 *     server's timezone;
 *   - readers format with `timeZone: "Asia/Kolkata"` (or the viewer's zone on
 *     the client) and compare against plain `Date.now()`;
 *   - day math (`startOfKolkataDayMs`) lands on IST midnights, so "the day the
 *     assessment falls on" is the candidate's day, not the UTC day.
 *
 * Countdowns and phase gates are therefore plain millisecond arithmetic on
 * instants — they can never disagree with a rendered label the way the old
 * wall-clock frame could.
 */

/** IST has no DST; the offset is a constant. */
export const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function fmtJobDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} ${time}`;
}

/** The `<input type="date">` value for an instant, read as an IST wall clock. */
export function dateInputValue(value: string): string {
  const k = new Date(new Date(value).getTime() + KOLKATA_OFFSET_MS);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, "0");
  const day = String(k.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The `<input type="time">` value for an instant, read as an IST wall clock. */
export function timeInputValue(value: string): string {
  const k = new Date(new Date(value).getTime() + KOLKATA_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Turn the `<input type="date">` / `<input type="time">` pair into the ISO
 * instant the API stores. The pair holds an IST wall clock — what the HR user
 * typed — so it is pinned to `+05:30` rather than parsed in the host's zone.
 * `time` comes back as "HH:mm" and may be empty, in which case `fallback`
 * supplies the wall clock (a closing date defaults to end of day, an assessment
 * start defaults to midnight); either form ("HH:mm" or "HH:mm:ss") is accepted.
 *
 * Returns null when no date was picked, or when the pair does not parse, so
 * callers can send an explicit null instead of an empty string the API would
 * have to special-case.
 */
export function wallClockToIso(date: string, time: string, fallback: string): string | null {
  if (!date) return null;
  const clock = (time || fallback).trim();
  const parsed = new Date(`${date}T${clock.length === 5 ? `${clock}:00` : clock}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Midnight IST of the day the given instant falls on, in ms. */
export function startOfKolkataDayMs(reference: number | Date): number {
  const ms = reference instanceof Date ? reference.getTime() : reference;
  return Math.floor((ms + KOLKATA_OFFSET_MS) / 86_400_000) * 86_400_000 - KOLKATA_OFFSET_MS;
}
