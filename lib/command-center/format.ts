export function formatInrCompact(amount: number): string {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const rupee = n < 0 ? "-₹" : "₹";
  if (abs >= 10000000) return `${rupee}${trim(num(abs / 10000000))}Cr`;
  if (abs >= 100000) return `${rupee}${trim(num(abs / 100000))}L`;
  if (abs >= 1000) return `${rupee}${trim(num(abs / 1000))}K`;
  return `${rupee}${Math.round(n)}`;
}

function num(v: number): number {
  return Math.round(v * 10) / 10;
}

function trim(v: number): string {
  return Number.isInteger(v) ? String(Math.round(v)) : String(v.toFixed(1));
}

export function formatPct(value: number, digits = 1): string {
  const n = Number(value) || 0;
  return `${(Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
}

export function formatCount(value: number): string {
  return String(Math.max(0, Math.round(Number(value) || 0)));
}

export function formatInrFull(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

export function trendFrom(
  current: number,
  previous: number,
  formatter: (v: number) => string = (v) => formatCount(v),
): { direction: "up" | "down" | "flat"; label: string } | undefined {
  if (previous === 0 && current === 0) {
    return { direction: "flat", label: "No change" };
  }
  if (previous === 0) {
    return { direction: "up", label: `${formatter(current)} this period` };
  }
  const delta = current - previous;
  const pct = Math.round((delta / previous) * 100);
  if (pct === 0) return { direction: "flat", label: "No change" };
  if (pct > 0) return { direction: "up", label: `+${pct}%` };
  return { direction: "down", label: `${pct}%` };
}