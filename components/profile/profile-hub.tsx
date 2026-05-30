"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, CheckCircle2, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { ProfileSkeleton, NavButton } from "./profile-hub/chrome";
import { AttendanceTab } from "./profile-hub/attendance-tab";
import { ApprovalsTab, MembersTab, MessagesTab, NotificationsTab } from "./profile-hub/admin-tabs";
import { FinanceTab } from "./profile-hub/finance-tab";
import { OnboardingTab, ProfileTab, TimelineTab } from "./profile-hub/profile-tabs";
import { AnyRecord, AvatarBadge, formatRoleWithCustom } from "./profile-hub/shared";


export type Tab =
  | "profile"
  | "timeline"
  | "onboarding"
  | "members"
  | "messages"
  | "approvals"
  | "notifications"
  | "finance"
  | "attendance";


export function ProfileHub() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const routeTab = (Array.isArray(params?.tab) ? params.tab[0] : params?.tab) as Tab | undefined;
  
  const [tab, setTabState] = useState<Tab>(routeTab || "profile");
  
  useEffect(() => {
    if (routeTab && routeTab !== tab) {
      setTabState(routeTab);
    }
  }, [routeTab]);

  const setTab = (newTab: Tab) => {
    setTabState(newTab);
    window.history.pushState(null, "", `/profile/${newTab}`);
  };

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
  const [wfhRequests, setWfhRequests] = useState<AnyRecord[]>([]);
  const [financeCount, setFinanceCount] = useState(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  const role = session?.user?.role ?? String(profile?.role ?? "employee");
  const displayRole = formatRoleWithCustom(String(role), profile?.customRole);
  const displayName = String(profile?.name ?? session?.user?.name ?? "User");
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const pendingLeaveCount = leaveRequests.filter((r) =>
    ["pending", "hr-approved", "manager-approved"].includes(String(r.status)),
  ).length;
  const pendingWfhCount = wfhRequests.filter((r) =>
    ["pending", "manager-approved", "hr-approved"].includes(String(r.status)),
  ).length;
  const pendingAttendanceCount = pendingLeaveCount + pendingWfhCount;
  const hasCompany = Boolean(
    profile?.company && profile?.companyStatus === "approved",
  );
  const mobileTabs: Tab[] = [
    "profile",
    "timeline",
    "onboarding",
    ...(["human-resource", "admin", "finance"].includes(String(role))
      ? (["members"] as Tab[])
      : []),
    ...(hasCompany ? (["messages"] as Tab[]) : []),
    ...(hasCompany && ["finance", "admin"].includes(String(role)) ? (["finance"] as Tab[]) : []),
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
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/wfh")
        .then((res) => setWfhRequests(res.requests))
        .catch(() => { });
      if (["finance", "admin"].includes(String(role)) && hasCompany) {
        const month = new Date().toISOString().slice(0, 7);
        apiFetch<{ pendingSalaryApproval: number; pendingSalaryPayment: number; pendingExpenseApproval: number; forwardedExpenseApproval: number; pendingExpenseAcceptance: number; pendingAssignedExpenses: number; pendingBills: number; pendingBudgets: number }>(`/api/finance?counts=true&month=${month}`)
          .then((res) => {
            const count = String(role) === "admin"
              ? res.pendingSalaryApproval + res.pendingExpenseApproval + res.forwardedExpenseApproval + res.pendingBills + res.pendingBudgets
              : res.pendingSalaryPayment + res.pendingExpenseAcceptance + res.pendingAssignedExpenses + res.pendingBudgets;
            setFinanceCount(count);
          })
          .catch(() => { });
      }
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
          new Audio("/sound/notification_sound.mp3").play().catch(() => {});
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
          {["human-resource", "admin", "finance"].includes(String(role)) ? (
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
          {hasCompany ? (
            <NavButton
              active={tab === "finance"}
              label={`Finance${financeCount ? ` (${financeCount})` : ""}`}
              onClick={() => setTab("finance")}
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
            label={`Attendance ${pendingAttendanceCount ? `(${pendingAttendanceCount})` : ""}`}
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
                  pendingAttendanceCount > 0
                  ? `attendance (${pendingAttendanceCount})`
                  : item === "finance" && financeCount > 0
                    ? `finance (${financeCount})`
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

              {tab === "finance" ? (
                <FinanceTab actorRole={String(role)} profileId={String(profile?.id ?? session?.user?.id ?? "")} showToast={showToast} />
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
