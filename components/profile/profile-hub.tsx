"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Check,
  CheckCircle2,
  AlertCircle,
  Building2,
  Camera,
  Clipboard,
  Clock,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Calendar,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type Tab =
  | "profile"
  | "timeline"
  | "onboarding"
  | "approvals"
  | "notifications"
  | "calendar"
  | "attendance";
type AnyRecord = Record<string, unknown>;

export function ProfileHub() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [insights, setInsights] = useState<AnyRecord | null>(null);
  const [approvals, setApprovals] = useState<AnyRecord[]>([]);
  const [notifications, setNotifications] = useState<AnyRecord[]>([]);
  const [toast, setToast] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AnyRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<AnyRecord[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  const role = session?.user?.role ?? String(profile?.role ?? "employee");
  const displayName = String(profile?.name ?? session?.user?.name ?? "User");
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const setMessage = (text: string) => showToast(text, "success");

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);

      const [profileResult, approvalsResult, notificationResult] =
        await Promise.all([
          apiFetch<{ user: AnyRecord; insights?: AnyRecord }>(
            "/api/profile",
          ).catch(() => null),

          apiFetch<{ requests: AnyRecord[] }>("/api/approvals").catch(() => ({
            requests: [],
          })),

          apiFetch<{ notifications: AnyRecord[] }>("/api/notifications").catch(
            () => ({ notifications: [] }),
          ),
        ]);

      if (profileResult) setProfile(profileResult.user);
      if (profileResult?.insights) setInsights(profileResult.insights);

      setApprovals(approvalsResult?.requests ?? []);
      setNotifications(notificationResult?.notifications ?? []);

      apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").then(res => setAttendanceHistory(res.history)).catch(() => { });
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").then(res => setLeaveRequests(res.requests)).catch(() => { });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let eventSource: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/events", { withCredentials: true });

        eventSource.addEventListener("notification:new", () => {
          if (!mounted) return;
          console.log("SSE: ProfileHub notification:new received");
          void load(true);
        });

        eventSource.onerror = () => {
          if (mounted) {
            eventSource?.close();
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error("SSE connection failed:", err);
      }
    };

    connect();
    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, [profile?.id]);

  async function markAllRead() {
    await apiFetch("/api/notifications", { method: "PATCH" });
    await load();
  }

  async function markNotificationRead(id: string) {
    await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
    await load();
  }

  async function deleteAllNotifications() {
    await apiFetch("/api/notifications", { method: "DELETE" });
    await load();
  }

  async function deleteNotification(id: string) {
    await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
    await load();
  }

  const timeline = useMemo(() => {
    const staticItems = [
      {
        title: "Account created",
        body: `${String(profile?.name ?? "User")} joined FlowZen.`,
        date: profile?.createdAt ? String(profile.createdAt) : undefined,
      },
      profile?.companyStatus && profile.companyStatus !== "none"
        ? {
          title: "Company status",
          body: `Company onboarding is ${String(profile.companyStatus)}.`,
          date: profile.updatedAt ? String(profile.updatedAt) : undefined,
        }
        : null,
      profile?.teamStatus && profile.teamStatus !== "none"
        ? {
          title: "Team status",
          body: `Team onboarding is ${String(profile.teamStatus)}.`,
          date: profile.updatedAt ? String(profile.updatedAt) : undefined,
        }
        : null,
    ].filter(Boolean) as { title: string; body: string; date?: string }[];

    const historyItems = ((profile?.membershipHistory as any) || []).map((item: any) => {
      if (item.action === "board-invite" || item.action === "board-remove") {
        const boardName = item.board?.title || "a board";
        const inviter = item.inviter;
        const invitee = item.invitee;
        const currentName = String(profile?.name ?? "You");
        const currentRole = String(profile?.role ?? "user");
        const verb = item.action === "board-invite" ? "invited" : "removed";
        const title = item.action === "board-invite" ? "Board Invitation" : "Board Access Removed";

        if (inviter) {
          return {
            title,
            body: `${inviter.name}: ${inviter.role} has ${verb} you ${item.action === "board-invite" ? "to" : "from"} ${boardName}`,
            date: item.at ? String(item.at) : undefined,
          };
        }

        if (invitee) {
          return {
            title: item.action === "board-invite" ? "Board Invitation Sent" : "Board Member Removed",
            body: `${currentName}: ${currentRole} has ${verb} ${invitee.name} ${item.action === "board-invite" ? "to" : "from"} ${boardName}`,
            date: item.at ? String(item.at) : undefined,
          };
        }
      }

      const actionLabels: Record<string, string> = {
        "joined-company": "Joined company",
        "joined-team": "Joined team",
        "switched-team": "Switched team",
        "removed-team": "Was removed from team",
        "removed-company": "Was removed from company",
        "left-company": "Left company",
        "left-team": "Left team",
      };

      if (actionLabels[item.action]) {
        return {
          title: actionLabels[item.action],
          body: `User ${actionLabels[item.action].toLowerCase()}`,
          date: item.at ? String(item.at) : undefined,
        };
      }

      return null;
    }).filter(Boolean) as { title: string; body: string; date?: string }[];

    return [...staticItems, ...historyItems].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [profile]);

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 p-5 text-white lg:block">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl shadow-lg shadow-indigo-500/20">
              <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">FlowZen</h1>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 p-2 border border-slate-800">
            <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="md" />
            <div>
              <p className="text-sm font-medium text-slate-200 capitalize">{displayName}</p>
              <p className="text-xs text-slate-400 capitalize">{role}</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1">
          <NavButton
            active={tab === "profile"}
            label="Profile"
            onClick={() => setTab("profile")}
          />
          <NavButton
            active={tab === "timeline"}
            label="Timeline"
            onClick={() => setTab("timeline")}
          />
          <NavButton
            active={tab === "onboarding"}
            label="Onboarding"
            onClick={() => setTab("onboarding")}
          />
          <NavButton
            active={tab === "approvals"}
            label={`Approvals ${approvals.length ? `(${approvals.length})` : ""}`}
            onClick={() => setTab("approvals")}
          />
          <NavButton
            active={tab === "notifications"}
            label={`Notifications ${unreadCount ? `(${unreadCount})` : ""}`}
            onClick={() => setTab("notifications")}
          />
          <NavButton
            active={tab === "calendar"}
            label="Calendar"
            onClick={() => setTab("calendar")}
          />
          <NavButton
            active={tab === "attendance"}
            label={`Attendance ${leaveRequests.filter(r => r.status === "pending" || r.status === "manager-approved").length ? `(${leaveRequests.filter(r => r.status === "pending" || r.status === "manager-approved").length})` : ""}`}
            onClick={() => setTab("attendance")}
          />
        </nav>
        <Link
          className="mt-8 block rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          href="/board"
        >
          Back to boards
        </Link>
      </aside>

      <section className="lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Profile Center</h2>
              <p className="text-sm text-slate-500">
                {String(profile?.email ?? session?.user?.email ?? "")}
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {(
              [
                "profile",
                "timeline",
                "onboarding",
                "approvals",
                "notifications",
                "calendar",
                "attendance",
              ] as Tab[]
            ).map((item) => {
              const label = item === "attendance" && leaveRequests.filter(r => r.status === "pending" || r.status === "manager-approved").length > 0
                ? `attendance (${leaveRequests.filter(r => r.status === "pending" || r.status === "manager-approved").length})`
                : item;

              return (
                <button
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${tab === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
                  key={item}
                  onClick={() => setTab(item)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="p-5 sm:p-8">
          {loading ? (
            <ProfileSkeleton />
          ) : (
            <>
              {toast && (
                <div className={`fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                  <div className={`flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-600/90 text-white' : 'bg-rose-600/90 text-white'
                    }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="text-sm font-semibold tracking-wide">{toast.text}</p>
                  </div>
                </div>
              )}

              {tab === "profile" ? (
                <ProfileTab
                  profile={profile}
                  insights={insights}
                  refresh={load}
                  showToast={showToast}
                />
              ) : null}

              {tab === "timeline" ? (
                <TimelineTab items={timeline} role={role} />
              ) : null}

              {tab === "onboarding" ? (
                <OnboardingTab
                  profile={profile}
                  insights={insights}
                  role={String(role)}
                  refresh={load}
                  showToast={showToast}
                />
              ) : null}

              {tab === "approvals" ? (
                <ApprovalsTab
                  approvals={approvals}
                  refresh={load}
                  showToast={showToast}
                />
              ) : null}

              {tab === "notifications" ? (
                <NotificationsTab
                  notifications={notifications}
                  markAllRead={markAllRead}
                  deleteAll={deleteAllNotifications}
                  markRead={markNotificationRead}
                  deleteOne={deleteNotification}
                />
              ) : null}

              {tab === "calendar" ? (
                <CalendarTab />
              ) : null}

              {tab === "attendance" ? (
                <AttendanceTab showToast={showToast} />
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function CalendarTab() {
  const [viewDate, setViewDate] = useState(new Date());

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days: any[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-8 flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
            {monthNames[month]}
          </div>
          <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
            {year}
          </div>
        </div>

        <button
          onClick={nextMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((wd, i) => (
            <div
              key={wd}
              className={`flex flex-col gap-3 rounded-2xl p-2 pb-6 transition-all ${i === 0
                ? "bg-rose-50/50 text-rose-600 border border-rose-100/50"
                : "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50"
                }`}
            >
              <span className="text-center text-[10px] font-black uppercase tracking-tighter sm:text-xs">
                {wd}
              </span>
              <div className="space-y-2">
                {/* Find days that belong to this column */}
                {Array.from({ length: 6 }).map((_, rowIndex) => {
                  const dayIndex = rowIndex * 7 + i;
                  const day = days[dayIndex];
                  if (day === undefined) return null;

                  const today = isToday(day);
                  return (
                    <div
                      key={rowIndex}
                      className={`grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                        ? today
                          ? "bg-sky-100 text-rose-600 border border-sky-200 shadow-inner"
                          : "bg-white shadow-sm border border-slate-100 text-slate-700"
                        : "opacity-0"
                        }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttendanceTab({ showToast }: { showToast: (text: string, type?: 'success' | 'error') => void }) {
  const { data: session } = useSession();
  const [viewDate, setViewDate] = useState(new Date());
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = async () => {
    const [hRes, rRes] = await Promise.all([
      apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").catch(() => ({ history: [] })),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").catch(() => ({ requests: [] }))
    ]);
    setHistory(hRes.history);
    setRequests(rRes.requests);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await apiFetch("/api/attendance/checkin", { method: "POST" });
      loadData();
      showToast("Checked in successfully!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to check in", "error");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/leave/${id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
      loadData();
      showToast("Request approved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to approve", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await apiFetch(`/api/attendance/leave/${rejectingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", reason: rejectionReason })
      });
      loadData();
      showToast("Request rejected.");
      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reject", "error");
    }
  };

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days: any[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isOnLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req: any) => {
      if (req.status !== "approved") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-xl font-semibold">Attendance Tracker</h3>
          <p className="text-sm text-slate-500">Monitor your daily presence and check-in history.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequestsModal(true)}
            className="relative rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Requests
            {requests.filter(r => r.status === "pending" || r.status === "manager-approved").length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                {requests.filter(r => r.status === "pending" || r.status === "manager-approved").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Ask Leave
          </button>
          <button
            disabled={isCheckingIn}
            onClick={handleCheckIn}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
          >
            {isCheckingIn ? "Checking..." : "Check In"}
          </button>
        </div>
      </div>

      {showLeaveModal && <LeaveModal onClose={() => setShowLeaveModal(false)} onRefresh={loadData} showToast={showToast} />}
      {showRequestsModal && (
        <RequestsListModal
          requests={requests}
          onClose={() => setShowRequestsModal(false)}
          onApprove={handleApprove}
          onReject={(id) => setRejectingId(id)}
          currentUserId={session?.user?.id}
        />
      )}

      {rejectingId && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-md">
          <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Reject Request</h3>
            <p className="mt-1 text-sm text-slate-500">Please provide a reason for rejection.</p>

            <div className="mt-6 space-y-4">
              <textarea
                required
                rows={4}
                placeholder="Reason for rejection (required)..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all resize-none"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!rejectionReason.trim()}
                  onClick={handleReject}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
                >
                  Reject Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
            {monthNames[month]}
          </div>
          <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
            {year}
          </div>
        </div>

        <button
          onClick={nextMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((wd, i) => (
            <div
              key={wd}
              className={`flex flex-col gap-3 rounded-2xl p-2 pb-6 transition-all ${i === 0
                ? "bg-rose-50/50 text-rose-600 border border-rose-100/50"
                : "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50"
                }`}
            >
              <span className="text-center text-[10px] font-black uppercase tracking-tighter sm:text-xs">
                {wd}
              </span>
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, rowIndex) => {
                  const dayIndex = rowIndex * 7 + i;
                  const day = days[dayIndex];
                  if (day === undefined) return null;

                  const today = isToday(day);
                  const leave = isOnLeave(day);
                  return (
                    <div
                      key={rowIndex}
                      className={`grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                        ? today
                          ? "bg-sky-100 text-rose-600 border border-sky-200 shadow-inner"
                          : leave
                            ? "bg-emerald-100 text-rose-600 border border-emerald-200 shadow-sm"
                            : "bg-white shadow-sm border border-slate-100 text-slate-700"
                        : "opacity-0"
                        }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeaveModal({ onClose, onRefresh, showToast }: { onClose: () => void; onRefresh: () => void; showToast: (text: string, type?: 'success' | 'error') => void }) {
  const [formData, setFormData] = useState({ startDate: "", endDate: "", reason: "", attachmentUrl: "" });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, attachmentUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/leave", { method: "POST", body: JSON.stringify(formData) });
      onRefresh();
      showToast("Leave request submitted!");
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit leave", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Ask Leave</h3>
        <p className="mt-1 text-sm text-slate-500">Submit a leave request for approval.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Start Date</label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">End Date</label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">Reason</label>
            <textarea
              required
              rows={3}
              placeholder="Why are you taking leave?"
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">Attachment (Optional)</label>
            <div className="flex items-center gap-3">
              <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                <Camera size={18} />
                <span>{formData.attachmentUrl ? "Image selected" : "Upload medical/reason document"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {formData.attachmentUrl && (
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                  <img src={formData.attachmentUrl} alt="preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, attachmentUrl: "" }))}
                    className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
            <button disabled={loading} type="submit" className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  currentUserId
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  currentUserId?: string;
}) {
  const [selectedLeave, setSelectedLeave] = useState<AnyRecord | null>(null);

  if (selectedLeave) {
    return <LeaveDetailsModal
      leave={selectedLeave}
      onClose={() => setSelectedLeave(null)}
      onApprove={() => { onApprove(String(selectedLeave._id)); setSelectedLeave(null); }}
      onReject={() => { onReject(String(selectedLeave._id)); setSelectedLeave(null); }}
      currentUserId={currentUserId}
    />;
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Leave Requests</h3>
            <p className="text-sm text-slate-500">Manage pending leave approvals and view status.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-50 text-slate-400">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No leave requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                const isRequester = req.requester?._id === currentUserId || req.requester === currentUserId;
                const canApprove = !isRequester && (req.status === "pending" || req.status === "manager-approved");

                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedLeave(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{req.requester?.name || "User"}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                              req.status === "rejected" ? "bg-rose-100 text-rose-700" :
                                "bg-amber-100 text-amber-700"
                            }`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{req.reason}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock size={12} /> {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</span>
                          <span className="font-bold">{req.duration} days</span>
                        </div>
                      </div>

                      {canApprove && (
                        <div className="flex gap-2">
                          <button onClick={() => onReject(req._id)} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition">Reject</button>
                          <button onClick={() => onApprove(req._id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition">Approve</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

function LeaveDetailsModal({
  leave,
  onClose,
  onApprove,
  onReject,
  currentUserId
}: {
  leave: AnyRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentUserId?: string;
}) {
  const isRequester = (leave.requester as any)?._id === currentUserId || leave.requester === currentUserId;
  const canApprove = !isRequester && (leave.status === "pending" || leave.status === "manager-approved");

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="relative h-32 bg-slate-900">
          <div className="absolute -bottom-8 left-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 grid place-items-center text-white">
              <Clock size={32} />
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition">
            <LogOut className="rotate-180" size={16} />
          </button>
        </div>

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{String((leave.requester as any)?.name || "User")}</h3>
              <p className="text-sm font-medium text-slate-500 capitalize">{String(leave.status)} Request</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${leave.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                leave.status === "rejected" ? "bg-rose-100 text-rose-700" :
                  "bg-amber-100 text-amber-700"
              }`}>
              {String(leave.status)}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl bg-slate-50 p-5">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</p>
              <p className="text-sm font-bold text-slate-900">{Number(leave.duration)} Days</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Range</p>
              <p className="text-sm font-bold text-slate-900">
                {new Date(String(leave.startDate)).toLocaleDateString()} - {new Date(String(leave.endDate)).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason for Leave</p>
              <p className="text-sm leading-relaxed text-slate-700">{String(leave.reason)}</p>
            </div>

            {!!leave.attachmentUrl && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Attachments</p>
                <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img src={String(leave.attachmentUrl)} alt="attachment" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <a
                    href={String(leave.attachmentUrl)}
                    download="attachment"
                    className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-xl">View Original</div>
                  </a>
                </div>
              </div>
            )}

            {leave.status === "rejected" && !!leave.rejectionReason && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-500">Rejection Reason</p>
                <p className="mt-2 text-sm leading-relaxed text-rose-700 font-medium">{String(leave.rejectionReason)}</p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-10 flex gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="flex-1 rounded-2xl border border-rose-200 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-sm"
              >
                Reject
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20"
              >
                Approve
              </button>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-200" />
      </div>

      {/* Cards */}
      <div className="grid gap-5 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-xl bg-white p-6 shadow-sm">
            <div className="h-6 w-40 rounded bg-slate-200" />

            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4].map((line) => (
                <div key={line} className="h-4 rounded bg-slate-200" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProfileTab({
  profile,
  insights,
  refresh,
  showToast,
}: {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [modal, setModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;

  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;

  const role = profile?.role ? String(profile.role) : "";
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const displayName = profile?.name ? String(profile.name) : "User";
  const managerTeams = Array.isArray(
    (insights?.manager as AnyRecord | undefined)?.teams,
  )
    ? ((insights?.manager as AnyRecord).teams as AnyRecord[])
    : [];

  async function updatePassword(event: FormEvent) {
    event.preventDefault();

    await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setCurrentPassword("");
    setNewPassword("");
    showToast("Password updated.");
  }

  async function deleteAccount() {
    try {
      setDeleting(true);

      await apiFetch("/api/profile", {
        method: "DELETE",
      });

      await signOut({ callbackUrl: "/signup" });
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function uploadAvatar(file: File) {
    const data = new FormData();
    data.append("avatar", file);
    setUploading(true);
    try {
      const response = await fetch("/api/profile/image", {
        method: "POST",
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to upload avatar.");
      }
      showToast("Avatar updated.");
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Account</h3>
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 p-3">
            <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="lg" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Camera size={16} />
              {uploading ? "Uploading..." : "Upload avatar"}
              <input
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
                type="file"
              />
            </label>
            <button
              aria-label="Avatar upload restrictions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              title="PNG, JPG, or WEBP only. Max size: 2MB."
              type="button"
            >
              <Info size={16} />
            </button>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Name"
              value={profile?.name ? String(profile.name) : undefined}
            />
            <Row
              label="Email"
              value={profile?.email ? String(profile.email) : undefined}
            />
            <Row
              label="Email-Verified"
              value={
                profile?.emailVerified
                  ? String(profile.emailVerified)
                  : undefined
              }
            />
            <Row
              label="Role"
              value={profile?.role ? String(profile.role) : undefined}
            />
            <Row
              label="Company"
              value={company?.name ? String(company.name) : undefined}
            />
            <Row
              label="Team"
              value={team?.name ? String(team.name) : undefined}
            />
            <Row
              label="Company status"
              value={
                profile?.companyStatus
                  ? String(profile.companyStatus)
                  : undefined
              }
            />
            <Row
              label="Company Joined"
              value={
                profile?.company && profile?.companyJoined
                  ? new Date(
                    profile.companyJoined as string | Date,
                  ).toLocaleDateString()
                  : undefined
              }
            />
            <Row
              label="Team status"
              value={
                profile?.teamStatus ? String(profile.teamStatus) : undefined
              }
            />
            <Row
              label="Team Joined"
              value={
                profile?.team && profile?.teamJoined
                  ? new Date(
                    profile.teamJoined as string | Date,
                  ).toLocaleDateString()
                  : undefined
              }
            />
          </dl>
        </section>

        {role === "admin" && company?.joinCode ? (
          <CodePanel
            title="Company Staff Onboarding"
            code={String(company.joinCode)}
            label="Company code"
            secondaryCodes={
              company?.otherJoinCode
                ? [{ code: String(company.otherJoinCode), label: "Others code" }]
                : []
            }
            empty="Register a company to generate a permanent staff onboarding code."
          />
        ) : null}

        {role === "project-manager" || role === "qa-tester" ? (
          <section className="rounded-lg border overflow-y-auto max-h-[500px] border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} />
              <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
                Team Employee Onboarding
              </h3>
            </div>
            {managerTeams.length === 0 ? (
              <p className="text-sm text-slate-500">
                Create a team to generate employee onboarding codes.
              </p>
            ) : (
              <div className="space-y-3">
                {managerTeams.map((teamItem) => {
                  const code = String(teamItem.joinCode ?? "");
                  const otherCode = String(teamItem.otherJoinCode ?? "");
                  const teamName = String(teamItem.name ?? "Team");
                  return (
                    <div
                      key={String(teamItem.id)}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {teamName}
                        </p>
                        <span className="text-xs text-slate-500">
                          {Number(teamItem.employeeCount ?? 0)} employees
                        </span>
                      </div>
                      {[
                        { code, label: "Team code" },
                        ...(otherCode ? [{ code: otherCode, label: "Others code" }] : []),
                      ].map((item) => (
                        <div className="mb-3 last:mb-0" key={item.code}>
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              {item.label}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">
                                {item.code}
                              </p>
                              <button
                                aria-label={`Copy ${teamName} ${item.label}`}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.code);
                                  showToast(`${teamName} ${item.label.toLowerCase()} copied.`);
                                }}
                                title="Copy code"
                                type="button"
                              >
                                <Clipboard size={16} />
                              </button>
                            </div>
                          </div>
                          <button
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                            onClick={() => {
                              const joinUrl = `${window.location.origin}/join?code=${item.code}`;
                              navigator.clipboard.writeText(joinUrl);
                              showToast(`${teamName} ${item.label.toLowerCase()} join URL copied.`);
                            }}
                            type="button"
                          >
                            <Users size={16} />
                            Copy {item.label} Join URL
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Security</h3>

          <form className="mt-4 space-y-3" onSubmit={updatePassword}>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="Current password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />

            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
            />

            <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
              Update password
            </button>
          </form>

          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            onClick={() => setModal(true)}
          >
            <Trash2 size={16} />
            Delete account
          </button>
        </section>
      </div>

      {/* Modal */}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete account?
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
              <br />
              Type <span className="font-semibold text-rose-600">
                DELETE
              </span>{" "}
              to confirm.
            </p>

            <input
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setModal(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>

              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={deleteAccount}
              >
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TimelineTab({
  items,
  role,
}: {
  items: { title: string; body: string; date?: string }[];
  role: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Role Timeline</h3>
      <p className="mt-1 text-sm text-slate-500">
        Lifecycle events for your {role} account.
      </p>
      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const when = item.date ? new Date(item.date) : null;
          return (
            <div
              className="flex flex-col gap-3 rounded-lg border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              key={`${item.title}-${item.date}`}
            >
              <div className="flex min-w-0 gap-3">
                <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.body}</p>
                </div>
              </div>
              {when ? (
                <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-left sm:text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {when.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {when.toLocaleTimeString()}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OnboardingTab({
  profile,
  insights,
  role,
  refresh,
  showToast,
}: {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  role: string;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamModal, setTeamModal] = useState<AnyRecord | null>(null);
  const [kickModal, setKickModal] = useState<{
    teamId: string;
    employeeId: string;
    employeeName: string;
    teamName: string;
  } | null>(null);
  const [kickConfirmText, setKickConfirmText] = useState("");
  const [deleteTeamModal, setDeleteTeamModal] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [deleteTeamConfirmText, setDeleteTeamConfirmText] = useState("");
  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;
  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;
  const managerInsight = (insights?.manager as AnyRecord | undefined) ?? null;
  const managerTeams = Array.isArray(managerInsight?.teams)
    ? (managerInsight.teams as AnyRecord[])
    : [];
  const canCreateMoreTeams = managerTeams.length < 5;

  async function createCompany(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/company", {
      method: "POST",
      body: JSON.stringify({ name: companyName }),
    });
    showToast("Company registered.");
    await refresh();
  }

  async function joinCompany(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/company/join", {
      method: "POST",
      body: JSON.stringify({ code: companyCode }),
    });
    showToast("Join request sent to admin.");
    await refresh();
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMoreTeams) {
      showToast("Team limit reached. Managers can create up to 5 teams.", "error");
      return;
    }
    await apiFetch("/api/team", {
      method: "POST",
      body: JSON.stringify({ name: teamName }),
    });
    setTeamName("");
    showToast("Team created.");
    await refresh();
  }

  async function requestManagerQuit() {
    await apiFetch("/api/company/quit", { method: "POST" });
    showToast("Quit request sent to admin.");
    await refresh();
  }

  async function requestEmployeeQuit() {
    await apiFetch("/api/team/quit", { method: "POST" });
    showToast("Quit request sent to manager.");
    await refresh();
  }

  async function kickEmployee(teamId: string, employeeId: string) {
    await apiFetch("/api/team/kick", {
      method: "POST",
      body: JSON.stringify({ teamId, employeeId }),
    });
    showToast("Employee removed from team.");
    setKickModal(null);
    setKickConfirmText("");
    await refresh();
  }

  async function deleteTeam(teamId: string) {
    await apiFetch("/api/team/delete", {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
    setDeleteTeamModal(null);
    setDeleteTeamConfirmText("");
    setTeamModal(null);
    showToast("Team deleted.");
    await refresh();
  }

  async function joinTeam(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/team/join", {
      method: "POST",
      body: JSON.stringify({ code: teamCode }),
    });
    showToast("Join request sent to manager.");
    await refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {role === "admin" ? (
        <CodePanel
          title="Company Staff Onboarding"
          code={company?.joinCode ? String(company.joinCode) : undefined}
          label="Company code"
          secondaryCodes={
            company?.otherJoinCode
              ? [{ code: String(company.otherJoinCode), label: "Others code" }]
              : []
          }
          empty="Register a company to generate a permanent staff onboarding code."
        >
          {!company ? (
            <form className="mt-4 flex gap-2" onSubmit={createCompany}>
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5"
                placeholder="Company name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
                Register
              </button>
            </form>
          ) : null}
        </CodePanel>
      ) : null}

      {role === "project-manager" || role === "qa-tester" ? (
        profile?.companyStatus === "approved" ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Manager Membership</h3>

              <p className="mt-1 text-sm text-slate-500">
                You are currently assigned to a company.
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  {/* Company */}
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Company</span>

                    <span className="font-medium">
                      {company?.name ? String(company.name) : "Not assigned"}
                    </span>
                  </div>

                  {/* Team */}
                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Total Team</span>

                    <span className="font-medium">
                      {Array.isArray(managerTeams)
                        ? `${managerTeams.length}/5`
                        : "No team created"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Status</span>

                    <span className="font-medium capitalize text-emerald-600">
                      {String(profile?.companyStatus)}
                    </span>
                  </div>

                  {/* Employees */}
                  {/* <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Employees</span>

                    <span className="font-medium">
                      {Array.isArray(team?.employees)
                        ? team.employees.length
                        : 0}
                    </span>
                  </div> */}
                </div>

                {/* Create Team */}
                {canCreateMoreTeams ? (
                  <form className="flex gap-2" onSubmit={createTeam}>
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5"
                      placeholder="Team name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />

                    <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
                      <Plus size={16} />
                    </button>
                  </form>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Team limit reached (5/5).
                  </p>
                )}

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Managers can create up to 5 teams. Current:{" "}
                  {managerTeams.length}/5
                </p>
                <button
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={requestManagerQuit}
                  type="button"
                >
                  {insights?.pendingQuit ? "Requested to Quit" : "Request Quit.!"}
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Manager Team History</h3>
              <p className="mt-1 text-sm text-slate-500">
                Open a team to view employees and remove members.
              </p>
              <div className="mt-4 space-y-2">
                {managerTeams.length > 0 ? (
                  managerTeams.map((t) => (
                    <button
                      key={String(t.id)}
                      type="button"
                      onClick={() => setTeamModal(t)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span>{String(t.name)}</span>
                      <span className="font-medium">
                        {Number(t.employeeCount ?? 0)} employees
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No teams yet.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <JoinPanel
              title="Join company"
              placeholder="Company code"
              value={companyCode}
              onChange={setCompanyCode}
              onSubmit={joinCompany}
              status={
                profile?.companyStatus
                  ? String(profile.companyStatus)
                  : undefined
              }
            />

            <HistoryCard
              title="Manager Team History"
              rows={toManagerHistoryRows(insights)}
              hint="Teams created and employee joins."
            />
          </>
        )
      ) : null}
      {teamModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {String(teamModal.name)} employees
              </h3>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                  onClick={() =>
                    setDeleteTeamModal({
                      teamId: String(teamModal.id),
                      teamName: String(teamModal.name ?? "Team"),
                    })
                  }
                  type="button"
                >
                  Delete Team
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  onClick={() => setTeamModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Array.isArray(teamModal.employees) &&
                teamModal.employees.length > 0 ? (
                (teamModal.employees as AnyRecord[]).map((emp) => (
                  <div
                    key={String(emp.id)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {String(emp.name ?? "Employee")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {String(emp.email ?? "")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                      onClick={() =>
                        setKickModal({
                          teamId: String(teamModal.id),
                          employeeId: String(emp.id),
                          employeeName: String(emp.name ?? "Employee"),
                          teamName: String(teamModal.name ?? "Team"),
                        })
                      }
                    >
                      Kick
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No employees in this team.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {kickModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Kick employee {kickModal.employeeName}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
              <br />
              Type <span className="font-semibold text-rose-600">KICK</span> to
              confirm.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              placeholder="Type KICK"
              value={kickConfirmText}
              onChange={(event) => setKickConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setKickModal(null);
                  setKickConfirmText("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={kickConfirmText !== "KICK"}
                onClick={() =>
                  void kickEmployee(kickModal.teamId, kickModal.employeeId)
                }
                type="button"
              >
                Confirm kick
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteTeamModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Delete team {deleteTeamModal.teamName}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              All employees will be removed from this team immediately.
              <br />
              Type <span className="font-semibold text-rose-600">
                DELETE
              </span>{" "}
              to confirm.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              placeholder="Type DELETE"
              value={deleteTeamConfirmText}
              onChange={(event) => setDeleteTeamConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setDeleteTeamModal(null);
                  setDeleteTeamConfirmText("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleteTeamConfirmText !== "DELETE"}
                onClick={() => void deleteTeam(deleteTeamModal.teamId)}
                type="button"
              >
                Delete team
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {role === "employee" || role === "others" ? (
        profile?.teamStatus === "approved" ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Team Membership</h3>

              <p className="mt-1 text-sm text-slate-500">
                You are currently assigned to a team.
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Company</span>

                    <span className="font-medium">
                      {company?.name ? String(company.name) : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Team</span>

                    <span className="font-medium">
                      {team?.name ? String(team.name) : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Manager Name</span>

                    <span className="font-medium">
                      {typeof team?.manager === "object" && team?.manager
                        ? ((team.manager as { name?: string })?.name ??
                          "Not assigned")
                        : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Status</span>

                    <span className="font-medium capitalize text-emerald-600">
                      {String(profile?.teamStatus)}
                    </span>
                  </div>
                </div>

                <button
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={requestEmployeeQuit}
                >
                  {insights?.pendingQuit ? "Requested to Quit" : "Request Quit.!"}
                </button>
              </div>
            </section>
            <HistoryCard
              title="Membership History"
              rows={toEmployeeHistoryRows(insights)}
              hint="Company/team switches and removals."
            />
          </>
        ) : (
          <>
            <JoinPanel
              title="Join manager team"
              placeholder="Team code"
              value={teamCode}
              onChange={setTeamCode}
              onSubmit={joinTeam}
              status={
                profile?.teamStatus ? String(profile.teamStatus) : undefined
              }
            />
            <HistoryCard
              title="Membership History"
              rows={toEmployeeHistoryRows(insights)}
              hint="Employee can join up to 2 teams."
            />
          </>
        )
      ) : null}
      {role === "admin" ? (
        <HistoryCard
          title="Team Overview"
          rows={toAdminHistoryRows(insights)}
          hint="Team name, owner, and employee count."
        />
      ) : null}
    </div>
  );
}

function ApprovalsTab({
  approvals,
  refresh,
  showToast,
}: {
  approvals: AnyRecord[];
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}) {
  function requestIdOf(request: AnyRecord) {
    const value = request.id ?? request._id;
    return value ? String(value) : "";
  }

  async function decide(id: string, status: "approved" | "rejected") {
    if (!id) return;
    await apiFetch(`/api/approvals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    showToast(`Request ${status}.`);
    await refresh();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Pending Approvals</h3>
      <div className="mt-5 divide-y divide-slate-200">
        {approvals.map((request) => (
          <div
            className="flex flex-wrap items-center justify-between gap-4 py-4"
            key={requestIdOf(request)}
          >
            <div>
              <p className="font-medium">
                {displayNested(request.requester, "name", "User")},{" "}
                {displayNested(request.requester, "role", "User")}
              </p>
              <p className="text-sm text-slate-500">
                {displayNested(request.requester, "email", "unknown")}{" "}
                {String(request.kind).startsWith("quit-")
                  ? "requested to quit"
                  : "requested to join"}{" "}
                {request.kind === "team" || request.kind === "quit-team"
                  ? displayNested(request.team, "name", "team")
                  : displayNested(request.company, "name", "company")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                onClick={() => decide(requestIdOf(request), "rejected")}
              >
                Decline
              </button>
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={() => decide(requestIdOf(request), "approved")}
              >
                Approve
              </button>
            </div>
          </div>
        ))}
        {approvals.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No pending approvals.</p>
        ) : null}
      </div>
    </section>
  );
}

function NotificationsTab({
  notifications,
  markAllRead,
  deleteAll,
  markRead,
  deleteOne,
}: {
  notifications: AnyRecord[];
  markAllRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Notifications</h3>
          <p className="text-sm text-slate-500">
            Join requests, project updates, and deadline notices.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
            onClick={markAllRead}
          >
            <Check size={16} /> Mark all read
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600"
            onClick={deleteAll}
          >
            <Trash2 size={16} /> Delete all
          </button>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {notifications.map((item) => (
          <div
            className={`rounded-lg border p-4 ${item.readAt ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-white shadow-sm"}`}
            key={String(item.id)}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="font-medium">
                    {String(item.title ?? "Notification")}
                  </p>
                  <p className="text-sm">{String(item.body || item.message || "")}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.createdAt
                      ? new Date(String(item.createdAt)).toLocaleString()
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                {!item.readAt ? (
                  <button
                    aria-label="Mark notification as read"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => markRead(String(item.id))}
                    title="Mark as read"
                    type="button"
                  >
                    <Check size={17} />
                  </button>
                ) : null}
                {!item.readAt ? (
                  <button
                    aria-label="Delete notification"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => deleteOne(String(item.id))}
                    title="Delete"
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {notifications.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No notifications yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function CodePanel({
  title,
  code,
  label,
  secondaryCodes = [],
  empty,
  children,
}: {
  title: string;
  code?: string;
  label: string;
  secondaryCodes?: { code: string; label: string }[];
  empty: string;
  children?: ReactNode;
}) {
  const makeJoinUrl = (value: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${value}`
      : value;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} />
        <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h3>
      </div>
      {code ? (
        <>
          {[{ code, label }, ...secondaryCodes].map((item) => (
            <div className="mb-3 last:mb-0" key={item.code}>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {item.label}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">
                    {item.code}
                  </p>
                  <button
                    aria-label={`Copy ${item.label}`}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => navigator.clipboard.writeText(item.code)}
                    title="Copy code"
                    type="button"
                  >
                    <Clipboard size={16} />
                  </button>
                </div>
              </div>
              <button
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                onClick={() => navigator.clipboard.writeText(makeJoinUrl(item.code))}
                type="button"
              >
                <Users size={16} />
                Copy {item.label} Join URL
              </button>
            </div>
          ))}
          <p className="mt-3 text-xs text-slate-500">
            Share this code or join link with your staff.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">{empty}</p>
      )}
      {children}
    </section>
  );
}

function JoinPanel({
  title,
  placeholder,
  value,
  onChange,
  onSubmit,
  status,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  status?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        Enter the code and wait for approval.
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
          Request approval
        </button>
      </form>
      {status && status !== "none" ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Current status: {status}
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium capitalize">{value ?? "Not set"}</dd>
    </div>
  );
}

function displayNested(value: unknown, key: string, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return record[key] ? String(record[key]) : fallback;
}

function AvatarBadge({
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

function HistoryCard({
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

function toEmployeeHistoryRows(insights: AnyRecord | null) {
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

function toManagerHistoryRows(insights: AnyRecord | null) {
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

function toAdminHistoryRows(insights: AnyRecord | null) {
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
