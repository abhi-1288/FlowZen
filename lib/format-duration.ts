export function formatJobDuration(
  durationMonths: number | null | undefined,
  durationDays: number | null | undefined,
): string {
  const m = Number(durationMonths) || 0;
  const d = Number(durationDays) || 0;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  if (d > 0) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  return parts.join(" ");
}
