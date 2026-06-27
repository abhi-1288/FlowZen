"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [otherDocuments, setOtherDocuments] = useState<AnyRecord[]>([]);
  const [docFilter, setDocFilter] = useState<"all" | "approved" | "rejected">("all");
  const [activeDocTab, setActiveDocTab] = useState<"other" | "my">("other");
  const [viewingRejected, setViewingRejected] = useState<AnyRecord | null>(null);
  const [missingDocs, setMissingDocs] = useState<{ name: string }[]>([]);
  const currentUserId = String(profile?._id ?? "");

  function generateFallbackLetter(request: AnyRecord) {
    const metadata = (request.metadata as any) ?? {};
    const letterType = String(metadata.letterType ?? "");
    const purpose = String(metadata.purpose ?? "");
    const customType = String(metadata.customType ?? "");

    if (letterType === "resignation") {
      const lastDayStr = metadata.resignationLastWorkingDay ? new Date(metadata.resignationLastWorkingDay).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "[Date]";
      const reasonStr = purpose ? `\n\nReason for resignation: ${purpose}` : "";
      return `Dear HR,\n\nPlease accept this letter as formal notification that I am resigning from my position. As per my notice period, my last working day will be ${lastDayStr}.${reasonStr}\n\nThank you for the opportunities I've had during my time with the company. I wish the company continued success in the future.\n\nSincerely,\n`;
    } else if (letterType === "internship") {
      const startStr = metadata.internshipStart ? new Date(metadata.internshipStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "[Start Date]";
      const endStr = metadata.internshipEnd ? new Date(metadata.internshipEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "[End Date]";
      const title = String(metadata.projectTitle ?? "");
      const desc = String(metadata.projectDescription ?? "");
      const achievements = String(metadata.projectAchievements ?? "");

      return `Dear HR,\n\nI am writing to formally request an Internship Certificate for my work from ${startStr} to ${endStr}.\n\nDuring this time, I worked on the project "${title}". ${desc}\n${achievements ? `\nKey achievements: ${achievements}\n` : ""}\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information.\n\nSincerely,\n`;
    } else {
      const typeLabel = letterType === "other" && customType ? customType : (letterType.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Document Letter");
      return `Dear HR,\n\nI am writing to formally request a ${typeLabel}.\n\nPurpose of request: ${purpose}\n\nPlease let me know if you need any further information from my side to process this request.\n\nSincerely,\n`;
    }
  }

  function refreshLetters() {
    apiFetch<{ requests: AnyRecord[] }>("/api/hr/document-letter")
      .then((res) => setLetterRequests(res.requests ?? []))
      .catch(() => {});
  }

  function refreshOtherDocuments() {
    apiFetch<{ requests: AnyRecord[] }>("/api/hr/document-letter?scope=company")
      .then((res) => {
        const others = (res.requests ?? []).filter((req) => {
          const requesterId = String((req.requester as any)?._id ?? "");
          const status = String(req.status ?? "");
          return requesterId !== currentUserId && (status === "approved" || status === "rejected");
        });
        setOtherDocuments(others);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refreshLetters();
    apiFetch<{
      categories: { name: string; mandatory: boolean }[];
      documents: { category: string }[];
    }>("/api/profile/documents")
      .then((res) => {
        const uploaded = new Set((res.documents ?? []).map((d) => d.category));
        const missing = (res.categories ?? [])
          .filter((c) => c.mandatory && !uploaded.has(c.name))
          .map((c) => ({ name: c.name }));
        setMissingDocs(missing);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (["human-resource", "admin"].includes(role)) {
      refreshOtherDocuments();
    }
  }, [role, currentUserId]);

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

      {/* Missing Documents Alert */}
      {missingDocs.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <FileText size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Required documents not uploaded</p>
              <p className="mt-1 text-sm text-amber-700">
                You have not uploaded the following required document{missingDocs.length > 1 ? "s" : ""}:{" "}
                <span className="font-medium">
                  {missingDocs.map((d) => d.name).join(", ")}
                </span>
                . Please upload them in your{" "}
                <Link href="/profile/documents" className="underline hover:text-amber-900">Documents</Link>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Document Letters Section */}
      {["human-resource", "admin"].includes(role) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex gap-2">
            <button
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                activeDocTab === "other"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveDocTab("other")}
            >
              Other
            </button>
            <button
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                activeDocTab === "my"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveDocTab("my")}
            >
              My
            </button>
          </div>

          {activeDocTab === "other" ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900">Other Documents</h2>
                </div>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                  value={docFilter}
                  onChange={(e) => setDocFilter(e.target.value as "all" | "approved" | "rejected")}
                >
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {docFilter === "all"
                  ? "All document letters requested by company members."
                  : docFilter === "approved"
                    ? "Approved document letters requested by company members."
                    : "Rejected document letters requested by company members."}
              </p>
              {otherDocuments.length > 0 ? (
                <div className="space-y-2">
                  {otherDocuments
                    .filter((req) => docFilter === "all" || String(req.status ?? "") === docFilter)
                    .map((req) => {
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
                            {String((req.requester as any)?.name ?? "Unknown")}
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
                                backgroundColor: status === "rejected" ? "#fee2e2" : "#dcfce7",
                                color: status === "rejected" ? "#991b1b" : "#166534",
                              }}
                            >
                              {status}
                            </span>
                          </p>
                          {(req.metadata as any)?.purpose ? (
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              Purpose: {String((req.metadata as any).purpose)}
                            </p>
                          ) : null}
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
                          ) : status === "rejected" ? (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              onClick={() => setViewingRejected(req)}
                            >
                              View Rejection
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 mt-4">No documents found.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText size={16} className="text-slate-500" />
                My Letters
              </h2>
              {letterRequests.length > 0 ? (
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
              ) : (
                <p className="text-sm text-slate-500 mt-4">You have no document requests.</p>
              )}
            </>
          )}
        </div>
      ) : letterRequests.length > 0 ? (
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
                          ) : (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              onClick={() => setViewingRejected(req)}
                            >
                              View
                            </button>
                          )}
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

      {viewingRejected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingRejected(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-4">
              <h4 className="text-lg font-semibold text-slate-900">Rejected Letter</h4>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <p>
                <span className="font-medium text-slate-700">Type:</span>{" "}
                {(() => {
                  const t = String((viewingRejected.metadata as any)?.letterType ?? "");
                  return LETTER_LABELS[t] ?? t.replace("-", " ");
                })()}
              </p>
              <p>
                <span className="font-medium text-slate-700">Requested by:</span>{" "}
                {String((viewingRejected.requester as any)?.name ?? "Unknown")}
              </p>
              <p>
                <span className="font-medium text-slate-700">Date:</span>{" "}
                {viewingRejected.createdAt
                  ? new Date(String(viewingRejected.createdAt)).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : ""}
              </p>
              <p>
                <span className="font-medium text-slate-700">Purpose:</span>{" "}
                {String((viewingRejected.metadata as any)?.purpose ?? "")}
              </p>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="font-medium text-red-700">Rejection Reason</p>
                <p className="mt-1 text-red-600">
                  {String((viewingRejected.metadata as any)?.rejectionReason ?? "No reason provided.")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-700 mb-2">Submitted Draft</p>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs border border-slate-200 text-slate-600">
                  {String((viewingRejected.metadata as any)?.letterContent ?? "").trim() || generateFallbackLetter(viewingRejected)}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => setViewingRejected(null)}
              >
                Close
              </button>
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


