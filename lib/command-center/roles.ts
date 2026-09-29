import type { Variant } from "./types";

export const VARIANT_LABELS: Record<Variant, string> = {
  admin: "Company-wide overview",
  hr: "People & Recruitment",
  finance: "Finance",
  projects: "Projects",
  it: "Infrastructure",
  security: "Access & Security",
  personal: "My workspaces",
};

/**
 * The badge above the dashboard.
 *
 * Every leader role is now regional, so a bare "Company-wide overview" would be
 * a lie for everyone except the owner looking at the global rollup. The region
 * is named instead when there is one; passing `null` keeps the static label.
 */
export function labelFor(variant: Variant, regionLabel?: string | null): string {
  const region = String(regionLabel ?? "").trim();
  if (!region) return VARIANT_LABELS[variant];
  return `${region} overview`;
}

export function resolveVariant(role: string): Variant {
  switch (role) {
    case "admin":
      return "admin";
    case "human-resource":
      return "hr";
    case "finance":
      return "finance";
    case "project-manager":
    case "qa-tester":
      return "projects";
    case "it-admin":
    case "it-administration":
      return "it";
    case "security":
      return "security";
    default:
      return "personal";
  }
}

const ADMIN_LIKE: Variant[] = ["admin"];
const HR_IT: Variant[] = ["admin", "hr"];
const LEADERSHIP: Variant[] = ["admin", "hr", "finance"];
const PROJECT_LIKE: Variant[] = ["admin", "projects"];
const FINANCE_LIKE: Variant[] = ["admin", "finance"];
const ALL_COMPANY: Variant[] = ["admin", "hr", "finance", "projects", "it", "security"];

export function matchVariant(variant: Variant, allowed: Variant[]): boolean {
  return allowed.includes(variant);
}

export { ADMIN_LIKE, HR_IT, LEADERSHIP, PROJECT_LIKE, FINANCE_LIKE, ALL_COMPANY };

export function isCompanyVariant(variant: Variant): boolean {
  return variant !== "personal";
}