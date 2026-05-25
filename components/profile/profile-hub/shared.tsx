import { ReactNode } from "react";

export type AnyRecord = Record<string, unknown>;

export function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize">{value ?? "Not set"}</dd>
    </div>
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
}: {
  avatarUrl: string;
  name: string;
  size: "md" | "lg";
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const base = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";

  if (avatarUrl) {
    return (
      <img
        alt={`${name} avatar`}
        className={`${base} rounded-full border border-slate-200 object-cover`}
        src={avatarUrl}
      />
    );
  }

  return (
    <div
      className={`${base} grid place-items-center rounded-full bg-emerald-600 font-semibold text-white`}
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No history yet.
          </p>
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
    </section>
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
