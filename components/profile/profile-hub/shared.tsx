import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AnyRecord = Record<string, unknown>;

// ── Reusable Card ──

export function Card({
  children,
  hover = true,
  padding = "md",
  className = "",
}: {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md";
  className?: string;
}) {
  const pad = padding === "sm" ? "p-4" : "p-6";
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white ${pad} shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] ${hover ? "transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

// ── Section Header with accent bar ──

const accentMap: Record<string, string> = {
  indigo: "border-indigo-500",
  emerald: "border-emerald-500",
  rose: "border-rose-500",
  amber: "border-amber-500",
  sky: "border-sky-500",
  violet: "border-violet-500",
  slate: "border-slate-400",
  cyan: "border-cyan-500",
  teal: "border-teal-500",
};

export function SectionHeader({
  title,
  description,
  accent = "slate",
}: {
  title: string;
  description?: string;
  accent?: string;
}) {
  const border = accentMap[accent] ?? "border-slate-400";
  return (
    <div className={`mb-5 border-l-4 ${border} pl-4`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

// ── Empty State ──

export function EmptyState({
  message = "No data yet.",
  icon,
}: {
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon ? <span className="text-slate-300">{icon}</span> : null}
      <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}

// ── Unified Action Button ──

const buttonVariants: Record<string, string> = {
  primary: "bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "border border-rose-200 text-rose-600 hover:bg-rose-50",
  ghost: "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
};

export function ActionButton({
  variant = "secondary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "approve" | "danger" | "ghost";
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant] ?? buttonVariants.secondary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50/80">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="text-right text-sm font-medium capitalize text-slate-900">
        {value ?? <span className="text-slate-300">Not set</span>}
      </dd>
    </div>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: string;
  variant?: "default" | "admin" | "hr" | "finance" | "success" | "warning";
}) {
  const styles: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    admin: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white",
    hr: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white",
    finance: "bg-gradient-to-r from-amber-500 to-orange-600 text-white",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide shadow-sm ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function displayNested(value: unknown, key: string, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return record[key] ? String(record[key]) : fallback;
}

export function formatRole(role: string) {
  const labels: Record<string, string> = {
    "human-resource": "Human Resource",
    "project-manager": "Project Manager",
    "qa-tester": "Q-A Tester",
    finance: "Finance",
    employee: "Employee",
    admin: "Admin",
    others: "Others",
  };
  return labels[role] ?? role;
}

export function formatRoleWithCustom(role: string, customRole: unknown) {
  const baseRole = formatRole(role);
  const label = String(customRole ?? "").trim();
  if (role === "others" && label) return `${baseRole} | ${label}`;
  return baseRole;
}

export function AvatarBadge({
  avatarUrl,
  name,
  size,
  showRing,
}: {
  avatarUrl: string;
  name: string;
  size: "md" | "lg";
  showRing?: boolean;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const base = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";
  const ring = showRing ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950" : "";

  if (avatarUrl) {
    return (
      <img
        alt={`${name} avatar`}
        className={`${base} rounded-full border border-slate-200 object-cover ${ring}`}
        src={avatarUrl}
      />
    );
  }

  return (
    <div
      className={`${base} grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-semibold text-white shadow-sm ${ring}`}
    >
      {initials}
    </div>
  );
}

export function HistoryCard({
  title,
  rows,
  hint,
}: {
  title: string;
  rows: { label: string; value: string }[];
  hint: string;
}) {
  return (
    <Card>
      <SectionHeader title={title} description={hint || undefined} accent="slate" />
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <EmptyState message="No history yet." />
        ) : (
          rows.map((row, index) => (
            <div
              className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              key={`${row.label}-${index}`}
            >
              <span className="text-slate-600">{row.label}</span>
              <span className="font-medium text-slate-900">{row.value}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function toEmployeeHistoryRows(insights: AnyRecord | null) {
  const employee = insights?.employee as AnyRecord | undefined;
  if (!employee) return [];
  const activeTeams = Number(employee.activeTeams ?? 0);
  const removedCount = Number(employee.removedCount ?? 0);
  const switchedCount = Number(employee.switchedCount ?? 0);
  return [
    { label: "Active teams", value: `${activeTeams}/2` },
    { label: "Removed memberships", value: String(removedCount) },
    { label: "Switched teams", value: String(switchedCount) },
  ];
}

export function toManagerHistoryRows(insights: AnyRecord | null) {
  const manager = insights?.manager as AnyRecord | undefined;
  if (!manager) return [];
  const teams = Array.isArray(manager.teams)
    ? (manager.teams as AnyRecord[])
    : [];
  const rows = [
    { label: "Total teams", value: String(Number(manager.totalTeams ?? 0)) },
  ];
  teams.forEach((team) => {
    rows.push({
      label: `${String(team.name ?? "Team")} employees`,
      value: String(Number(team.employeeCount ?? 0)),
    });
  });
  return rows;
}

export function toAdminHistoryRows(insights: AnyRecord | null) {
  const admin = insights?.admin as AnyRecord | undefined;
  if (!admin) return [];
  const teams = Array.isArray(admin.teams) ? (admin.teams as AnyRecord[]) : [];
  const rows = [
    { label: "Total teams", value: String(Number(admin.totalTeams ?? 0)) },
  ];
  teams.forEach((team) => {
    rows.push({
      label: `${String(team.name ?? "Team")} (${String((team.owner as AnyRecord | undefined)?.name ?? "N/A")})`,
      value: `${Number(team.employeeCount ?? 0)} employees`,
    });
  });
  return rows;
}
