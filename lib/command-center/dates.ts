import type { Period } from "./types";

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface Bucket {
  start: Date;
  end: Date;
  label: string;
  key: string;
}

export function buildBuckets(period: Period, now: Date = new Date()): Bucket[] {
  const buckets: Bucket[] = [];
  const dayLabel = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });

  if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({
        start: d,
        end: addDays(d, 1),
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        key: localMonthKey(d) + "-" + d.getDate(),
      });
    }
  } else if (period === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({ start: d, end: addDays(d, 1), label: dayLabel(d), key: localMonthKey(d) + "-" + d.getDate() });
    }
  } else if (period === "3m") {
    for (let i = 12; i >= 0; i--) {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7));
      const weekEnd = addDays(weekStart, 7);
      buckets.push({ start: weekStart, end: weekEnd, label: dayLabel(weekStart), key: `w${i}` });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        start: d,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        label: d.toLocaleDateString("en-US", { month: "short" }),
        key: localMonthKey(d),
      });
    }
  }
  return buckets;
}

export function bucketIndex(date: Date, buckets: Bucket[]): number {
  const t = date.getTime();
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) return i;
  }
  return -1;
}

export function countIntoBuckets(
  dates: Array<{ at: Date }>,
  buckets: Bucket[],
): number[] {
  const counts = buckets.map(() => 0);
  for (const item of dates) {
    const at = item.at instanceof Date ? item.at : new Date(item.at);
    const idx = bucketIndex(at, buckets);
    if (idx >= 0) counts[idx] += 1;
  }
  return counts;
}

export function sumIntoBuckets(
  rows: Array<{ at: Date; amount: number }>,
  buckets: Bucket[],
): number[] {
  const sums = buckets.map(() => 0);
  for (const item of rows) {
    const at = item.at instanceof Date ? item.at : new Date(item.at);
    const idx = bucketIndex(at, buckets);
    if (idx >= 0) sums[idx] += Number(item.amount) || 0;
  }
  return sums;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeDate(d: Date): Date {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return new Date();
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function overlapDays(startA: Date, endA: Date, startB: Date, endB: Date): number {
  const s = startA.getTime() > startB.getTime() ? startA : startB;
  const e = endA.getTime() < endB.getTime() ? endA : endB;
  if (e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / MS_PER_DAY) + 1;
}

export function leaveWindow(now: Date, period: "monthly" | "yearly"): { start: Date; end: Date } {
  if (period === "yearly") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}