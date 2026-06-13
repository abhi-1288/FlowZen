"use client";

import { useEffect, useState } from "react";
import { Bell, CheckSquare, Users, Wallet, Clock, User, Building2, ExternalLink, FileText } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "./shared";

const LETTER_LABELS: Record<string, string> = {
  experience: "Experience Certificate",
  "salary-certificate": "Salary Certificate",
  "offer-letter": "Offer Letter",
  relieving: "Relieving Letter",
  internship: "Internship Certificate",
  resignation: "Resignation Letter",
  other: "Certificate",
};

type DashboardTabProps = {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  notifications: AnyRecord[];
  approvals: AnyRecord[];
  attendanceHistory: AnyRecord[];
  leaveRequests: AnyRecord[];
  wfhRequests: AnyRecord[];
  financeCount: number;
  checkOutRequestCount: number;
  role: string;
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
};

export function DashboardTab({
  profile,
  insights,
  notifications,
  approvals,
  attendanceHistory,
  financeCount,
  checkOutRequestCount,
  role,
  company,
  showToast,
}: DashboardTabProps) {
  const displayName = String(profile?.name ?? "User");
  const companyName = String(company?.name ?? "");
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const todayEntry = attendanceHistory?.[0] ?? null;
  const checkInTime = todayEntry?.checkIn
    ? new Date(String(todayEntry.checkIn)).toLocaleTimeString()
    : null;
  const checkedIn = Boolean(todayEntry?.checkIn);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const pendingApprovalsCount = approvals.length;

  const [letterRequests, setLetterRequests] = useState<AnyRecord[]>([]);

  function refreshLetters() {
    apiFetch<{ requests: AnyRecord[] }>("/api/hr/document-letter")
      .then((res) => setLetterRequests(res.requests ?? []))
      .catch(() => {});
  }

  useEffect(refreshLetters, []);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">
          {greeting}, {displayName}
        </h1>
        <p className="mt-1 text-indigo-100">
          {companyName ? `${companyName}  ·  ` : ""}{today}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <Clock size={20} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Check-in</p>
              {checkedIn ? (
                <>
                  <p className="text-lg font-bold text-slate-900">{checkInTime}</p>
                  <p className="text-xs font-medium text-emerald-600">Checked in</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-400">--</p>
                  <p className="text-xs font-medium text-amber-600">Not checked in</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <CheckSquare size={20} className="text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending Approvals</p>
              <p className="text-lg font-bold text-slate-900">{pendingApprovalsCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-100 p-2.5">
              <Bell size={20} className="text-sky-700" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notifications</p>
              <p className="text-lg font-bold text-slate-900">{unreadCount} unread</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notifications */}
      {notifications.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bell size={16} className="text-slate-500" />
            Recent Notifications
          </h2>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={String(n._id ?? n.id)}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-emerald-500" : "bg-slate-300"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{String(n.title ?? "")}</p>
                  {n.body ? <p className="mt-0.5 truncate text-xs text-slate-500">{String(n.body)}</p> : null}
                </div>
                {n.link ? (
                  <a
                    href={String(n.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <ExternalLink size={14} />
                  </a>
                ) : null}
                <p className="shrink-0 text-xs text-slate-400">
                  {n.createdAt
                    ? timeAgo(new Date(String(n.createdAt)))
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* My Letters */}
      {letterRequests.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText size={16} className="text-slate-500" />
            My Letters
          </h2>
          <div className="space-y-2">
            {letterRequests.map((req) => {
              const letterType = String((req.metadata as any)?.letterType ?? "");
              const label = LETTER_LABELS[letterType] ?? letterType.replace("-", " ");
              const status = String(req.status ?? "");
              const reqId = String(req._id ?? req.id ?? "");
              const isApproved = status === "approved";
              return (
                <div
                  key={reqId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 capitalize">{label}</p>
                    <p className="text-xs text-slate-500">
                      {String((req as any).requester?.name ?? "")}
                      {" · "}
                      {req.createdAt
                        ? new Date(String(req.createdAt)).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                      <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                        style={{
                          backgroundColor: status === "rejected" ? "#fee2e2" : status === "approved" ? "#dcfce7" : "#fef3c7",
                          color: status === "rejected" ? "#991b1b" : status === "approved" ? "#166534" : "#92400e",
                        }}
                      >
                        {status}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isApproved ? (
                      <a
                        href={`/letter/${reqId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Role-specific sections */}
      {role === "human-resource" && insights?.hr ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users size={16} className="text-slate-500" />
            Company Overview
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{String((insights.hr as any).totalMembers ?? "0")}</p>
              <p className="text-xs text-slate-500">Total Members</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{String((insights.hr as any).pendingJoins ?? "0")}</p>
              <p className="text-xs text-slate-500">Pending Joins</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{approvals.length}</p>
              <p className="text-xs text-slate-500">Pending Approvals</p>
            </div>
          </div>
        </div>
      ) : null}

      {role === "finance" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wallet size={16} className="text-slate-500" />
            Finance Summary
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{financeCount}</p>
              <p className="text-xs text-slate-500">Pending Actions</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{checkOutRequestCount}</p>
              <p className="text-xs text-slate-500">Check-out Requests</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{approvals.length}</p>
              <p className="text-xs text-slate-500">Pending Approvals</p>
            </div>
          </div>
        </div>
      ) : null}

      {role === "admin" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 size={16} className="text-slate-500" />
            Company Overview
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {String((insights?.hr as any)?.totalMembers ?? (insights?.admin as any)?.totalMembers ?? "0")}
              </p>
              <p className="text-xs text-slate-500">Total Members</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{financeCount}</p>
              <p className="text-xs text-slate-500">Finance Pending</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{approvals.length}</p>
              <p className="text-xs text-slate-500">Pending Approvals</p>
            </div>
          </div>
        </div>
      ) : null}

      {["project-manager", "qa-tester"].includes(role) && insights?.manager ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users size={16} className="text-slate-500" />
            Team Overview
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {Array.isArray((insights.manager as any).teams) ? (insights.manager as any).teams.length : "0"}
              </p>
              <p className="text-xs text-slate-500">Teams Managed</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{approvals.length}</p>
              <p className="text-xs text-slate-500">Pending Approvals</p>
            </div>
          </div>
        </div>
      ) : null}

      {["employee", "others"].includes(role) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <User size={16} className="text-slate-500" />
            My Summary
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{pendingApprovalsCount}</p>
              <p className="text-xs text-slate-500">Pending Approvals</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{unreadCount}</p>
              <p className="text-xs text-slate-500">Unread Notifications</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {checkedIn ? "✓" : "--"}
              </p>
              <p className="text-xs text-slate-500">Today's Attendance</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
