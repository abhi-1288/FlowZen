export type Period = "7d" | "30d" | "3m" | "1y";

export type Variant =
  | "admin"
  | "hr"
  | "finance"
  | "projects"
  | "it"
  | "security"
  | "personal";

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  label: string;
}

export interface Kpi {
  key: string;
  label: string;
  value: string;
  trend?: KpiTrend;
  icon?: string;
  href?: string;
}

export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  count: number;
  module: string;
  actionUrl: string;
  actionLabel: string;
}

export type UpcomingCategory =
  | "interview"
  | "birthday"
  | "contract"
  | "joining"
  | "meeting"
  | "holiday"
  | "payroll"
  | "deadline"
  | "leave"
  | "it-code";

export interface UpcomingItem {
  id: string;
  date: string;
  time?: string;
  title: string;
  category: UpcomingCategory;
  href?: string;
}

export interface UpcomingSection {
  label: string;
  items: UpcomingItem[];
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendMetric {
  key: string;
  label: string;
  unit: string;
  points: TrendPoint[];
}

export interface ProjectHealth {
  id: string;
  name: string;
  href: string;
  pct: number;
  totalTasks: number;
  doneTasks: number;
  overdue: number;
  blocked: number;
  warning: boolean;
}

export interface QuickAction {
  key: string;
  label: string;
  href: string;
  icon: string;
}

export interface CommandCenterResponse {
  variant: Variant;
  variantLabel: string;
  companyName: string;
  companyColor: string;
  role: string;
  userName: string;
  /**
   * The region the payload is scoped to. `""` is the whole company. Always
   * reports what was actually applied, so a viewer whose `?region=` was
   * ignored can see the real scope rather than the one they asked for.
   */
  region: string;
  regionLabel: string;
  regionScope: "global" | "region" | "personal";
  /** Their own region holds no members, so they are seeing the whole company. */
  regionFallback: boolean;
  /** A `?region=` was passed but ignored — the viewer is pinned to their own region. */
  regionForced: boolean;
  canSwitchRegion: boolean;
  /** "Global" is selectable — the company owner only. */
  allowGlobalRegion: boolean;
  /** Regions the viewer may switch between; `value` is what to send back. */
  regionOptions: { value: string; label: string }[];
  kpis: Kpi[];
  trends: TrendMetric[];
  projectHealth: ProjectHealth[] | null;
  attention: AttentionItem[];
  upcoming: UpcomingSection[];
  quickActions: QuickAction[];
}