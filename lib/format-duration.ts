export function formatJobDuration(
  durationMonths: number | null | undefined,
  durationDays: number | null | undefined,
  durationHours?: number | null | undefined,
  durationYears?: number | null | undefined,
): string {
  const y = Number(durationYears) || 0;
  const m = Number(durationMonths) || 0;
  const d = Number(durationDays) || 0;
  const h = Number(durationHours) || 0;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  if (d > 0) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h > 0) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  return parts.join(" ");
}
