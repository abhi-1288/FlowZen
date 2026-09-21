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