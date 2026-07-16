import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AnyRecord = Record<string, unknown>;

// ── Card ──

export function Card({
  children,
  hover = false,
  padding = "md",
  className = "",
}: {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "none";
  className?: string;
}) {
  const pad = padding === "sm" ? "p-3" : padding === "md" ? "p-5" : "";
  return (
    <section
      className={`rounded-card border border-border bg-surface ${pad} ${
        hover ? "transition-default hover:bg-surface-secondary hover:shadow-card-hover" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

// ── Section Header ──

export function SectionHeader({
  title,
  description,
  accent,
  action,
}: {
  title: ReactNode;
  description?: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-title text-ink">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-body text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      {icon ? <span className="text-neutral-300">{icon}</span> : null}
      <p className="text-body text-muted">{message}</p>
    </div>
  );
}

// ── Action Button ──

const buttonVariants: Record<string, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950",
  secondary: "border border-border bg-surface text-ink hover:bg-surface-secondary active:bg-slate-100",
  approve: "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
  danger: "border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100",
  ghost: "text-muted hover:text-ink hover:bg-surface-secondary",
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant] ?? buttonVariants.secondary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Row ──

export function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-btn px-2.5 py-1.5 transition-default hover:bg-surface-secondary">
      <dt className="text-overline uppercase text-muted">{label}</dt>
      <dd className="text-right text-body font-medium text-ink">
        {value ?? <span className="text-neutral-300">Not set</span>}
      </dd>
    </div>
  );
}

// ── Badge ──

export function Badge({
  children,
  variant = "default",
}: {
  children: string;
  variant?: "default" | "admin" | "hr" | "finance" | "success" | "warning";
}) {
  const styles: Record<string, string> = {
    default: "bg-neutral-100 text-neutral-700 dark:bg-zinc-700 dark:text-zinc-300",
    admin: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    hr: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    finance: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-badge px-2 py-0.5 text-caption font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

// ── Utilities ──

export function displayNested(value: unknown, key: string, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return record[key] ? String(record[key]) : fallback;
}

export function formatRole(role: string, isSeniorSecurity?: boolean) {
  const labels: Record<string, string> = {
    "human-resource": "Human Resource",
    "project-manager": "Project Manager",
    "qa-tester": "Q-A Tester",
    finance: "Finance",
    employee: "Employee",
    admin: "Admin",
    security: "Security",
    others: "Others",
  };
  if (role === "security") {
    return isSeniorSecurity ? "Senior Security" : "Junior Security";
  }
  return labels[role] ?? role;
}

export function formatRoleWithCustom(role: string, customRole: unknown, isSeniorSecurity?: boolean) {
  const baseRole = formatRole(role, isSeniorSecurity);
  const label = String(customRole ?? "").trim();
  if (role === "others" && label) return `${baseRole} | ${label}`;
  return baseRole;
}

// ── Avatar ──

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

  const base = size === "lg" ? "h-12 w-12 text-sm" : "h-8 w-8 text-xs";
  const ring = showRing ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]" : "";

  if (avatarUrl) {
    return (
      <img
        alt={`${name} avatar`}
        className={`${base} rounded-full border border-border object-cover ${ring}`}
        src={avatarUrl}
      />
    );
  }

  return (
    <div
      className={`${base} grid place-items-center rounded-full bg-neutral-100 font-medium text-neutral-600 dark:bg-zinc-700 dark:text-zinc-300 ${ring}`}
    >
      {initials}
    </div>
  );
}

// ── History Card ──

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
      <SectionHeader title={title} description={hint || undefined} />
      <div className="mt-3 space-y-1">
        {rows.length === 0 ? (
          <EmptyState message="No history yet." />
        ) : (
          rows.map((row, index) => (
            <div
              className="flex justify-between gap-3 rounded-btn px-2.5 py-1.5 text-body hover:bg-surface-secondary"
              key={`${row.label}-${index}`}
            >
              <span className="text-muted">{row.label}</span>
              <span className="font-medium text-ink">{row.value}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// ── History Row Helpers ──

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
