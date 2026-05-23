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
  AlertTriangle,
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
  X,
  Pen,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";

type Tab =
  | "profile"
  | "timeline"
  | "onboarding"
  | "members"
  | "messages"
  | "approvals"
  | "notifications"
  | "attendance";
type AnyRecord = Record<string, unknown>;

export function ProfileHub() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [insights, setInsights] = useState<AnyRecord | null>(null);
  const [approvals, setApprovals] = useState<AnyRecord[]>([]);
  const [notifications, setNotifications] = useState<AnyRecord[]>([]);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AnyRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<AnyRecord[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  const role = session?.user?.role ?? String(profile?.role ?? "employee");
  const displayRole = formatRoleWithCustom(String(role), profile?.customRole);
  const displayName = String(profile?.name ?? session?.user?.name ?? "User");
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const hasCompany = Boolean(
    profile?.company && profile?.companyStatus === "approved",
  );
  const mobileTabs: Tab[] = [
    "profile",
    "timeline",
    "onboarding",
    ...(["human-resource", "admin"].includes(String(role))
      ? (["members"] as Tab[])
      : []),
    ...(hasCompany ? (["messages"] as Tab[]) : []),
    "approvals",
    "notifications",
    "attendance",
  ];

  const showToast = (text: string, type: "success" | "error" = "success") => {
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

      apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin")
        .then((res) => setAttendanceHistory(res.history))
        .catch(() => { });
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave")
        .then((res) => setLeaveRequests(res.requests))
        .catch(() => { });
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

    const historyItems = ((profile?.membershipHistory as any) || [])
      .map((item: any) => {
        if (item.action === "board-invite" || item.action === "board-remove") {
          const boardName = item.board?.title || "a board";
          const inviter = item.inviter;
          const invitee = item.invitee;
          const currentName = String(profile?.name ?? "You");
          const currentRole = String(profile?.role ?? "user");
          const verb = item.action === "board-invite" ? "invited" : "removed";
          const title =
            item.action === "board-invite"
              ? "Board Invitation"
              : "Board Access Removed";

          if (inviter) {
            return {
              title,
              body: `${inviter.name}: ${inviter.role} has ${verb} you ${item.action === "board-invite" ? "to" : "from"} ${boardName}`,
              date: item.at ? String(item.at) : undefined,
            };
          }

          if (invitee) {
            return {
              title:
                item.action === "board-invite"
                  ? "Board Invitation Sent"
                  : "Board Member Removed",
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
      })
      .filter(Boolean) as { title: string; body: string; date?: string }[];

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
              <Image
                src="/Logos/logo.jpg"
                alt="FlowZen Logo"
                fill
                className="object-cover"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              FlowZen
            </h1>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-900 p-2 border border-slate-800">
            <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="md" />
            <div>
              <p className="text-sm font-medium text-slate-200 capitalize">
                {displayName}
              </p>
              <p className="text-xs text-slate-400 capitalize">{displayRole}</p>
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
          {["human-resource", "admin"].includes(String(role)) ? (
            <NavButton
              active={tab === "members"}
              label="Members"
              onClick={() => setTab("members")}
            />
          ) : null}
          {hasCompany ? (
            <NavButton
              active={tab === "messages"}
              label="Messages"
              onClick={() => setTab("messages")}
            />
          ) : null}
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
            active={tab === "attendance"}
            label={`Attendance ${leaveRequests.filter((r) => r.status === "pending" || r.status === "manager-approved").length ? `(${leaveRequests.filter((r) => r.status === "pending" || r.status === "manager-approved").length})` : ""}`}
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
            {mobileTabs.map((item) => {
              const label =
                item === "attendance" &&
                  leaveRequests.filter(
                    (r) =>
                      r.status === "pending" || r.status === "manager-approved",
                  ).length > 0
                  ? `attendance (${leaveRequests.filter((r) => r.status === "pending" || r.status === "manager-approved").length})`
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
                <div
                  className={`fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300`}
                >
                  <div
                    className={`flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur-md ${toast.type === "success"
                      ? "bg-emerald-600/90 text-white"
                      : "bg-rose-600/90 text-white"
                      }`}
                  >
                    {toast.type === "success" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                    <p className="text-sm font-semibold tracking-wide">
                      {toast.text}
                    </p>
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

              {tab === "members" ? (
                <MembersTab
                  insights={insights}
                  actorRole={String(role)}
                  showToast={showToast}
                  refresh={load}
                />
              ) : null}

              {tab === "messages" ? (
                <MessagesTab showToast={showToast} />
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

              {tab === "attendance" ? (
                <AttendanceTab profile={profile} showToast={showToast} />
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [holidays, setHolidays] = useState<AnyRecord[]>([]);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
  const numWeeks = Math.ceil(days.length / 7);

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const getDateForDay = (day: number | null) => {
    if (!day) return null;
    return normalizeDate(new Date(year, month, day));
  };

  const isCheckedIn = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    return history.some(
      (entry) =>
        normalizeDate(new Date(String(entry.date))).getTime() ===
        date.getTime(),
    );
  };

  const isOnLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req) => {
      if (req.status !== "approved") return false;
      const start = new Date(String(req.startDate));
      const end = new Date(String(req.endDate));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isHoliday = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return holidays.some((holiday) => {
      const start = new Date(String(holiday.startDate));
      const end = new Date(String(holiday.endDate));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isPastDay = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    const today = normalizeDate(new Date());
    return date.getTime() < today.getTime();
  };

  const loadData = async () => {
    const [historyRes, requestsRes, holidaysRes] = await Promise.all([
      apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").catch(
        () => ({ history: [] as AnyRecord[] }),
      ),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").catch(
        () => ({ requests: [] as AnyRecord[] }),
      ),
      apiFetch<{ holidays: AnyRecord[] }>("/api/attendance/holidays").catch(
        () => ({ holidays: [] as AnyRecord[] }),
      ),
    ]);

    setHistory(historyRes.history ?? []);
    setRequests(requestsRes.requests ?? []);
    setHolidays(holidaysRes.holidays ?? []);
  };

  useEffect(() => {
    void loadData();
  }, []);

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
                {Array.from({ length: numWeeks }).map((_, rowIndex) => {
                  const dayIndex = rowIndex * 7 + i;
                  const day = days[dayIndex];
                  if (day === undefined) return null;

                  const today = isToday(day);
                  const checkedIn = isCheckedIn(day);
                  const leave = isOnLeave(day);
                  const holiday = isHoliday(day);
                  const past = isPastDay(day);
                  return (
                    <div
                      key={rowIndex}
                      onClick={() => {
                        const date = getDateForDay(day);
                        if (date) {
                          setSelectedDate(date);
                        }
                      }}
                      role={day ? "button" : undefined}
                      tabIndex={day ? 0 : undefined}
                      title={
                        day
                          ? `View details for ${monthNames[month]} ${day}, ${year}`
                          : undefined
                      }
                      className={`relative cursor-pointer grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                        ? holiday
                          ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm hover:border-fuchsia-300 hover:bg-fuchsia-50"
                          : today
                            ? checkedIn
                              ? "bg-sky-100 text-sky-700 border border-sky-200 shadow-inner"
                              : "bg-white text-rose-600 border border-rose-200 shadow-sm hover:border-rose-300 hover:bg-rose-50"
                            : checkedIn
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                              : leave
                                ? "bg-emerald-100 text-rose-600 border border-emerald-200 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                                : past
                                  ? "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm"
                                  : "bg-white shadow-sm border border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        : "opacity-0"
                        }`}
                    >
                      {day}
                      {day &&
                        (holiday ||
                          checkedIn ||
                          leave ||
                          (today && !checkedIn)) && (
                          <span className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5">
                            {holiday ? (
                              <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                            ) : checkedIn || leave ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-rose-600" />
                            )}
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          history={history}
          requests={requests}
          holidays={holidays}
        />
      )}
    </section>
  );
}

function AttendanceTab({
  profile,
  showToast,
}: {
  profile: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const [viewDate, setViewDate] = useState(new Date());
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showLeaveHistoryModal, setShowLeaveHistoryModal] = useState(false);
  const [showEditHolidayModal, setShowEditHolidayModal] = useState(false);
  const [showDeleteHolidayConfirm, setShowDeleteHolidayConfirm] =
    useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<AnyRecord | null>(
    null,
  );
  const [holidayToDelete, setHolidayToDelete] = useState<AnyRecord | null>(
    null,
  );
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [holidays, setHolidays] = useState<AnyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [serverToday, setServerToday] = useState<Date | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [wfhDates, setWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [wfhCheckInMode, setWfhCheckInMode] = useState<string>("all-day");

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const attendanceStartDate = useMemo(() => {
    const parseDate = (value: unknown) => {
      if (!value) return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : normalizeDate(date);
    };

    const companyJoined = parseDate(profile?.companyJoined);
    const teamJoined = parseDate(profile?.teamJoined);
    const createdAt = parseDate(profile?.createdAt);

    if (companyJoined && teamJoined) {
      return companyJoined.getTime() > teamJoined.getTime()
        ? companyJoined
        : teamJoined;
    }

    return (
      companyJoined || teamJoined || createdAt || normalizeDate(new Date(0))
    );
  }, [profile]);

  const loadData = async () => {
    const [hRes, cRes, rRes, holRes, wfhRes] = await Promise.all([
      apiFetch<{ history: AnyRecord[]; today?: string }>(
        "/api/attendance/checkin",
      ).catch(() => ({ history: [] as AnyRecord[], today: undefined })),
      apiFetch<{ checkout: AnyRecord[] }>("/api/attendance/checkout").catch(() => ({ checkout: [] as AnyRecord[] })),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").catch(
        () => ({ requests: [] as AnyRecord[] }),
      ),
      apiFetch<{ holidays: AnyRecord[] }>("/api/attendance/holidays").catch(
        () => ({ holidays: [] as AnyRecord[] }),
      ),
      apiFetch<{ wfhDates: any[]; wfhCheckInMode?: string }>("/api/company/wfh").catch(
        () => ({ wfhDates: [] as any[], wfhCheckInMode: "all-day" }),
      ),
    ]);
    setHistory(hRes.history);
    setRequests(rRes.requests);
    setHolidays(holRes.holidays);
    setWfhCheckInMode(wfhRes.wfhCheckInMode ?? "all-day");


    const mappedWfh = Array.isArray(wfhRes?.wfhDates)
      ? wfhRes.wfhDates.map((item: any) => {
        if (item && typeof item === "object") {
          return {
            date: String(item.date),
            reason: item.reason ? String(item.reason) : ""
          };
        }
        return { date: String(item), reason: "" };
      })
      : [];
    setWfhDates(mappedWfh);

    if (hRes.today) {
      const today = new Date(hRes.today);
      if (!Number.isNaN(today.getTime())) {
        setServerToday(today);
      }
    }
  };

  const isAttendanceEnabled = Boolean(
    (profile?.companyStatus === "approved" && profile?.company) ||
    (profile?.teamStatus === "approved" && profile?.team),
  );

  useEffect(() => {
    if (!isAttendanceEnabled) return;
    loadData();
  }, [isAttendanceEnabled]);

  useEffect(() => {
    if (serverToday) {
      setViewDate(serverToday);
    }
  }, [serverToday]);

  const handleCheckIn = async () => {
    if (todayLeave) {
      showToast(
        "You are on approved leave today. Check-in is disabled.",
        "error",
      );
      return;
    }

    setIsCheckingIn(true);
    try {
      await apiFetch("/api/attendance/checkin", { method: "POST" });
      loadData();
      showToast("Checked in successfully!");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to check in",
        "error",
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setIsCheckingIn(true);
    try {
      await apiFetch("/api/attendance/checkout", { method: "POST" });
      loadData();
      showToast("Checked out successfully!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to check out", "error");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      loadData();
      showToast("Request approved.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to approve",
        "error",
      );
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await apiFetch(`/api/attendance/leave/${rejectingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", reason: rejectionReason }),
      });
      loadData();
      showToast("Request rejected.");
      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to reject",
        "error",
      );
    }
  };

  const handleEditHoliday = async (
    holiday: AnyRecord,
    updates: {
      title?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
    },
  ) => {
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "PUT",
        body: JSON.stringify({ id: holiday._id, ...updates }),
      });
      loadData();
      showToast("Holiday updated.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update holiday",
        "error",
      );
    }
  };

  const handleDeleteHoliday = async (holiday: AnyRecord) => {
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "DELETE",
        body: JSON.stringify({ id: holiday._id }),
      });
      loadData();
      showToast("Holiday deleted.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete holiday",
        "error",
      );
    }
  };

  const requestHolidayDelete = (holiday: AnyRecord) => {
    setHolidayToDelete(holiday);
    setShowDeleteHolidayConfirm(true);
  };

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
  const numWeeks = Math.ceil(days.length / 7);

  const serverTodayDate = useMemo(() => {
    return normalizeDate(serverToday ?? new Date());
  }, [serverToday]);

  const todayDate = serverTodayDate;

  const getDateForDay = (day: number | null) => {
    if (!day) return null;
    return normalizeDate(new Date(year, month, day));
  };

  const isBeforeAttendanceStart = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getTime() < attendanceStartDate.getTime();
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    return (
      day === todayDate.getDate() &&
      month === todayDate.getMonth() &&
      year === todayDate.getFullYear()
    );
  };

  const isCheckedIn = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    return history.some((entry: any) => {
      const entryDate = normalizeDate(new Date(entry.date));
      return entryDate.getTime() === date.getTime();
    });
  };

  const isPastDay = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getTime() < todayDate.getTime();
  };

  const isWeekend = (day: number | null) => {
    const date = getDateForDay(day);
    return date ? date.getDay() === 0 || date.getDay() === 6 : false;
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

  const isPendingLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req: any) => {
      if (req.status !== "pending") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isHoliday = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return holidays.some((holiday: any) => {
      const start = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const getWfhDetail = (day: number | null) => {
    if (!day) return null;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const targetTime = date.getTime();
    return wfhDates.find((wfh) => {
      const wfhD = new Date(wfh.date);
      wfhD.setHours(0, 0, 0, 0);
      return wfhD.getTime() === targetTime;
    }) || null;
  };

  const todayLeave = requests.some((req: any) => {
    if (req.status !== "approved") return false;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return todayDate >= start && todayDate <= end;
  });

  const todayAttendance = history.find((entry: any) => {
    const entryDate = normalizeDate(new Date(entry.date));
    return entryDate.getTime() === todayDate.getTime();
  }) ?? null;

  const isTodayWfh = useMemo(() => {
    const todayTime = todayDate.getTime();
    return wfhDates.some((wfh) => {
      const wfhD = new Date(wfh.date);
      wfhD.setHours(0, 0, 0, 0);
      return wfhD.getTime() === todayTime;
    });
  }, [wfhDates, todayDate]);

  const currentHoliday = (day: number | null) => {
    if (!day) return null;
    const date = new Date(year, month, day);
    return (
      holidays.find((holiday: any) => {
        const start = new Date(holiday.startDate);
        const end = new Date(holiday.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }) || null
    );
  };

  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

  if (!isAttendanceEnabled) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-4xl font-extrabold tracking-tight text-slate-900">
            {todayDate.toLocaleDateString()}
          </p>
          <p className="max-w-md text-sm text-slate-500">
            Join a company or team to access attendance, leave, and holiday
            features. Right now only the current date is shown.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold">Attendance Tracker</h3>
            <p className="text-sm text-slate-500">
              Monitor your daily presence and check-in history.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowRequestsModal(true)}
              className="relative rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Requests
              {requests.filter(
                (r) =>
                  r.status === "pending" || r.status === "manager-approved",
              ).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    {
                      requests.filter(
                        (r) =>
                          r.status === "pending" ||
                          r.status === "manager-approved",
                      ).length
                    }
                  </span>
                )}
            </button>
            {profile?.role === "admin" && (
              <button
                onClick={() => setShowLeaveHistoryModal(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Manage Holidays
              </button>
            )}
            {profile?.role === "admin" ? (
              <button
                onClick={() => setShowHolidayModal(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Add Holiday
              </button>
            ) : (
              <button
                onClick={() => setShowLeaveModal(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Ask Leave
              </button>
            )}
            {(wfhCheckInMode === "all-day" || isTodayWfh) && (
              todayAttendance && !todayAttendance.checkOut ? (
                <button
                  disabled={isCheckingIn}
                  onClick={handleCheckOut}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
                  title="Check out for today"
                >
                  {isCheckingIn ? "Processing..." : "Check Out"}
                </button>
              ) : !todayAttendance ? (
                <button
                  disabled={isCheckingIn || todayLeave}
                  onClick={handleCheckIn}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                  title={
                    todayLeave
                      ? "Today is approved leave, check-in disabled."
                      : "Check in for today."
                  }
                >
                  {isCheckingIn
                    ? "Checking..."
                    : todayLeave
                      ? "On Leave"
                      : "Check In"}
                </button>
              ) : null
            )}
          </div>
        </div>

        {showLeaveModal && (
          <LeaveModal
            onClose={() => setShowLeaveModal(false)}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
        {showHolidayModal && (
          <HolidayModal
            onClose={() => setShowHolidayModal(false)}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
        {showLeaveHistoryModal && (
          <AdminLeaveHistoryModal
            requests={requests}
            holidays={holidays}
            onClose={() => setShowLeaveHistoryModal(false)}
            onEditHoliday={(holiday) => {
              setSelectedHoliday(holiday);
              setShowEditHolidayModal(true);
            }}
            onDeleteHoliday={requestHolidayDelete}
          />
        )}
        {showEditHolidayModal && selectedHoliday && (
          <EditHolidayModal
            holiday={selectedHoliday}
            onClose={() => {
              setShowEditHolidayModal(false);
              setSelectedHoliday(null);
            }}
            onSave={async (updates) => {
              if (!selectedHoliday) return;
              await handleEditHoliday(selectedHoliday, updates);
            }}
            onDelete={async () => {
              if (selectedHoliday) {
                await handleDeleteHoliday(selectedHoliday);
                setShowEditHolidayModal(false);
                setSelectedHoliday(null);
              }
            }}
            showToast={showToast}
          />
        )}

        {showDeleteHolidayConfirm && holidayToDelete && (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Confirm Delete
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Delete holiday "{String(holidayToDelete.title)}"? This action
                cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteHolidayConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteHoliday(holidayToDelete);
                    setShowDeleteHolidayConfirm(false);
                    setHolidayToDelete(null);
                  }}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showRequestsModal && (
          <RequestsListModal
            requests={requests}
            onClose={() => setShowRequestsModal(false)}
            onApprove={handleApprove}
            onReject={(id) => setRejectingId(id)}
            currentUserId={session?.user?.id}
            onViewDay={(dateStr) => {
              setShowRequestsModal(false);
              setShowLeaveModal(false);
              setSelectedDate(new Date(dateStr));
            }}
          />
        )}

        {rejectingId && (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-md">
            <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Reject Request
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Please provide a reason for rejection.
              </p>

              <div className="mt-6 space-y-4">
                <textarea
                  required
                  rows={4}
                  placeholder="Reason for rejection (required)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all resize-none"
                />

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectionReason("");
                    }}
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

        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
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
                  {Array.from({ length: numWeeks }).map((_, rowIndex) => {
                    const dayIndex = rowIndex * 7 + i;
                    const day = days[dayIndex];
                    if (day === undefined) return null;

                    const today = isToday(day);
                    const checkedIn = isCheckedIn(day);
                    const leave = isOnLeave(day);
                    const pendingLeave = isPendingLeave(day);
                    const holiday = isHoliday(day);
                    const holidayDetails = currentHoliday(day);
                    const past = isPastDay(day);
                    const weekend = isWeekend(day);
                    const beforeStart = isBeforeAttendanceStart(day);
                    const missed =
                      past &&
                      !checkedIn &&
                      !leave &&
                      !holiday &&
                      !pendingLeave &&
                      !weekend &&
                      !beforeStart;
                    return (
                      <div
                        key={rowIndex}
                        onClick={() => {
                          const date = getDateForDay(day);
                          if (date && !isBeforeAttendanceStart(day)) {
                            // Close other modals so the day details are visible
                            setShowLeaveModal(false);
                            setShowRequestsModal(false);
                            setRejectingId(null);
                            setSelectedDate(date);
                          }
                        }}
                        role={day ? "button" : undefined}
                        tabIndex={day ? 0 : undefined}
                        className={`relative cursor-pointer grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                          ? beforeStart
                            ? "bg-slate-100 text-slate-400 border border-slate-200 shadow-sm"
                            : pendingLeave
                              ? "bg-amber-50 text-amber-900 border border-amber-200 shadow-sm"
                              : holiday
                                ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm"
                                : today
                                  ? checkedIn
                                    ? "bg-sky-100 text-sky-700 border border-sky-200 shadow-inner"
                                    : "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                  : checkedIn
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm"
                                    : leave
                                      ? "bg-emerald-100 text-rose-600 border border-emerald-200 shadow-sm"
                                      : weekend
                                        ? "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm"
                                        : missed
                                          ? "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                          : "bg-white shadow-sm border border-slate-100 text-slate-700"
                          : "opacity-0"
                          }`}
                      >
                        {day}
                        {day && getWfhDetail(day) && (
                          <span className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5 shadow-sm">
                            <Pen className="h-3 w-3 text-emerald-600" />
                          </span>
                        )}
                        {day &&
                          (pendingLeave ||
                            holiday ||
                            leave ||
                            (today && !checkedIn) ||
                            (past && checkedIn) ||
                            missed) && (
                            <span className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5">
                              {pendingLeave ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ) : holiday ? (
                                <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                              ) : leave ? (
                                <Check className="h-3.5 w-3.5 text-rose-600" />
                              ) : today && !checkedIn ? (
                                <X className="h-3.5 w-3.5 text-rose-600" />
                              ) : missed ? (
                                <X className="h-3.5 w-3.5 text-rose-600" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </span>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          history={history}
          requests={requests}
          holidays={holidays}
          wfhDates={wfhDates}
        />
      )}
    </>
  );
}

function LeaveModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    attachmentUrl: "",
  });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          attachmentUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/leave", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("Leave request submitted!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit leave",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Ask Leave</h3>
        <p className="mt-1 text-sm text-slate-500">
          Submit a leave request for approval.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Reason
            </label>
            <textarea
              required
              rows={3}
              placeholder="Why are you taking leave?"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Attachment (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                <Camera size={18} />
                <span>
                  {formData.attachmentUrl
                    ? "Image selected"
                    : "Upload medical/reason document"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {formData.attachmentUrl && (
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                  <img
                    src={formData.attachmentUrl}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, attachmentUrl: "" }))
                    }
                    className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HolidayModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("Holiday added successfully!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add holiday",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Add Holiday</h3>
        <p className="mt-1 text-sm text-slate-500">
          Create a future holiday for the organization.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditHolidayModal({
  holiday,
  onClose,
  onSave,
  onDelete,
  showToast,
}: {
  holiday: AnyRecord;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: String(holiday.title ?? ""),
    description: String(holiday.description ?? ""),
    startDate: holiday.startDate
      ? new Date(String(holiday.startDate)).toISOString().slice(0, 10)
      : "",
    endDate: holiday.endDate
      ? new Date(String(holiday.endDate)).toISOString().slice(0, 10)
      : "",
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update holiday",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete holiday",
        "error",
      );
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 relative">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit Holiday</h3>
            <p className="mt-1 text-sm text-slate-500">
              Update holiday details or remove it entirely.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                type="submit"
                className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-500">
              Delete holiday "{String(holiday.title ?? "")}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLeaveHistoryModal({
  requests,
  holidays,
  onClose,
  onEditHoliday,
  onDeleteHoliday,
}: {
  requests: AnyRecord[];
  holidays: AnyRecord[];
  onClose: () => void;
  onEditHoliday: (holiday: AnyRecord) => void;
  onDeleteHoliday: (holiday: AnyRecord) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Manage Holidays
            </h3>
            <p className="text-sm text-slate-500">
              Create, update, or remove company holidays from one place.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-3 py-2 border text-left">Title</th>
                  <th className="px-3 py-2 border text-left">From</th>
                  <th className="px-3 py-2 border text-left">To</th>
                  <th className="px-3 py-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      No holidays available.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h: any) => (
                    <tr
                      key={h._id}
                      className="border-b bg-white hover:bg-slate-50 transition"
                    >
                      <td className="px-3 py-3 border">{h.title}</td>
                      <td className="px-3 py-3 border">
                        {h.startDate
                          ? new Date(h.startDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        {h.endDate
                          ? new Date(h.endDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => onEditHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  currentUserId,
  onViewDay,
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
}) {
  const [selectedLeave, setSelectedLeave] = useState<AnyRecord | null>(null);

  if (selectedLeave) {
    return (
      <LeaveDetailsModal
        leave={selectedLeave}
        onClose={() => setSelectedLeave(null)}
        onApprove={() => {
          onApprove(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        onReject={() => {
          onReject(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        currentUserId={currentUserId}
        onViewDay={onViewDay}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Leave Requests</h3>
            <p className="text-sm text-slate-500">
              Manage pending leave approvals and view status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-50 text-slate-400"
          >
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
                const isRequester =
                  req.requester?._id === currentUserId ||
                  req.requester === currentUserId;
                const canApprove =
                  !isRequester &&
                  (req.status === "pending" ||
                    req.status === "manager-approved");

                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedLeave(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {req.requester?.name || "User"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {req.reason}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(req.startDate).toLocaleDateString()} -{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </span>
                          <span className="font-bold">{req.duration} days</span>
                        </div>
                      </div>

                      {/* Approval actions moved to the detailed modal. */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
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
  currentUserId,
  onViewDay,
}: {
  leave: AnyRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
}) {
  const isRequester =
    (leave.requester as any)?._id === currentUserId ||
    leave.requester === currentUserId;
  const canApprove =
    !isRequester &&
    (leave.status === "pending" || leave.status === "manager-approved");

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="relative h-32 bg-slate-900">
          <div className="absolute -bottom-8 left-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 grid place-items-center text-white">
              <Clock size={32} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <LogOut className="rotate-180" size={16} />
          </button>
        </div>

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {String((leave.requester as any)?.name || "User")}
              </h3>
              <p className="text-sm font-medium text-slate-500 capitalize">
                {String(leave.status)} Request
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${leave.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : leave.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
                }`}
            >
              {String(leave.status)}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl bg-slate-50 p-5">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Duration
              </p>
              <p className="text-sm font-bold text-slate-900">
                {Number(leave.duration)} Days
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date Range
              </p>
              <p className="text-sm font-bold text-slate-900">
                {new Date(String(leave.startDate)).toLocaleDateString()} -{" "}
                {new Date(String(leave.endDate)).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason for Leave
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                {String(leave.reason)}
              </p>
            </div>

            {!!leave.attachmentUrl && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Attachments
                </p>
                <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={String(leave.attachmentUrl)}
                    alt="attachment"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <a
                    href={String(leave.attachmentUrl)}
                    download="attachment"
                    className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-xl">
                      View Original
                    </div>
                  </a>
                </div>
              </div>
            )}

            {leave.status === "rejected" && !!leave.rejectionReason && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-500">
                  Rejection Reason
                </p>
                <p className="mt-2 text-sm leading-relaxed text-rose-700 font-medium">
                  {String(leave.rejectionReason)}
                </p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-10 flex gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className="flex-1 rounded-2xl border border-rose-200 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-sm"
              >
                Reject
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
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
          {onViewDay && (
            <div className="mt-4">
              <button
                onClick={() => {
                  // close this modal and open day details for the start date
                  onClose();
                  try {
                    onViewDay(String(leave.startDate));
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="w-full mt-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                View Day Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayDetailsModal({
  date,
  onClose,
  history,
  requests,
  holidays,
  wfhDates = [],
}: {
  date: Date;
  onClose: () => void;
  history: AnyRecord[];
  requests: AnyRecord[];
  holidays: AnyRecord[];
  wfhDates?: { date: string; reason: string }[];
}) {
  const attendance = history.find((h: any) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === date.getTime();
  });

  const leave = requests.find((r: any) => {
    const start = new Date(String(r.startDate));
    const end = new Date(String(r.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const holiday = holidays.find((h: any) => {
    const start = new Date(String(h.startDate));
    const end = new Date(String(h.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const wfh = wfhDates.find((w: any) => {
    const d = new Date(w.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === date.getTime();
  });

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{date.toLocaleDateString()}</h3>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
            Close
          </button>
        </div>

        <div className="space-y-4">
          {wfh && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  <Pen className="h-4 w-4 text-emerald-600" /> Work From Home (WFH)
                </p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  Assigned
                </span>
              </div>
              {wfh.reason && (
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Reason: {wfh.reason}
                </p>
              )}
            </div>
          )}

          {attendance ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-in</p>
                <p className="text-sm text-slate-600">
                  {new Date(String(attendance.checkIn)).toLocaleTimeString()}
                </p>
              </div>
              <br />
              <hr />
              <br />
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-out</p>
                <p className="text-sm text-slate-600">
                  {attendance.checkOut ? new Date(String(attendance.checkOut)).toLocaleTimeString() : "--"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">No attendance recorded</p>
            </div>
          )}

          {leave && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-800">Leave</p>
                {Boolean((leave as any).halfDay) && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                    Half-day
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {String((leave as any).reason ?? "")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((leave as any).duration ?? "")} day(s) •
                Status: {String((leave as any).status ?? "")}
              </p>
            </div>
          )}
          {holiday && (
            <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-fuchsia-800">Holiday</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {String((holiday as any).title ?? "Company holiday")}
                  </p>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-xs font-bold text-fuchsia-700">
                  Holiday
                </span>
              </div>
              {((holiday as any).description ?? "") && (
                <p className="mt-3 text-sm text-slate-700">
                  {String((holiday as any).description)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((holiday as any).duration ?? "")} day(s)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WfhAssignModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: (dates: { date: string; reason: string }[]) => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.startDate) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ wfhDates: any[]; wfhCheckInMode: string }>(
        "/api/company/wfh",
        {
          method: "POST",
          body: JSON.stringify({
            startDate: formData.startDate,
            endDate: formData.endDate || formData.startDate,
            reason: formData.reason,
          }),
        }
      );
      const mapped = Array.isArray(res.wfhDates)
        ? res.wfhDates.map((item: any) => {
          if (item && typeof item === "object") {
            return {
              date: String(item.date),
              reason: item.reason ? String(item.reason) : ""
            };
          }
          return { date: String(item), reason: "" };
        })
        : [];
      onRefresh(mapped);
      showToast("WFH dates assigned and notifications sent!", "success");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to assign WFH",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Assign Work From Home</h3>
        <p className="mt-1 text-sm text-slate-500">
          Assign Work From Home (WFH) dates for the company.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Reason / Instructions
            </label>
            <textarea
              required
              rows={3}
              placeholder="Reason for WFH assignment..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-4 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.startDate || !formData.reason}
              className="flex-1 rounded-xl bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign WFH"}
            </button>
          </div>
        </form>
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
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [modal, setModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [companyActionModal, setCompanyActionModal] = useState(false);
  const [companyActionType, setCompanyActionType] = useState<
    "hold" | "takedown" | null
  >(null);
  const [companyActionConfirm, setCompanyActionConfirm] = useState("");
  const [companyActionLoading, setCompanyActionLoading] = useState(false);

  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;

  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;

  const role = profile?.role ? String(profile.role) : "";
  const displayRole = formatRoleWithCustom(role, profile?.customRole);
  const sectionClass =
    "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const displayName = profile?.name ? String(profile.name) : "User";
  const initialNotice = company?.noticePeriodDays
    ? Number(company.noticePeriodDays)
    : 30;
  const [noticePeriodDays, setNoticePeriodDays] =
    useState<number>(initialNotice);
  const [savingPolicy, setSavingPolicy] = useState(false);
  // WFH settings (admin)
  const [wfhDates, setWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [wfhMode, setWfhMode] = useState<"all-day" | "wfh-only">("all-day");
  const [wfhLoading, setWfhLoading] = useState(false);
  const [showWfhModal, setShowWfhModal] = useState(false);
  const managerTeams = Array.isArray(
    (insights?.manager as AnyRecord | undefined)?.teams,
  )
    ? ((insights?.manager as AnyRecord).teams as AnyRecord[])
    : [];
  const companyMembers = Array.isArray(
    (insights?.hr as AnyRecord | undefined)?.members,
  )
    ? (((insights?.hr as AnyRecord).members as AnyRecord[]) ?? [])
    : [];
  const profileId = String(profile?._id ?? profile?.id ?? "");
  const approvedMembersBesidesAdmin = companyMembers.filter((member) => {
    const memberId = String(member?._id ?? member?.id ?? "");
    return memberId !== profileId;
  }).length;
  const canUseEmptyCompanyControls =
    role === "admin" && Boolean(company) && approvedMembersBesidesAdmin === 0;

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

  async function savePolicy() {
    try {
      setSavingPolicy(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ noticePeriodDays }),
      });
      showToast("Policy updated.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update policy.",
        "error",
      );
    } finally {
      setSavingPolicy(false);
    }
  }

  async function executeCompanyAction() {
    if (
      String(companyActionConfirm ?? "")
        .trim()
        .toUpperCase() !== "CONFIRM"
    ) {
      showToast("Type Confirm to confirm.", "error");
      return;
    }

    if (!companyActionType) return;
    setCompanyActionLoading(true);
    try {
      const endpoint =
        companyActionType === "hold"
          ? "/api/company/hold-freeze"
          : "/api/company/takedown";
      await apiFetch(endpoint, { method: "POST" });
      showToast(
        companyActionType === "hold"
          ? "Hold & Freeze request submitted."
          : "TakeDown request submitted.",
      );
      setCompanyActionModal(false);
      setCompanyActionConfirm("");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Unable to complete company action.",
        "error",
      );
    } finally {
      setCompanyActionLoading(false);
    }
  }

  async function loadWfh() {
    if (!company) return;
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhDates: any[]; wfhCheckInMode: string }>(
        "/api/company/wfh",
      );
      const mapped = Array.isArray(res.wfhDates)
        ? res.wfhDates.map((item: any) => {
          if (item && typeof item === "object") {
            return {
              date: String(item.date),
              reason: item.reason ? String(item.reason) : ""
            };
          }
          return { date: String(item), reason: "" };
        })
        : [];
      setWfhDates(mapped);
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
    } catch (err) {
      // ignore
    } finally {
      setWfhLoading(false);
    }
  }

  useEffect(() => {
    void loadWfh();
  }, [company?.id]);

  async function removeWfhDate(date: string) {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhDates: any[]; wfhCheckInMode: string }>(
        "/api/company/wfh",
        { method: "DELETE", body: JSON.stringify({ date }) },
      );
      const mapped = Array.isArray(res.wfhDates)
        ? res.wfhDates.map((item: any) => {
          if (item && typeof item === "object") {
            return {
              date: String(item.date),
              reason: item.reason ? String(item.reason) : ""
            };
          }
          return { date: String(item), reason: "" };
        })
        : [];
      setWfhDates(mapped);
      showToast("WFH date removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove WFH date", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  async function updateWfhMode(mode: "all-day" | "wfh-only") {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhCheckInMode: string }>("/api/company/wfh", {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      });
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      showToast("WFH mode updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update mode", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={sectionClass}>
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
            <Row label="Role" value={displayRole || undefined} />
            <Row
              label="Company"
              value={company?.name ? String(company.name) : undefined}
            />
            <Row
              label="Notice Period"
              value={
                company?.noticePeriodDays
                  ? `${Number(company.noticePeriodDays)} day${Number(company.noticePeriodDays) === 1 ? "" : "s"}`
                  : undefined
              }
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
              label="Joined By HR"
              value={(() => {
                const safeRole = String(profile?.role ?? "");
                if (
                  ![
                    "employee",
                    "project-manager",
                    "qa-tester",
                    "others",
                  ].includes(safeRole)
                )
                  return undefined;
                const history = Array.isArray(profile?.membershipHistory)
                  ? (profile?.membershipHistory as AnyRecord[])
                  : [];
                const lastJoin = [...history]
                  .reverse()
                  .find(
                    (entry) => String(entry?.action ?? "") === "joined-company",
                  );
                const inviter =
                  lastJoin &&
                    typeof (lastJoin as AnyRecord)?.inviter === "object"
                    ? ((lastJoin as AnyRecord).inviter as AnyRecord)
                    : null;
                const inviterRole = inviter?.role ? String(inviter.role) : "";
                if (!inviter?.name || inviterRole !== "human-resource")
                  return undefined;
                return String(inviter.name);
              })()}
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

        {role === "human-resource" && profile?.companyStatus === "approved" ? (
          <section className={sectionClass}>
            <h3 className="text-lg font-semibold">Policy</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure notice period for your company.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label
                className="text-xs font-semibold uppercase text-slate-500"
                htmlFor="notice-period"
              >
                Notice period
              </label>
              <span> current notice period:{noticePeriodDays}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                id="notice-period"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
              >
                <option value={5}>5 days</option>
                <option value={15}>15 days</option>
                <option value={30}>30 days</option>
                <option value={45}>45 days</option>
                <option value={60}>2 months (60 days)</option>
                <option value={90}>3 months (90 days)</option>
              </select>
              <button
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={savingPolicy}
                type="button"
                onClick={() => void savePolicy()}
              >
                {savingPolicy ? "Saving..." : "Save policy"}
              </button>
            </div>
          </section>
        ) : null}

        {canUseEmptyCompanyControls ? (
          <section className={sectionClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Company controls</h3>
                <p className="mt-1 text-sm text-slate-500">
                  No approved members besides you remain in the company. Use
                  these controls carefully.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-lg border border-amber-200 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-200"
                onClick={() => {
                  setCompanyActionType("hold");
                  setCompanyActionModal(true);
                }}
              >
                Hold & Freeze Company
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-200 bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-200"
                onClick={() => {
                  setCompanyActionType("takedown");
                  setCompanyActionModal(true);
                }}
              >
                TakeDown Company
              </button>
            </div>
          </section>
        ) : null}

        {role === "admin" && company?.joinCode ? (
          <>
            <CodePanel
              title="HR Onboarding"
              code={String(company.joinCode)}
              label="HR code"
              empty="Register a company to generate an HR onboarding code."
              showToast={showToast}
            />

            <section className={sectionClass}>
              <h3 className="text-lg font-semibold">Work From Home (WFH) Settings</h3>
              <p className="mt-1 text-sm text-slate-500">Configure company-wide Work From Home dates and check-in behavior.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase text-slate-500">Assigned WFH Dates</label>
                    <button
                      onClick={() => setShowWfhModal(true)}
                      className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition"
                      type="button"
                    >
                      Assign WFH
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {wfhDates.length === 0 ? (
                      <p className="text-sm text-slate-500">No WFH dates set.</p>
                    ) : (
                      wfhDates.map((wfh) => (
                        <div key={wfh.date} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{new Date(wfh.date).toLocaleDateString()}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (wfh.date) {
                                    const iso = new Date(wfh.date).toISOString().slice(0, 10);
                                    navigator.clipboard.writeText(iso);
                                    showToast("WFH date copied.");
                                  }
                                }}
                                className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                type="button"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => removeWfhDate(wfh.date)}
                                disabled={wfhLoading}
                                className="rounded-lg border border-rose-200 px-2 py-0.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          {wfh.reason && (
                            <p className="text-xs text-slate-500 border-t border-slate-200/60 pt-1 leading-relaxed">
                              Reason: {wfh.reason}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Check-in behavior</label>
                  <p className="mt-1 text-sm text-slate-500">Choose when the check-in button should be enabled.</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input id="mode-all" name="wfh-mode" type="radio" checked={wfhMode === 'all-day'} onChange={() => setWfhMode('all-day')} />
                      <label htmlFor="mode-all" className="text-sm">Enable check-in all days</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="mode-wfh" name="wfh-mode" type="radio" checked={wfhMode === 'wfh-only'} onChange={() => setWfhMode('wfh-only')} />
                      <label htmlFor="mode-wfh" className="text-sm">Enable check-in only on WFH days</label>
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => updateWfhMode(wfhMode)}
                        disabled={wfhLoading}
                        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        type="button"
                      >
                        Save mode
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
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
                        ...(otherCode
                          ? [{ code: otherCode, label: "Others code" }]
                          : []),
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
                                  showToast(
                                    `${teamName} ${item.label.toLowerCase()} copied.`,
                                  );
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
                              showToast(
                                `${teamName} ${item.label.toLowerCase()} join URL copied.`,
                              );
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

        <section className={sectionClass}>
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

      {companyActionModal && companyActionType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {companyActionType === "hold"
                ? "Hold & Freeze Company?"
                : "TakeDown Company?"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This action requires typing{" "}
              <span className="font-semibold">Confirm</span> before it will
              proceed.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {companyActionType === "hold"
                ? "Freezing a company preserves its settings and prevents new activity."
                : "Taking down a company marks it for removal and locks access."}
            </p>

            <input
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
              placeholder="Type Confirm"
              value={companyActionConfirm}
              onChange={(e) => setCompanyActionConfirm(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setCompanyActionModal(false);
                  setCompanyActionConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  String(companyActionConfirm ?? "")
                    .trim()
                    .toUpperCase() !== "CONFIRM" || companyActionLoading
                }
                onClick={executeCompanyAction}
              >
                {companyActionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWfhModal && (
        <WfhAssignModal
          onClose={() => setShowWfhModal(false)}
          onRefresh={(dates) => setWfhDates(dates)}
          showToast={showToast}
        />
      )}
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
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const selfId = String(session?.user?.id ?? "");
  const hrSuffix = selfId
    ? `-HR${selfId
      .replace(/[^a-fA-F0-9]/g, "")
      .toUpperCase()
      .slice(-6)}`
    : "";
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
  const companyMembers = Array.isArray(insights?.companyMembers)
    ? (insights.companyMembers as AnyRecord[])
    : [];
  const replacementHrCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return (
      id && id !== selfId && String(member.role ?? "") === "human-resource"
    );
  });
  const replacementRoleCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return id && id !== selfId && String(member.role ?? "") === String(role);
  });
  const pendingQuitNotice =
    (insights?.pendingQuitNotice as AnyRecord | undefined) ?? null;
  const [hrQuitModal, setHrQuitModal] = useState(false);
  const [replacementHrId, setReplacementHrId] = useState("");
  const [roleQuitModal, setRoleQuitModal] = useState(false);
  const [replacementRoleUserId, setReplacementRoleUserId] = useState("");
  const [requestingHrQuit, setRequestingHrQuit] = useState(false);
  const [requestingRoleQuit, setRequestingRoleQuit] = useState(false);
  const [cancelQuitModal, setCancelQuitModal] = useState(false);
  const [cancelQuitReason, setCancelQuitReason] = useState("");
  const [cancellingQuit, setCancellingQuit] = useState(false);
  const [cancelJoinModal, setCancelJoinModal] = useState(false);
  const [cancelJoinConfirmText, setCancelJoinConfirmText] = useState("");
  const [cancellingJoin, setCancellingJoin] = useState(false);
  const teamLimit = role === "human-resource" ? 2 : 5;
  const canCreateMoreTeams = managerTeams.length < teamLimit;
  const companyJoinStatus = profile?.companyStatus
    ? String(profile.companyStatus)
    : "none";
  const teamJoinStatus = profile?.teamStatus
    ? String(profile.teamStatus)
    : "none";
  const pendingJoinStatus =
    companyJoinStatus === "pending" || teamJoinStatus === "pending"
      ? "pending"
      : teamJoinStatus !== "none"
        ? teamJoinStatus
        : companyJoinStatus;

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
    try {
      await apiFetch("/api/company/join", {
        method: "POST",
        body: JSON.stringify({ code: companyCode }),
      });
      showToast("Join request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send join request.",
        "error",
      );
    }
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMoreTeams) {
      showToast(
        `Team limit reached. ${role === "human-resource" ? "HR" : "Managers"} can create up to ${teamLimit} teams.`,
        "error",
      );
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
    showToast("Quit request sent.");
    await refresh();
  }

  async function requestHrQuit() {
    if (!replacementHrId) {
      showToast("Please select a replacement HR.", "error");
      return;
    }
    try {
      setRequestingHrQuit(true);
      await apiFetch("/api/company/quit", {
        method: "POST",
        body: JSON.stringify({ replacementHrId }),
      });
      setHrQuitModal(false);
      setReplacementHrId("");
      showToast("HR quit request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request quit.",
        "error",
      );
    } finally {
      setRequestingHrQuit(false);
    }
  }

  async function requestRoleQuit() {
    if (!replacementRoleUserId) {
      showToast("Please select a replacement first.", "error");
      return;
    }
    try {
      setRequestingRoleQuit(true);
      await apiFetch("/api/company/quit", {
        method: "POST",
        body: JSON.stringify({ replacementUserId: replacementRoleUserId }),
      });
      setRoleQuitModal(false);
      setReplacementRoleUserId("");
      showToast("Quit request sent to HR.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request quit.",
        "error",
      );
    } finally {
      setRequestingRoleQuit(false);
    }
  }

  function pendingQuitText(defaultText: string): string {
    if (!insights?.pendingQuit) return defaultText;
    const remaining = Number(pendingQuitNotice?.remainingDays ?? 0);
    return `Requested to Quit${remaining > 0 ? ` (${remaining} day${remaining === 1 ? "" : "s"} left)` : " (notice completed)"}`;
  }

  async function cancelQuitRequest() {
    const reason = String(cancelQuitReason ?? "").trim();
    if (!reason) {
      showToast("Reason is required.", "error");
      return;
    }
    try {
      setCancellingQuit(true);
      await apiFetch("/api/quit/cancel", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setCancelQuitModal(false);
      setCancelQuitReason("");
      showToast("Quit request cancelled.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to cancel request.",
        "error",
      );
    } finally {
      setCancellingQuit(false);
    }
  }

  async function cancelJoinRequest() {
    if (
      String(cancelJoinConfirmText ?? "")
        .trim()
        .toUpperCase() !== "CANCEL"
    ) {
      showToast("Type CANCEL to confirm.", "error");
      return;
    }
    try {
      setCancellingJoin(true);
      await apiFetch("/api/join/cancel", {
        method: "POST",
      });
      setCancelJoinModal(false);
      setCancelJoinConfirmText("");
      showToast("Join request cancelled.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to cancel request.",
        "error",
      );
    } finally {
      setCancellingJoin(false);
    }
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
    try {
      const normalizedCode = String(teamCode ?? "")
        .trim()
        .toUpperCase();
      if (!normalizedCode) {
        showToast("Enter a join code first.", "error");
        return;
      }

      if (normalizedCode.startsWith("CO-")) {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "admin" }>(
          "/api/company/join",
          {
            method: "POST",
            body: JSON.stringify({ code: normalizedCode }),
          },
        );
        showToast(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR."
            : "Join request sent to admin.",
        );
      } else if (normalizedCode.startsWith("TM-")) {
        const data = await apiFetch<{
          approvalNotifier?: "hr" | "manager" | "tester";
        }>("/api/team/join", {
          method: "POST",
          body: JSON.stringify({ code: normalizedCode }),
        });
        showToast(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR."
            : data.approvalNotifier === "tester"
              ? "Join request sent to tester."
              : "Join request sent to manager.",
        );
      } else {
        showToast("Invalid join code. Use a CO- or TM- code.", "error");
        return;
      }

      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send join request.",
        "error",
      );
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {role === "admin" ? (
        <CodePanel
          title="HR Onboarding"
          code={company?.joinCode ? String(company.joinCode) : undefined}
          label="HR code"
          empty="Register a company to generate an HR onboarding code."
          showToast={showToast}
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

      {role === "human-resource" ? (
        profile?.companyStatus === "approved" ? (
          <>
            <CodePanel
              title="HR Staff Onboarding"
              code={undefined}
              label="Staff code"
              showToast={showToast}
              secondaryCodes={
                [
                  company?.managerJoinCode
                    ? {
                      code: `${String(company.managerJoinCode)}${hrSuffix}`,
                      label: "Manager code",
                    }
                    : null,
                  company?.testerJoinCode
                    ? {
                      code: `${String(company.testerJoinCode)}${hrSuffix}`,
                      label: "Tester code",
                    }
                    : null,
                  company?.employeeJoinCode
                    ? {
                      code: `${String(company.employeeJoinCode)}${hrSuffix}`,
                      label: "Employee code",
                    }
                    : null,
                  company?.otherJoinCode
                    ? {
                      code: `${String(company.otherJoinCode)}${hrSuffix}`,
                      label: "Others code",
                    }
                    : null,
                ].filter(Boolean) as { code: string; label: string }[]
              }
              empty="Generating HR staff onboarding codes. Refresh once if they do not appear."
            />
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">HR Membership</h3>
              <p className="mt-1 text-sm text-slate-500">
                To quit, nominate another approved HR. Approval goes to admin.
              </p>
              <button
                className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  Boolean(insights?.pendingQuit) ||
                  replacementHrCandidates.length === 0
                }
                type="button"
                onClick={() => setHrQuitModal(true)}
              >
                {pendingQuitText("Request Quit Company")}
              </button>
              {insights?.pendingQuit ? (
                <button
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setCancelQuitModal(true)}
                >
                  Cancel Request
                </button>
              ) : null}
              {replacementHrCandidates.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Another approved HR is required before you can quit.
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <JoinPanel
            title="Join company as HR"
            placeholder="HR company code"
            value={companyCode}
            onChange={setCompanyCode}
            onSubmit={joinCompany}
            status={
              profile?.companyStatus ? String(profile.companyStatus) : undefined
            }
            onCancelRequest={() => setCancelJoinModal(true)}
          />
        )
      ) : null}

      {hrQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setHrQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Quit company (HR)</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Select replacement HR before submitting quit request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setHrQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Replacement HR
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={replacementHrId}
                onChange={(e) => setReplacementHrId(e.target.value)}
              >
                <option value="">Select HR</option>
                {replacementHrCandidates.map((member) => (
                  <option key={String(member.id)} value={String(member.id)}>
                    {String(member.name ?? "HR")} ({String(member.email ?? "")})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setHrQuitModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!replacementHrId || requestingHrQuit}
                type="button"
                onClick={() => void requestHrQuit()}
              >
                {requestingHrQuit ? "Submitting..." : "Submit quit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {roleQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRoleQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">
                  Quit company ({formatRole(String(role))})
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Assign another approved {formatRole(String(role))} before
                  quitting.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setRoleQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Replacement
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={replacementRoleUserId}
                onChange={(e) => setReplacementRoleUserId(e.target.value)}
              >
                <option value="">Select replacement</option>
                {replacementRoleCandidates.map((member) => (
                  <option key={String(member.id)} value={String(member.id)}>
                    {String(member.name ?? "Member")} (
                    {String(member.email ?? "")})
                  </option>
                ))}
              </select>
              {replacementRoleCandidates.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No approved replacement available with this role.
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setRoleQuitModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!replacementRoleUserId || requestingRoleQuit}
                type="button"
                onClick={() => void requestRoleQuit()}
              >
                {requestingRoleQuit ? "Submitting..." : "Submit quit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCancelQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Cancel quit request</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Tell the approver why you are cancelling this request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setCancelQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              className="mt-4 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Reason for cancelling quit request"
              value={cancelQuitReason}
              onChange={(event) => setCancelQuitReason(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setCancelQuitModal(false)}
              >
                Keep request
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  !String(cancelQuitReason ?? "").trim() || cancellingQuit
                }
                type="button"
                onClick={() => void cancelQuitRequest()}
              >
                {cancellingQuit ? "Cancelling..." : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelJoinModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCancelJoinModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Cancel join request</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Type CANCEL to confirm you want to remove this pending join
                  request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setCancelJoinModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <input
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
              placeholder="Type CANCEL"
              value={cancelJoinConfirmText}
              onChange={(event) => setCancelJoinConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setCancelJoinModal(false)}
              >
                Keep request
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  String(cancelJoinConfirmText ?? "")
                    .trim()
                    .toUpperCase() !== "CANCEL" || cancellingJoin
                }
                type="button"
                onClick={() => void cancelJoinRequest()}
              >
                {cancellingJoin ? "Cancelling..." : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {["project-manager", "qa-tester", "human-resource"].includes(role) ? (
        profile?.companyStatus === "approved" ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">
                {role === "human-resource"
                  ? "HR Team Management"
                  : "Manager Membership"}
              </h3>

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
                        ? `${managerTeams.length}/${teamLimit}`
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
                    Team limit reached ({managerTeams.length}/{teamLimit}).
                  </p>
                )}

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {role === "human-resource" ? "HR" : "Managers"} can create up
                  to {teamLimit} teams. Current: {managerTeams.length}/
                  {teamLimit}
                </p>
                <button
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={() => setRoleQuitModal(true)}
                  type="button"
                >
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? (
                  <button
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setCancelQuitModal(true)}
                    type="button"
                  >
                    Cancel Request
                  </button>
                ) : null}
              </div>
            </section>

            {role === "human-resource" && managerTeams.length > 0 ? (
              <section className="rounded-lg border overflow-y-auto max-h-[500px] border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={18} />
                  <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
                    HR Team Onboarding
                  </h3>
                </div>
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
                          ...(otherCode
                            ? [{ code: otherCode, label: "Others code" }]
                            : []),
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
                                    showToast(
                                      `${teamName} ${item.label.toLowerCase()} copied.`,
                                    );
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
                                showToast(
                                  `${teamName} ${item.label.toLowerCase()} join URL copied.`,
                                );
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
              </section>
            ) : null}

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
              onCancelRequest={() => setCancelJoinModal(true)}
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
        companyJoinStatus === "approved" ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Membership</h3>

              <p className="mt-1 text-sm text-slate-500">
                You are currently approved in this company.
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
                      Company {String(profile?.companyStatus)}
                    </span>
                  </div>
                </div>

                {teamJoinStatus === "approved" ? (
                  <button
                    className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(insights?.pendingQuit)}
                    onClick={requestEmployeeQuit}
                  >
                    {pendingQuitText("Request Team Quit")}
                  </button>
                ) : null}
                <button
                  className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={requestManagerQuit}
                >
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? (
                  <button
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setCancelQuitModal(true)}
                    type="button"
                  >
                    Cancel Request
                  </button>
                ) : null}
              </div>
            </section>
            {teamJoinStatus !== "approved" ? (
              <JoinPanel
                title="Join team using code"
                placeholder="TM-... code"
                value={teamCode}
                onChange={setTeamCode}
                onSubmit={joinTeam}
                status={teamJoinStatus === "none" ? undefined : teamJoinStatus}
                onCancelRequest={() => setCancelJoinModal(true)}
              />
            ) : null}
            <HistoryCard
              title="Membership History"
              rows={toEmployeeHistoryRows(insights)}
              hint="Company/team switches and removals."
            />
          </>
        ) : (
          <>
            <JoinPanel
              title="Join using code"
              placeholder="CO-... or TM-... code"
              value={teamCode}
              onChange={setTeamCode}
              onSubmit={joinTeam}
              status={pendingJoinStatus}
              onCancelRequest={() => setCancelJoinModal(true)}
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
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  function requestIdOf(request: AnyRecord) {
    const value = request.id ?? request._id;
    return value ? String(value) : "";
  }

  function quitNoticeInfo(request: AnyRecord) {
    if (String(request.kind) === "quit-company-board-transfer") {
      return {
        noticeDays: 0,
        elapsedDays: 0,
        remainingDays: 0,
        canApprove: true,
      };
    }
    if (!String(request.kind ?? "").startsWith("quit-")) return null;
    const noticeDays = Number(
      (request.company as AnyRecord | undefined)?.noticePeriodDays ?? 0,
    );
    if (!Number.isFinite(noticeDays) || noticeDays <= 0) {
      return {
        noticeDays: 0,
        elapsedDays: 0,
        remainingDays: 0,
        canApprove: true,
      };
    }
    const createdAt = request.createdAt
      ? new Date(String(request.createdAt))
      : new Date();
    const elapsedDays = Math.max(
      0,
      Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const remainingDays = Math.max(0, noticeDays - elapsedDays);
    return {
      noticeDays,
      elapsedDays,
      remainingDays,
      canApprove: remainingDays === 0,
    };
  }

  async function decide(
    id: string,
    status: "approved" | "rejected",
    force = false,
  ) {
    if (!id) return;
    await apiFetch(`/api/approvals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, force }),
    });
    showToast(`Request ${status}${force ? " (forced)" : ""}.`);
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
                {String(request.kind) === "quit-company-board-transfer"
                  ? "requested board transfer approval"
                  : String(request.kind).startsWith("quit-")
                  ? "requested to quit"
                  : "requested to join"}{" "}
                {request.kind === "team" || request.kind === "quit-team"
                  ? displayNested(request.team, "name", "team")
                  : displayNested(request.company, "name", "company")}
              </p>
              {String(request.kind) === "quit-company-board-transfer" ? (
                <p className="mt-1 text-xs text-slate-500">
                  {String(request.message ?? "").trim() || "Board transfer approval pending."}
                </p>
              ) : String(request.kind).startsWith("quit-") ? (
                <p className="mt-1 text-xs text-slate-500">
                  {(() => {
                    const info = quitNoticeInfo(request);
                    if (!info || info.noticeDays <= 0)
                      return "No notice period set.";
                    return `Notice period: ${info.noticeDays} days. Pending: ${info.elapsedDays} days. Remaining: ${info.remainingDays} days.`;
                  })()}
                </p>
              ) : null}
              {request.kind === "quit-company" && request.replacementHr ? (
                <p className="mt-1 text-xs text-slate-500">
                  Replacement HR:{" "}
                  {displayNested(request.replacementHr, "name", "HR")}
                </p>
              ) : null}
              {request.replacementUser ? (
                <p className="mt-1 text-xs text-slate-500">
                  Replacement:{" "}
                  {displayNested(request.replacementUser, "name", "Member")}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                onClick={() => decide(requestIdOf(request), "rejected")}
              >
                Decline
              </button>
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={(() => {
                  const info = quitNoticeInfo(request);
                  return !!info && !info.canApprove;
                })()}
                onClick={() => decide(requestIdOf(request), "approved")}
              >
                Approve
              </button>
              {String(request.kind).startsWith("quit-") ? (
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  onClick={() => decide(requestIdOf(request), "approved", true)}
                  type="button"
                >
                  Force accept
                </button>
              ) : null}
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

const MEETING_DURATION_OPTIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
] as const;

const HR_MEMBER_ROLE_KEYS = [
  "human-resource",
  "project-manager",
  "qa-tester",
  "employee",
  "others",
] as const;

function MembersTab({
  insights,
  actorRole,
  showToast,
  refresh,
}: {
  insights: AnyRecord | null;
  actorRole: string;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: (silent?: boolean) => Promise<void>;
}) {
  const { data: session } = useSession();
  const selfId = session?.user?.id ?? "";
  const hr = (insights?.hr as AnyRecord | undefined) ?? null;
  const members = Array.isArray(hr?.members) ? (hr.members as AnyRecord[]) : [];
  const roleCounts = (hr?.roleCounts as AnyRecord | undefined) ?? {};
  const [modalRole, setModalRole] = useState<
    (typeof HR_MEMBER_ROLE_KEYS)[number] | null
  >(null);
  const [meetingDuration, setMeetingDuration] = useState<number>(30);
  const [invitingFor, setInvitingFor] = useState<string | null>(null);
  const [firingFor, setFiringFor] = useState<string | null>(null);
  const [fireConfirmMember, setFireConfirmMember] = useState<AnyRecord | null>(
    null,
  );
  const [fireConfirmText, setFireConfirmText] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [selectedOtherRole, setSelectedOtherRole] = useState("all");

  const otherRoleOptions = useMemo(() => {
    const labels = new Set<string>();
    members
      .filter((member) => String(member.role ?? "") === "others")
      .forEach((member) => {
        const value = String(member.customRole ?? "").trim();
        if (value) labels.add(value);
      });
    return Array.from(labels).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [members]);

  const otherRoleSelectOptions = useMemo(() => {
    const labels = new Set<string>(otherRoleOptions);
    [
      "Intern",
      "Trainee",
      "Junior Employee",
      "Employee",
      "Manager",
      "Tester",
      "Junior HR",
    ].forEach((label) => labels.add(label));
    return Array.from(labels).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [otherRoleOptions]);

  useEffect(() => {
    if (modalRole !== "others") {
      setSelectedOtherRole("all");
      return;
    }

    if (
      selectedOtherRole !== "all" &&
      !otherRoleOptions.includes(selectedOtherRole)
    ) {
      setSelectedOtherRole(otherRoleOptions[0] ?? "all");
    }
  }, [modalRole, otherRoleOptions, selectedOtherRole]);

  useEffect(() => {
    if (!modalRole) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModalRole(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalRole]);

  const canEditOthersRole = actorRole === "human-resource";

  const modalMembers = modalRole
    ? members.filter((m) => {
      if (String(m.role ?? "") !== modalRole) return false;
      if (modalRole === "others" && selectedOtherRole !== "all") {
        return String(m.customRole ?? "").trim() === selectedOtherRole;
      }
      return true;
    })
    : [];

  async function sendMeetingInvite(memberId: string) {
    try {
      setInvitingFor(memberId);
      await apiFetch("/api/hr/meeting-invite", {
        method: "POST",
        body: JSON.stringify({ memberId, durationMinutes: meetingDuration }),
      });
      showToast("Meeting invite sent.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not send invite.",
        "error",
      );
    } finally {
      setInvitingFor(null);
    }
  }

  function requestFire(member: AnyRecord) {
    setFireConfirmText("");
    setFireConfirmMember(member);
  }

  async function confirmFire() {
    const member = fireConfirmMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    if (
      String(fireConfirmText ?? "")
        .trim()
        .toUpperCase() !== "FIRE"
    ) {
      showToast("Type FIRE to confirm.", "error");
      return;
    }
    try {
      setFiringFor(memberId);
      await apiFetch("/api/hr/fire", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      showToast("Member removed.");
      setFireConfirmMember(null);
      setModalRole(null);
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not remove member.",
        "error",
      );
    } finally {
      setFiringFor(null);
    }
  }

  function displayMemberRole(member: AnyRecord) {
    return formatRoleWithCustom(
      String(member.role ?? "employee"),
      member.customRole,
    );
  }

  function roleDraftFor(member: AnyRecord) {
    const memberId = String(member.id ?? "");
    if (roleDrafts[memberId] !== undefined) return roleDrafts[memberId];
    return String(member.customRole ?? "");
  }

  async function saveCustomRole(member: AnyRecord) {
    if (!canEditOthersRole) {
      showToast("Only HR can update role labels.", "error");
      return;
    }

    const memberId = String(member.id ?? "");
    if (!memberId) return;
    try {
      setSavingRoleFor(memberId);
      await apiFetch("/api/hr/member-role", {
        method: "PATCH",
        body: JSON.stringify({
          memberId,
          customRole: roleDraftFor(member),
        }),
      });
      showToast("Role label updated.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update role label.",
        "error",
      );
    } finally {
      setSavingRoleFor(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Members</h3>
          <p className="mt-1 text-sm text-slate-500">
            Click a role to view people and send a meeting invite. Invites
            notify the member in Notifications.
          </p>
          {actorRole === "admin" ? (
            <p className="mt-1 text-xs text-slate-400">
              Admin view uses the same member tools as HR.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Total members
          </p>
          <p className="text-2xl font-semibold">
            {Number(hr?.totalMembers ?? members.length)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {HR_MEMBER_ROLE_KEYS.map((roleName) => {
          const count = Number(roleCounts[roleName] ?? 0);
          return (
            <button
              className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              key={roleName}
              type="button"
              onClick={() => {
                setModalRole(roleName);
                setMeetingDuration(30);
              }}
            >
              <p className="text-xs font-medium text-slate-500">
                {formatRole(roleName)}
              </p>
              <p className="text-lg font-semibold">{count}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
            </button>
          );
        })}
      </div>

      {members.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
          No approved company members yet.
        </p>
      ) : null}

      {modalRole ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalRole(null);
          }}
        >
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="members-modal-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h4 className="text-xl font-semibold" id="members-modal-title">
                  {formatRole(modalRole)}
                </h4>
                <p className="text-sm text-slate-500">
                  {modalMembers.length} member
                  {modalMembers.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="min-w-[260px]">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Meeting Time In
                  </p>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(Number(e.target.value))}
                  >
                    {MEETING_DURATION_OPTIONS.map((opt) => (
                      <option key={opt.minutes} value={opt.minutes}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  aria-label="Close"
                  className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  type="button"
                  onClick={() => setModalRole(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {modalRole === "others" ? (
              <div className="border-b border-slate-100 px-6 py-4">
                <label
                  className="text-xs font-semibold uppercase text-slate-500"
                  htmlFor="others-role-filter"
                >
                  Filter others by label
                </label>
                <select
                  id="others-role-filter"
                  className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={selectedOtherRole}
                  onChange={(e) => setSelectedOtherRole(e.target.value)}
                >
                  <option value="all">All others</option>
                  {otherRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="max-h-[min(55vh,420px)] overflow-y-auto px-6 py-4">
              {modalMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No members in this role.
                </p>
              ) : (
                <ul className="space-y-4">
                  {modalMembers.map((member) => {
                    const memberId = String(member.id);
                    const teams = Array.isArray(member.teams)
                      ? member.teams.map(String)
                      : [];
                    const isSelf = selfId && memberId === selfId;
                    const joinedBy =
                      member.joinedBy && typeof member.joinedBy === "object"
                        ? (member.joinedBy as AnyRecord)
                        : null;
                    return (
                      <li
                        className="rounded-xl border border-slate-200 bg-white p-4"
                        key={memberId}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {String(member.name ?? "Member")}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              {String(member.email ?? "")}
                            </p>
                            {joinedBy?.name ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Joined by{" "}
                                <span className="font-medium text-slate-700">
                                  {String(joinedBy.name)}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          <div className="grid items-center gap-2">
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              role: {displayMemberRole(member)}
                            </span>
                            <span
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                              title={
                                teams.length
                                  ? teams.join(", ")
                                  : "No team joined"
                              }
                            >
                              team: {teams.length ? teams.join(", ") : "-"}
                            </span>
                          </div>

                          {String(member.role ?? "") === "others" &&
                            canEditOthersRole ? (
                            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Role label
                              </p>

                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input
                                  type="text"
                                  list={`roles-${memberId}`}
                                  placeholder="Select or enter custom role"
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                                  value={roleDraftFor(member)}
                                  onChange={(event) =>
                                    setRoleDrafts((current) => ({
                                      ...current,
                                      [memberId]: event.target.value,
                                    }))
                                  }
                                />

                                <datalist id={`roles-${memberId}`}>
                                  {otherRoleSelectOptions.map((option) => (
                                    <option key={option} value={option} />
                                  ))}

                                  {roleDraftFor(member) &&
                                    !otherRoleSelectOptions.includes(
                                      roleDraftFor(member),
                                    ) ? (
                                    <option value={roleDraftFor(member)} />
                                  ) : null}
                                </datalist>

                                <button
                                  className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={
                                    savingRoleFor === memberId ||
                                    !String(roleDraftFor(member)).trim()
                                  }
                                  type="button"
                                  onClick={() => void saveCustomRole(member)}
                                >
                                  {savingRoleFor === memberId
                                    ? "Saving..."
                                    : "Save role"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                            <button
                              className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!!isSelf || invitingFor === memberId}
                              type="button"
                              onClick={() => void sendMeetingInvite(memberId)}
                            >
                              {invitingFor === memberId
                                ? "Sending…"
                                : "Invite to meet"}
                            </button>
                            <button
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!!isSelf || firingFor === memberId}
                              type="button"
                              onClick={() => requestFire(member)}
                            >
                              {firingFor === memberId ? "Removing…" : "Fire"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {fireConfirmMember ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFireConfirmMember(null);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fire-modal-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h4
                  className="text-lg font-semibold text-rose-700"
                  id="fire-modal-title"
                >
                  Fire member
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  This will remove the member from the company, teams, and
                  boards.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setFireConfirmMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-800">
                  You are about to fire{" "}
                  <span className="font-extrabold">
                    {String(fireConfirmMember.name ?? "Member")}
                  </span>
                </p>
                <p className="mt-1 text-sm text-rose-700">
                  Type <span className="font-bold">FIRE</span> to confirm.
                </p>
              </div>

              <input
                className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Type FIRE to confirm"
                value={fireConfirmText}
                onChange={(e) => setFireConfirmText(e.target.value)}
              />

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setFireConfirmMember(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    firingFor === String(fireConfirmMember.id ?? "") ||
                    String(fireConfirmText ?? "")
                      .trim()
                      .toUpperCase() !== "FIRE"
                  }
                  type="button"
                  onClick={() => void confirmFire()}
                >
                  {firingFor === String(fireConfirmMember.id ?? "")
                    ? "Removing…"
                    : "Confirm fire"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MessagesTab({
  showToast,
}: {
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "bulk">("normal");
  const [chatMember, setChatMember] = useState<AnyRecord | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [sendingBulk, setSendingBulk] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    let mounted = true;
    apiFetch<{ members: AnyRecord[] }>("/api/messages")
      .then((result) => {
        if (mounted) setMembers(result.members ?? []);
      })
      .catch(() => {
        if (mounted) setMembers([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setChatMember(null);
    }
    if (!chatMember) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatMember]);

  const membersById = useMemo(() => {
    const map = new Map<string, AnyRecord>();
    members.forEach((m) => {
      const id = String(m.id ?? m._id ?? "");
      if (id) map.set(id, m);
    });
    return map;
  }, [members]);

  const bulkSelectedIds = useMemo(() => {
    return Object.keys(bulkSelected).filter(
      (id) => bulkSelected[id] && membersById.has(id),
    );
  }, [bulkSelected, membersById]);

  function toggleBulkSelected(memberId: string) {
    setBulkSelected((current) => ({
      ...current,
      [memberId]: !current[memberId],
    }));
  }

  async function sendChat() {
    const recipientId = String(chatMember?.id ?? chatMember?._id ?? "");
    const message = String(chatMessage ?? "").trim();
    if (!recipientId) return;
    if (!message) {
      showToast("Write a message first.", "error");
      return;
    }
    try {
      setSendingChat(true);
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId, message }),
      });
      setChatMessage("");
      setChatMember(null);
      showToast("Message sent.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send message.",
        "error",
      );
    } finally {
      setSendingChat(false);
    }
  }

  async function sendBulk() {
    const message = String(bulkMessage ?? "").trim();
    if (!message) {
      showToast("Write a message first.", "error");
      return;
    }
    if (bulkSelectedIds.length === 0) {
      showToast("Select at least one user.", "error");
      return;
    }
    try {
      setSendingBulk(true);
      await Promise.all(
        bulkSelectedIds.map((recipientId) =>
          apiFetch("/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipientId, message }),
          }),
        ),
      );
      setBulkMessage("");
      setBulkSelected({});
      showToast(`Message sent to ${bulkSelectedIds.length} user(s).`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send bulk message.",
        "error",
      );
    } finally {
      setSendingBulk(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Messages</h3>
          <p className="mt-1 text-sm text-slate-500">
            Send a message to anyone in your company.
          </p>
        </div>
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
          {members.length} members
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "normal"
              ? "bg-slate-950 text-white"
              : "text-slate-700 hover:bg-slate-50"
              }`}
            type="button"
            onClick={() => setMode("normal")}
          >
            Normal messages
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "bulk"
              ? "bg-slate-950 text-white"
              : "text-slate-700 hover:bg-slate-50"
              }`}
            type="button"
            onClick={() => setMode("bulk")}
          >
            Bulk messages
          </button>
        </div>

        {mode === "bulk" ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              Selected:{" "}
              <span className="font-semibold text-slate-900">
                {bulkSelectedIds.length}
              </span>
            </span>
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={bulkSelectedIds.length === 0}
              type="button"
              onClick={() => setBulkSelected({})}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {mode === "bulk" ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Bulk message</p>
          <p className="mt-1 text-sm text-slate-500">
            Write one message, then click users below to send.
          </p>
          <textarea
            className="mt-3 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Type your bulk message…"
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Tip: click user cards to select/unselect.
            </p>
            <button
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                sendingBulk ||
                bulkSelectedIds.length === 0 ||
                String(bulkMessage ?? "").trim().length === 0
              }
              type="button"
              onClick={() => void sendBulk()}
            >
              {sendingBulk ? "Sending…" : "Send to selected"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {members.map((member) => {
          const memberId = String(member.id ?? member._id ?? "");
          const name = String(member.name ?? "Member");
          const role = formatRole(String(member.role ?? "employee"));
          const email = String(member.email ?? "");
          const teamObj =
            member.team && typeof member.team === "object" ? member.team : null;
          const teamLabel =
            teamObj && (teamObj as any).name
              ? String((teamObj as any).name)
              : Array.isArray(member.teams) && member.teams.length
                ? member.teams.map(String).join(", ")
                : "No team joined";
          const isSelected = !!bulkSelected[memberId];

          return (
            <button
              className={`w-full rounded-lg border p-4 text-left transition ${mode === "bulk"
                ? isSelected
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              key={memberId}
              type="button"
              onClick={() => {
                if (mode === "bulk") {
                  toggleBulkSelected(memberId);
                } else {
                  setChatMember(member);
                  setChatMessage("");
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`font-semibold ${mode === "bulk" && isSelected ? "text-white" : "text-slate-900"}`}
                  >
                    {name}
                  </p>
                  <p
                    className={`text-sm ${mode === "bulk" && isSelected ? "text-white/70" : "text-slate-500"}`}
                  >
                    {email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${mode === "bulk" && isSelected
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-700"
                      }`}
                  >
                    {role}
                  </span>

                  <span
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${mode === "bulk" && isSelected
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                      }`}
                    title={teamLabel}
                  >
                    Team: {teamLabel}
                  </span>

                  {mode === "normal" ? (
                    <span className="inline-flex items-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                      Chat
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold ${isSelected
                        ? "bg-white text-slate-950"
                        : "bg-slate-950 text-white"
                        }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {!loading && members.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No other approved company members yet.
          </p>
        ) : null}
        {loading ? (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Loading company members...
          </p>
        ) : null}
      </div>

      {chatMember ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatMember(null);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-modal-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold" id="chat-modal-title">
                  Chat
                </h4>
                <p className="text-sm text-slate-500">
                  To{" "}
                  <span className="font-medium text-slate-900">
                    {String(chatMember.name ?? "Member")}
                  </span>{" "}
                  • {formatRole(String(chatMember.role ?? "employee"))}
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setChatMember(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              <textarea
                className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Type your message…"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setChatMember(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    sendingChat || String(chatMessage ?? "").trim().length === 0
                  }
                  type="button"
                  onClick={() => void sendChat()}
                >
                  {sendingChat ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
                  <p className="text-sm">
                    {String(item.body || item.message || "")}
                  </p>
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
  showToast,
  children,
}: {
  title: string;
  code?: string;
  label: string;
  secondaryCodes?: { code: string; label: string }[];
  empty: string;
  showToast?: (text: string, type?: "success" | "error") => void;
  children?: ReactNode;
}) {
  const makeJoinUrl = (value: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${value}`
      : value;
  const codes = [code ? { code, label } : null, ...secondaryCodes].filter(
    Boolean,
  ) as { code: string; label: string }[];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Building2 size={18} />
        <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h3>
      </div>
      {codes.length > 0 ? (
        <>
          <div
            className={
              codes.length > 1 ? "grid gap-3 md:grid-cols-2" : "space-y-3"
            }
          >
            {codes.map((item) => (
              <div key={item.code}>
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
                      onClick={() => {
                        navigator.clipboard.writeText(item.code);
                        showToast?.(`${item.label} copied.`);
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
                    navigator.clipboard.writeText(makeJoinUrl(item.code));
                    showToast?.(`${item.label} join URL copied.`);
                  }}
                  type="button"
                >
                  <Users size={16} />
                  Copy {item.label} Join URL
                </button>
              </div>
            ))}
          </div>
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
  onCancelRequest,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  status?: string;
  onCancelRequest?: () => void;
}) {
  const isPending = String(status ?? "") === "pending";
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
        <button
          className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? "Requested" : "Request approval"}
        </button>
      </form>
      {isPending && onCancelRequest ? (
        <button
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={onCancelRequest}
        >
          Cancel Request
        </button>
      ) : null}
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

function formatRole(role: string) {
  const labels: Record<string, string> = {
    "human-resource": "Human Resource",
    "project-manager": "Project Manager",
    "qa-tester": "Q-A Tester",
    employee: "Employee",
    admin: "Admin",
    others: "Others",
  };
  return labels[role] ?? role;
}

function formatRoleWithCustom(role: string, customRole: unknown) {
  const baseRole = formatRole(role);
  const label = String(customRole ?? "").trim();
  if (role === "others" && label) return `${baseRole} | ${label}`;
  return baseRole;
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
function loadData() {
  throw new Error("Function not implemented.");
}

function showToast(arg0: string, p0: string) {
  throw new Error("Function not implemented.");
}
