/**
 * One definition of "is this day a weekend?" for the whole app.
 *
 * The rules used to be copy-pasted into payroll, attendance, the export, the
 * monthly check and two calendars, each with the same flaw: as soon as a month
 * had one manual weekend (usually an assigned Saturday) the default Sunday rule
 * was switched off for that entire month. Assigning Saturday made every Sunday
 * a working day.
 *
 * The rule now is additive:
 *   1. an explicit exclusion makes the day a working day, even a Sunday;
 *   2. an explicit company weekend makes it a weekend;
 *   3. otherwise Sunday is a weekend.
 *
 * Company weekend entries and exclusions are global (`region: ""`) or regional.
 */
export type WeekendEntry = {
  date: Date | string;
  reason?: string | null;
  region?: string | null;
  kind?: string | null;
};

export type WeekendExclusion = {
  date: Date | string;
  reason?: string | null;
  region?: string | null;
};

export type WeekendContext = {
  weekendEntries?: WeekendEntry[] | null;
  weekendExclusions?: WeekendExclusion[] | null;
  /** The viewer's (or employee's) effective region label. */
  region?: string | null;
};

/** Sunday, in the same 0-6 numbering `Date#getDay()` uses. */
export const DEFAULT_WEEKEND_DAYS = [0] as const;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Turn a stored date value into the calendar day it was meant to represent.
 *
 * Two shapes exist in the database:
 *   - `new Date("2026-11-07")` / `Date.UTC(...)`, which is UTC midnight;
 *   - `new Date(2026, 10, 7)`, which is local midnight.
 * Reading both with local getters shifts the first shape in negative-offset
 * zones, and reading both with UTC getters shifts the second in positive-offset
 * zones. Each shape is detected and normalised to its own intended day.
 */
export function normalizeDateOnly(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const isUtcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    return isUtcMidnight
      ? new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  if (!text) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hasTime = /T\d{2}:\d{2}/.test(text);
    const isUtcMidnight = /T00:00:00(?:\.000)?Z?$/.test(text);
    const literal = new Date(year, month, day);
    if (Number.isNaN(literal.getTime())) return null;
    if (!hasTime || isUtcMidnight) return literal;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Local `YYYY-MM-DD` key, or `""` for an unusable value. */
export function dateKey(value: Date | string | null | undefined): string {
  const date = normalizeDateOnly(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM` for a zero-based month index. */
export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${pad(monthIndex + 1)}`;
}

/**
 * Global entries always apply. A regional entry applies to the matching region,
 * and — matching the existing WFH behaviour — to viewers with no region at all.
 */
export function regionApplies(
  entryRegion: string | null | undefined,
  viewerRegion: string | null | undefined,
): boolean {
  const entry = String(entryRegion ?? "").trim();
  const viewer = String(viewerRegion ?? "").trim();
  return !entry || !viewer || entry === viewer;
}

function applicableExclusion(
  date: Date | string,
  context: WeekendContext,
): WeekendExclusion | null {
  const key = dateKey(date);
  if (!key) return null;
  return (
    (context.weekendExclusions ?? []).find(
      (entry) =>
        regionApplies(entry?.region, context.region) &&
        dateKey(entry?.date) === key,
    ) ?? null
  );
}

/** The most descriptive applicable entry for a day (holiday reasons win). */
export function weekendEntryForDate(
  date: Date | string,
  context: WeekendContext,
): WeekendEntry | null {
  const key = dateKey(date);
  if (!key) return null;
  const matches = (context.weekendEntries ?? []).filter(
    (entry) =>
      regionApplies(entry?.region, context.region) &&
      dateKey(entry?.date) === key,
  );
  if (!matches.length) return null;
  return matches.find((entry) => String(entry?.reason ?? "").trim()) ?? matches[0];
}

export function isWeekendDate(
  date: Date | string | null | undefined,
  context: WeekendContext,
): boolean {
  const normalised = normalizeDateOnly(date);
  if (!normalised) return false;
  if (applicableExclusion(normalised, context)) return false;
  if (weekendEntryForDate(normalised, context)) return true;
  return normalised.getDay() === 0;
}

export function isWeekendKey(key: string, context: WeekendContext): boolean {
  return isWeekendDate(key, context);
}

/** Every weekend day in a month, keyed `YYYY-MM-DD`. */
export function weekendKeysForMonth(
  context: WeekendContext,
  year: number,
  monthIndex: number,
): Set<string> {
  const result = new Set<string>();
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return result;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (isWeekendDate(date, context)) result.add(dateKey(date));
  }
  return result;
}

/** Every weekend day between two dates (inclusive), keyed `YYYY-MM-DD`. */
export function weekendKeysForRange(
  context: WeekendContext,
  start: Date | string,
  end: Date | string,
): Set<string> {
  const result = new Set<string>();
  const from = normalizeDateOnly(start);
  const to = normalizeDateOnly(end);
  if (!from || !to || from.getTime() > to.getTime()) return result;

  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    if (isWeekendDate(cursor, context)) result.add(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/** True when the entry is explicitly a holiday-weekend rather than a plain one. */
export function isHolidayWeekend(entry: WeekendEntry | null | undefined): boolean {
  return String(entry?.kind ?? "").trim() === "holiday";
}

/** Human label for a weekend entry, used by the calendar day modal. */
export function weekendLabel(entry: WeekendEntry | null | undefined): string {
  if (!entry) return "Weekend";
  const reason = String(entry.reason ?? "").trim();
  if (reason) return isHolidayWeekend(entry) ? `Holiday weekend: ${reason}` : reason;
  return isHolidayWeekend(entry) ? "Holiday weekend" : "Weekend";
}
