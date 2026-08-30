export const DEFAULT_ACCENT = "#2563eb";

export function salarySuffix(salaryType?: string): string {
  switch (salaryType) {
    case "per-month":
      return "/mo";
    case "per-day":
      return "/day";
    case "per-hour":
      return "/hr";
    case "per-annum":
      return "/yr";
    default:
      return "/yr";
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  if (Number.isNaN(num) || h.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}