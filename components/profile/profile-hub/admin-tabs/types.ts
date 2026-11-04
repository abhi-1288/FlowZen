
import { HeartHandshake, ClipboardList, Bug, Landmark, ShieldCheck, MonitorCog, Server, User, UsersRound, Shield, type LucideIcon } from "lucide-react";

export type MeetingDuration = 15 | 30 | 45 | 60 | 90 | 120;

export type HrMemberRoleKey = typeof HR_MEMBER_ROLE_KEYS[number];

/**
 * One visual identity per member role — icon + accent chip — shared by the
 * role tiles on the members page and the role chips on each member card, so
 * the two never drift. "security" resolves at render time to the senior or
 * junior key based on `isSeniorSecurity`.
 */
export const MEMBER_ROLE_META: Record<string, { chip: string; icon: LucideIcon }> = {
  "human-resource": { chip: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300", icon: HeartHandshake },
  "project-manager": { chip: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300", icon: ClipboardList },
  "qa-tester": { chip: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300", icon: Bug },
  finance: { chip: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300", icon: Landmark },
  admin: { chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300", icon: ShieldCheck },
  "it-admin": { chip: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300", icon: MonitorCog },
  "it-administration": { chip: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300", icon: Server },
  employee: { chip: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", icon: User },
  others: { chip: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-300", icon: UsersRound },
  "security-senior": { chip: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300", icon: ShieldCheck },
  "security-junior": { chip: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", icon: Shield },
};

export function memberRoleChipMeta(role: string, isSeniorSecurity = false) {
  if (role === "security") return MEMBER_ROLE_META[isSeniorSecurity ? "security-senior" : "security-junior"];
  return MEMBER_ROLE_META[role] ?? MEMBER_ROLE_META.employee;
}

export const MEETING_DURATION_OPTIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
] as const satisfies { minutes: MeetingDuration; label: string }[];

export const HR_MEMBER_ROLE_KEYS = [
  "human-resource",
  "project-manager",
  "qa-tester",
  "finance",
  "admin",
  "it-admin",
  "it-administration",
  "employee",
  "others",
] as const;

export type QuitNoticeInfo = {
  noticeDays: number;
  elapsedDays: number;
  remainingDays: number;
  canApprove: boolean;
};

export type DocModalData = {
  member: { name: string; email: string; role: string };
  categories: { name: string; mandatory: boolean; fields: { label: string; type: string }[] }[];
  documents: { category: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; fieldValues: { label: string; value: string }[] }[];
};
