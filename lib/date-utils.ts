/**
 * Job date/time contract.
 *
 * Everything in here treats a job's `autoCloseDate` / `assessmentDate` as a bare
 * wall clock: the value the HR user typed in the form is the value that is
 * stored, and the value that is shown back to them. No timezone conversion is
 * applied on the way in or on the way out.
 *
 * The mechanics that make that work: writers pin the entered wall clock to UTC
 * with `utcWallClock` (an offset-less ISO string is parsed in the *server's*
 * timezone, which on an IST host silently shifts it by 5h30m), and readers use
 * `getUTC*` / `timeZone: "UTC"`. Both halves have to agree or the time drifts.
 *
 * `lib/assessment-timing.ts` builds its day windows on UTC boundaries, so it
 * already assumes this contract.
 */

export function fmtJobDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} ${time}`;
}

export function dateInputValue(value: string): string {
  const d = new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function timeInputValue(value: string): string {
  const d = new Date(value);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Turn the `<input type="date">` / `<input type="time">` pair into the string the
 * API stores. `time` comes back as "HH:mm" and may be empty, in which case
 * `fallback` supplies the wall clock (a closing date defaults to end of day, an
 * assessment start defaults to midnight).
 *
 * Returns null when no date was picked so callers can send an explicit null
 * instead of an empty string the API would have to special-case.
 */
export function utcWallClock(date: string, time: string, fallback: string): string | null {
  if (!date) return null;
  return `${date}T${time || fallback}:00Z`;
}

/** Midnight UTC of the day the given instant falls on, in ms. */
export function startOfUtcDayMs(reference: number | Date): number {
  const ms = reference instanceof Date ? reference.getTime() : reference;
  return Math.floor(ms / 86_400_000) * 86_400_000;
}

/**
 * The "now" to compare job wall clocks against. The stored values are wall
 * clocks rather than real instants, so the comparison has to happen in the same
 * frame — this is the current wall clock read as UTC.
 */
export function utcWallClockNow(now: Date = new Date()): number {
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );
}
