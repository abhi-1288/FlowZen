"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  User,
  Users,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { ProfileSkeleton, NavButton } from "./profile-hub/chrome";
import { AttendanceTab } from "./profile-hub/attendance-tab";
import { DashboardTab } from "./profile-hub/dashboard-tab";
import { ApprovalsTab, MembersTab, MessagesTab, NotificationsTab, VisitorsTab } from "./profile-hub/admin-tabs";
import { FinanceTab } from "./profile-hub/finance-tab";
import { ProfileTab } from "./profile-hub/profile-tabs";
import { TimelineTab } from "./profile-hub/timeline-tab";
import { OnboardingTab } from "./profile-hub/onboarding-tab";
import { DocumentsTab } from "./profile-hub/documents-tab";
import { CareersTab } from "./profile-hub/careers-tab";
import { CompanyCalendarTab } from "./profile-hub/company-calendar-tab";
import { AnyRecord, AvatarBadge, formatRoleWithCustom } from "./profile-hub/shared";

type ProfileHubCache = {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  approvals: AnyRecord[];
  notifications: AnyRecord[];
  attendanceHistory: AnyRecord[];
  leaveRequests: AnyRecord[];
  wfhRequests: AnyRecord[];
  financeCount: number;
  checkOutRequestCount: number;
  jobsCount: number;
  recruitmentCount: number;
  messagesCount: number;
  fetchedAt: number;
};

const PROFILE_CACHE_TTL_MS = 30_000;
let profileHubCache: ProfileHubCache | null = null;

export type Tab =
  | "dashboard"
  | "profile"
  | "timeline"
  | "onboarding"
  | "members"
  | "messages"
  | "approvals"
  | "notifications"
  | "finance"
  | "attendance"
  | "documents"
  | "careers"
  | "calendar"
  | "visitors";

const VALID_TABS = new Set<string>(["dashboard", "profile", "timeline", "onboarding", "members", "messages", "approvals", "notifications", "finance", "attendance", "documents", "careers", "calendar", "visitors"]);


export function ProfileHub() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Parse tab from window location directly (reliable, not dependent on router)
  const getTabFromPath = (): { tab: Tab | undefined; showInvalid: boolean } => {
    const pathParts = window.location.pathname.replace(/\/profile\/?/, "").split("/").filter(Boolean);
    const raw = pathParts[0] ?? "";
    if (!raw) return { tab: undefined, showInvalid: false };
    if (VALID_TABS.has(raw)) return { tab: raw as Tab, showInvalid: false };
    return { tab: undefined, showInvalid: true };
  };

  const initialRoute = typeof window !== "undefined" ? getTabFromPath() : { tab: undefined as Tab | undefined, showInvalid: false };
  const [showInvalidRoute, setShowInvalidRoute] = useState(initialRoute.showInvalid);
  
  const [tab, setTabState] = useState<Tab>(initialRoute.tab || "dashboard");
  
  // Sync tab from URL on popstate (browser back/forward)
  useEffect(() => {
    const onPop = () => {
      const { tab: t, showInvalid } = getTabFromPath();
      setShowInvalidRoute(showInvalid);
      if (t) setTabState(t);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Sync tab when pathname changes (Link clicks, router.push, etc.)
  useEffect(() => {
    const { tab: t, showInvalid } = getTabFromPath();
    setShowInvalidRoute(showInvalid);
    if (t) setTabState(t);
  }, [pathname]);

  const setTab = (newTab: Tab) => {
    setTabState(newTab);
    setShowInvalidRoute(false);
    window.history.pushState(null, "", `/profile/${newTab}`);
  };

  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [insights, setInsights] = useState<AnyRecord | null>(null);
  const [approvals, setApprovals] = useState<AnyRecord[]>([]);
  const [notifications, setNotifications] = useState<AnyRecord[]>([]);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationTotalPages, setNotificationTotalPages] = useState(1);
  const [notificationFromDate, setNotificationFromDate] = useState("");
  const [notificationToDate, setNotificationToDate] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AnyRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<AnyRecord[]>([]);
  const [wfhRequests, setWfhRequests] = useState<AnyRecord[]>([]);
  const [financeCount, setFinanceCount] = useState(0);
  const [checkOutRequestCount, setCheckOutRequestCount] = useState(0);
  const [jobsCount, setJobsCount] = useState(0);
  const [recruitmentCount, setRecruitmentCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  useEffect(() => {
    if (!profileHubCache) return;
    if (Date.now() - profileHubCache.fetchedAt > PROFILE_CACHE_TTL_MS) return;

    setProfile(profileHubCache.profile);
    setInsights(profileHubCache.insights);
    setApprovals(profileHubCache.approvals);
    setNotifications(profileHubCache.notifications);
    setAttendanceHistory(profileHubCache.attendanceHistory);
    setLeaveRequests(profileHubCache.leaveRequests);
    setWfhRequests(profileHubCache.wfhRequests);
    setFinanceCount(profileHubCache.financeCount);
    setCheckOutRequestCount(profileHubCache.checkOutRequestCount);
    setJobsCount(profileHubCache.jobsCount);
    setRecruitmentCount(profileHubCache.recruitmentCount);
    setMessagesCount(profileHubCache.messagesCount ?? 0);
    setLoading(false);
  }, []);

  const role = session?.user?.role ?? String(profile?.role ?? "employee");
  const displayRole = formatRoleWithCustom(String(role), profile?.customRole);
  const displayName = String(profile?.name ?? session?.user?.name ?? "User");
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";

  const pendingLeaveCount = leaveRequests.filter((r) =>
    ["pending", "hr-approved", "manager-approved"].includes(String(r.status)),
  ).length;
  const pendingWfhCount = wfhRequests.filter((r) =>
    ["pending", "manager-approved", "hr-approved"].includes(String(r.status)),
  ).length;
  const pendingAttendanceCount = pendingLeaveCount + pendingWfhCount;
  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;
  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;
  const hasCompany = Boolean(
    profile?.company && profile?.companyStatus === "approved",
  );
  const canViewMembersTab = hasCompany && ["human-resource", "admin", "finance"].includes(String(role));
  const canViewVisitorsTab = hasCompany && ["human-resource", "admin"].includes(String(role));
  const canViewFinanceTab = hasCompany;
  const canViewCompanyTabs = hasCompany;
  const mobileTabs: Tab[] = [
    "dashboard",
    "profile",
    "timeline",
    "onboarding",
    ...(canViewMembersTab ? (["members"] as Tab[]) : []),
    ...(canViewVisitorsTab ? (["visitors"] as Tab[]) : []),
    "careers",
    ...(canViewCompanyTabs ? (["documents"] as Tab[]) : []),
    ...(canViewCompanyTabs ? (["messages"] as Tab[]) : []),
    ...(canViewFinanceTab ? (["finance"] as Tab[]) : []),
    ...(canViewCompanyTabs ? (["approvals"] as Tab[]) : []),
    "notifications",
    ...(canViewCompanyTabs ? (["attendance"] as Tab[]) : []),
    ...(canViewCompanyTabs ? (["calendar"] as Tab[]) : []),
  ];

  const { showNotificationToast } = useNotificationToast();

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const setMessage = (text: string) => showToast(text, "success");

  async function load(silent = false) {
    try {
      const cached = profileHubCache;
      const canUseCache =
        !silent &&
        cached &&
        Date.now() - cached.fetchedAt < PROFILE_CACHE_TTL_MS;

      if (canUseCache && cached) {
        setProfile(cached.profile);
        setInsights(cached.insights);
        setApprovals(cached.approvals);
        setNotifications(cached.notifications);
        setAttendanceHistory(cached.attendanceHistory);
        setLeaveRequests(cached.leaveRequests);
        setWfhRequests(cached.wfhRequests);
        setFinanceCount(cached.financeCount);
        setCheckOutRequestCount(cached.checkOutRequestCount);
        setJobsCount(cached.jobsCount);
        setMessagesCount(cached.messagesCount ?? 0);
        setLoading(false);
        void load(true);
        return;
      }

      if (!silent) setLoading(true);

      const [profileResult, approvalsResult] =
        await Promise.all([
          apiFetch<{ user: AnyRecord; insights?: AnyRecord }>(
            "/api/profile",
          ).catch(() => null),

          apiFetch<{ requests: AnyRecord[] }>("/api/approvals").catch(() => ({
            requests: [],
          })),
        ]);

      if (profileResult) setProfile(profileResult.user);
      if (profileResult?.insights) setInsights(profileResult.insights);

      setApprovals(approvalsResult?.requests ?? []);

      const nextProfile = profileResult?.user ?? profile;
      const nextInsights = profileResult?.insights ?? insights;
      const nextApprovals = approvalsResult?.requests ?? [];

      // Use the freshly fetched profile to determine role/company, avoids stale closure
      const actualRole = session?.user?.role ?? String(nextProfile?.role ?? "employee");
      const actualHasCompany = Boolean(nextProfile?.company && nextProfile?.companyStatus === "approved");

      const [attendanceResult, leaveResult, wfhResult] = await Promise.all([
        apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").catch(
          () => ({ history: attendanceHistory }),
        ),
        apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").catch(
          () => ({ requests: leaveRequests }),
        ),
        apiFetch<{ requests: AnyRecord[] }>("/api/attendance/wfh").catch(
          () => ({ requests: wfhRequests }),
        ),
      ]);

      const nextAttendanceHistory = attendanceResult.history;
      const nextLeaveRequests = leaveResult.requests;
      const nextWfhRequests = wfhResult.requests;
      let nextFinanceCount = financeCount;
      let nextCheckOutRequestCount = checkOutRequestCount;
      let nextJobsCount = jobsCount;

      setAttendanceHistory(nextAttendanceHistory);
      setLeaveRequests(nextLeaveRequests);
      setWfhRequests(nextWfhRequests);

      if (["finance", "admin"].includes(String(actualRole)) && actualHasCompany) {
        const month = new Date().toISOString().slice(0, 7);
        const [financeCounts, checkOutResult] = await Promise.all([
          apiFetch<{ pendingSalaryApproval: number; pendingSalaryPayment: number; pendingExpenseApproval: number; forwardedExpenseApproval: number; pendingExpenseAcceptance: number; pendingAssignedExpenses: number; pendingBills: number; pendingBudgets: number }>(`/api/finance?counts=true&month=${month}`)
            .catch(() => null),
          apiFetch<{ requests: AnyRecord[] }>("/api/attendance/checkout-request")
            .catch(() => null),
        ]);
        if (financeCounts) {
          nextFinanceCount = String(actualRole) === "admin"
            ? financeCounts.pendingSalaryApproval + financeCounts.pendingExpenseApproval + financeCounts.forwardedExpenseApproval + financeCounts.pendingBills + financeCounts.pendingBudgets
            : financeCounts.pendingSalaryApproval + financeCounts.pendingSalaryPayment + financeCounts.pendingExpenseApproval + financeCounts.pendingExpenseAcceptance + financeCounts.pendingBudgets;
          setFinanceCount(nextFinanceCount);
        }
        if (String(actualRole) === "finance" && checkOutResult) {
          nextCheckOutRequestCount = checkOutResult.requests.filter((r: any) => r.status === "pending").length;
          setCheckOutRequestCount(nextCheckOutRequestCount);
        }
      }

      if (actualHasCompany) {
        const jobsResult = await apiFetch<{ jobs: AnyRecord[] }>("/api/profile/jobs").catch(() => null);
        if (jobsResult) {
          nextJobsCount = jobsResult.jobs.length;
          setJobsCount(nextJobsCount);
        }
      }

      let nextRecruitmentCount = recruitmentCount;
      if (["admin", "human-resource", "project-manager", "qa-tester", "finance"].includes(String(actualRole)) && actualHasCompany) {
        const countRes = await apiFetch<{ count: number }>("/api/recruitment/assigned-count").catch(() => null);
        if (countRes) {
          nextRecruitmentCount = countRes.count;
          setRecruitmentCount(nextRecruitmentCount);
        }
      }

      let nextMessagesCount = messagesCount;
      if (actualHasCompany) {
        const msgRes = await apiFetch<{ unreadCount: number }>("/api/messages/unread-count").catch(() => null);
        if (msgRes) {
          nextMessagesCount = msgRes.unreadCount;
          setMessagesCount(nextMessagesCount);
        }
      }

      profileHubCache = {
        profile: nextProfile,
        insights: nextInsights,
        approvals: nextApprovals,
        notifications: [],
        attendanceHistory: nextAttendanceHistory,
        leaveRequests: nextLeaveRequests,
        wfhRequests: nextWfhRequests,
        financeCount: nextFinanceCount,
        checkOutRequestCount: nextCheckOutRequestCount,
        jobsCount: nextJobsCount,
        recruitmentCount: nextRecruitmentCount,
        messagesCount: nextMessagesCount,
        fetchedAt: Date.now(),
      };
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function reloadNotifications(page?: number, from?: string, to?: string) {
    const params = new URLSearchParams();
    params.set("page", String(page ?? notificationPage));
    params.set("limit", "15");
    const f = from ?? notificationFromDate;
    const t = to ?? notificationToDate;
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const res = await apiFetch<{ notifications: AnyRecord[]; total: number; page: number; totalPages: number; unreadCount: number }>(
      `/api/notifications?${params.toString()}`,
    ).catch(() => null);
    if (res) {
      setNotifications(res.notifications);
      setNotificationPage(res.page);
      setNotificationTotalPages(res.totalPages);
      setUnreadCount(res.unreadCount);
    }
  }

  const notificationSndRef = useRef<HTMLAudioElement | null>(null);
  const silentLoadThrottleRef = useRef(0);

  // Unlock audio on first user interaction (browsers block autoplay)
  useEffect(() => {
    const unlock = () => {
      const audio = new Audio("/sound/notification_sound.mp3");
      audio.volume = 0.01;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        notificationSndRef.current = audio;
      }).catch(() => {
        try { new AudioContext().resume(); } catch {}
      });
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock, { once: true });
  }, []);

  useEffect(() => {
    void load();
    void reloadNotifications();
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
          if (notificationSndRef.current) {
            notificationSndRef.current.currentTime = 0;
            notificationSndRef.current.play().catch(() => {});
          } else {
            new Audio("/sound/notification_sound.mp3").play().catch((err) => console.warn("Notification sound unavailable:", err));
          }
          apiFetch<{ notifications: AnyRecord[]; unreadCount: number }>("/api/notifications?limit=1")
            .then((res) => {
              const latest = res.notifications?.[0];
              if (latest) showNotificationToast(String(latest.title ?? "Notification"), String(latest.body ?? ""));
              setUnreadCount(res.unreadCount);
            })
            .catch(() => {});
          void reloadNotifications();
          const now = Date.now();
          if (now - silentLoadThrottleRef.current > 3000) {
            silentLoadThrottleRef.current = now;
            void load(true);
          }
        });

        eventSource.addEventListener("message:new", (e: MessageEvent) => {
          if (!mounted) return;
          console.log("SSE: ProfileHub message:new received");
          if (notificationSndRef.current) {
            notificationSndRef.current.currentTime = 0;
            notificationSndRef.current.play().catch(() => {});
          } else {
            new Audio("/sound/notification_sound.mp3").play().catch((err) => console.warn("Notification sound unavailable:", err));
          }
          try {
            const data = JSON.parse(e.data);
            showNotificationToast(`Message from ${data.senderName}`, data.message);
          } catch (err) {
            showNotificationToast("New Message", "You have received a new message.");
          }
          apiFetch<{ unreadCount: number }>("/api/messages/unread-count")
            .then((res) => {
              if (mounted) setMessagesCount(res.unreadCount);
            })
            .catch(() => {});
          window.dispatchEvent(new CustomEvent("messages:refresh"));
        });

        eventSource.addEventListener("message:received", () => {
          if (!mounted) return;
          console.log("SSE: ProfileHub message:received received");
          window.dispatchEvent(new CustomEvent("messages:refresh"));
        });

        eventSource.addEventListener("message:read", () => {
          if (!mounted) return;
          console.log("SSE: ProfileHub message:read received");
          window.dispatchEvent(new CustomEvent("messages:refresh"));
        });

        eventSource.addEventListener("user:online", () => {
          if (!mounted) return;
          window.dispatchEvent(new CustomEvent("messages:refresh"));
        });

        eventSource.addEventListener("user:offline", () => {
          if (!mounted) return;
          window.dispatchEvent(new CustomEvent("messages:refresh"));
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
    await reloadNotifications();
  }

  async function markNotificationRead(id: string) {
    await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
    await reloadNotifications();
  }

  async function deleteAllNotifications() {
    await apiFetch("/api/notifications", { method: "DELETE" });
    await reloadNotifications();
  }

  async function deleteNotification(id: string) {
    await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
    await reloadNotifications();
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-800/60 bg-slate-950/95 text-white backdrop-blur-xl lg:flex">
        <div className="shrink-0 p-5">
          <div className="flex flex-col gap-4">
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
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800/80 p-2.5 ring-1 ring-slate-700/50">
              <AvatarBadge
                avatarUrl={avatarUrl}
                name={displayName}
                size="md"
                showRing
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100 capitalize">
                  {displayName}
                </p>
                <p className="truncate text-xs text-slate-400 capitalize">
                  {displayRole}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 h-px bg-gradient-to-r from-indigo-500/40 via-violet-500/20 to-transparent" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-5 pb-5 sidebar-scrollbar">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Users</p>
          <NavButton
            active={tab === "dashboard"}
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            onClick={() => setTab("dashboard")}
          />
          <NavButton
            active={tab === "profile"}
            icon={<User size={16} />}
            label="Profile"
            onClick={() => setTab("profile")}
          />
          <NavButton
            active={tab === "timeline"}
            icon={<History size={16} />}
            label="Timeline"
            onClick={() => setTab("timeline")}
          />
          <NavButton
            active={tab === "onboarding"} 
            icon={<ShieldCheck size={16} />}
            label="Onboarding"
            onClick={() => setTab("onboarding")}
          />
          <NavButton
            active={tab === "careers"}
            icon={<Briefcase size={16} />}
            label={`Careers${jobsCount ? ` (${jobsCount})` : ""}`}
            onClick={() => setTab("careers")}
          />
          {canViewMembersTab || canViewCompanyTabs ? (
            <>
              <div className="my-3 h-px bg-slate-800/40" />
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin</p>
            </>
          ) : null}
          {canViewMembersTab ? (
            <NavButton
              active={tab === "members"}
              icon={<Users size={16} />}
              label={`Members${checkOutRequestCount ? ` (${checkOutRequestCount})` : ""}`}
              onClick={() => setTab("members")}
            />
          ) : null}
          {canViewVisitorsTab ? (
            <NavButton
              active={tab === "visitors"}
              icon={<User size={16} />}
              label="Visitors"
              onClick={() => setTab("visitors")}
            />
          ) : null}
          {canViewCompanyTabs && ["admin", "human-resource", "project-manager", "qa-tester", "finance"].includes(String(role)) ? (
            <NavButton
              active={pathname?.startsWith("/recruitment") ?? false}
              icon={<Briefcase size={16} />}
              label={`Recruitment${recruitmentCount ? ` (${recruitmentCount})` : ""}`}
              onClick={() => router.push("/recruitment/candidates")}
            />
          ) : null}
          {canViewCompanyTabs ? (
            <NavButton
              active={tab === "documents"}
              icon={<FileText size={16} />}
              label="Documents"
              onClick={() => setTab("documents")}
            />
          ) : null}
          {canViewCompanyTabs ? (
            <NavButton
              active={tab === "approvals"}
              icon={<CheckSquare size={16} />}
              label={`Approvals ${approvals.length ? `(${approvals.length})` : ""}`}
              onClick={() => setTab("approvals")}
            />
          ) : null}
          {canViewCompanyTabs ? (
            <NavButton
              active={tab === "messages"}
              icon={<MessageSquare size={16} />}
              label={`Messages${messagesCount ? ` (${messagesCount})` : ""}`}
              onClick={() => setTab("messages")}
            />
          ) : null}
          {canViewFinanceTab ? (
            <>
              <div className="my-3 h-px bg-slate-800/40" />
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Finance</p>
              <NavButton
                active={tab === "finance"}
                icon={<Wallet size={16} />}
                label={`Finance${financeCount ? ` (${financeCount})` : ""}`}
                onClick={() => setTab("finance")}
              />
            </>
          ) : null}
          {canViewCompanyTabs ? (
            <NavButton
              active={tab === "attendance"}
              icon={<CalendarCheck size={16} />}
              label={`Attendance ${pendingAttendanceCount ? `(${pendingAttendanceCount})` : ""}`}
              onClick={() => setTab("attendance")}
            />
          ) : null}
          {canViewCompanyTabs ? (
            <NavButton
              active={tab === "calendar"}
              icon={<CalendarDays size={16} />}
              label="Calendar"
              onClick={() => setTab("calendar")}
            />
          ) : null}
          <NavButton
            active={tab === "notifications"}
            icon={<Bell size={16} />}
            label={`Notifications ${unreadCount ? `(${unreadCount})` : ""}`}
            onClick={() => setTab("notifications")}
          />
          <Link
            className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            href="/board"
          >
            <ChevronRight size={14} className="-ml-0.5" />
            Back to boards
          </Link>
        </nav>
      </aside>

      <section className="lg:pl-72">
        {/* ── Cover Banner ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-6 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            {/* Avatar + Name + Role */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="lg" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {displayName}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                    <ShieldCheck size={12} />
                    {displayRole}
                  </span>
                  <span className="text-sm text-indigo-200">
                    {String(profile?.email ?? session?.user?.email ?? "")}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>

          {/* Info chips */}
          <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2">
            {company?.name ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-sm">
                <Building2 size={13} />
                {String(company.name)}
              </span>
            ) : null}
            {team?.name ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-sm">
                <Users size={13} />
                {String(team.name)}
              </span>
            ) : null}
            {profile?.companyJoined ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur-sm">
                <Calendar size={13} />
                Joined {new Date(profile.companyJoined as string | Date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            ) : null}
          </div>

          {/* Mobile tabs */}
          <div className="relative z-10 mt-6 flex gap-1.5 overflow-x-auto lg:hidden">
            {mobileTabs.map((item) => {
              const label =
                item === "attendance" && pendingAttendanceCount > 0
                  ? `Attendance (${pendingAttendanceCount})`
                  : item === "members" && checkOutRequestCount > 0
                    ? `Members (${checkOutRequestCount})`
                    : item === "finance" && financeCount > 0
                      ? `Finance (${financeCount})`
                      : item === "approvals" && approvals.length > 0
                        ? `Approvals (${approvals.length})`
                        : item === "notifications" && unreadCount > 0
                          ? `Notifications (${unreadCount})`
                          : item === "careers" && jobsCount > 0
                            ? `Careers (${jobsCount})`
                            : item === "messages" && messagesCount > 0
                              ? `Messages (${messagesCount})`
                              : item.charAt(0).toUpperCase() + item.slice(1);

              return (
                <button
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                    tab === item
                      ? "bg-white text-indigo-700 shadow-md"
                      : "bg-white/10 text-white/80 backdrop-blur-sm hover:bg-white/20"
                  }`}
                  key={item}
                  onClick={() => setTab(item)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

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

              {showInvalidRoute ? (
                <div className="grid min-h-[60vh] place-items-center px-4">
                  <div className="max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
                      <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Page not found</h2>
                    <p className="mt-2 text-sm text-slate-500">The route <span className="font-medium text-slate-700">/profile/{window.location.pathname.replace("/profile/", "")}</span> doesn't exist.</p>
                    <button
                      onClick={() => { router.push("/profile"); setShowInvalidRoute(false); }}
                      className="mt-8 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Go to profile
                    </button>
                  </div>
                </div>
              ) : <>
              {tab === "dashboard" ? (
                <DashboardTab
                  profile={profile}
                  insights={insights}
                  notifications={notifications}
                  approvals={approvals}
                  attendanceHistory={attendanceHistory}
                  leaveRequests={leaveRequests}
                  wfhRequests={wfhRequests}
                  financeCount={financeCount}
                  checkOutRequestCount={checkOutRequestCount}
                  role={String(role)}
                  company={company}
                  showToast={showToast}
                />
              ) : null}

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

              {tab === "approvals" && canViewCompanyTabs ? (
                <ApprovalsTab
                  approvals={approvals}
                  refresh={load}
                  showToast={showToast}
                />
              ) : null}

              {tab === "members" && canViewMembersTab ? (
                <MembersTab
                  insights={insights}
                  actorRole={String(role)}
                  showToast={showToast}
                  refresh={load}
                  regionOptions={
                    company?.multiOffice && Array.isArray(company?.addresses)
                      ? (company.addresses as AnyRecord[]).map((a: AnyRecord) => String(a.label ?? "")).filter(Boolean)
                      : company?.address
                        ? ["Main Office"]
                        : []
                  }
                />
              ) : null}

              {tab === "documents" && canViewCompanyTabs ? (
                <DocumentsTab actorRole={String(role)} showToast={showToast} />
              ) : null}

              {tab === "careers" ? (
                <CareersTab />
              ) : null}

              {tab === "messages" && canViewCompanyTabs ? (
                <MessagesTab showToast={showToast} />
              ) : null}

              {tab === "notifications" ? (
                <NotificationsTab
                  notifications={notifications}
                  markAllRead={markAllRead}
                  deleteAll={deleteAllNotifications}
                  markRead={markNotificationRead}
                  deleteOne={deleteNotification}
                  page={notificationPage}
                  totalPages={notificationTotalPages}
                  fromDate={notificationFromDate}
                  toDate={notificationToDate}
                  onPageChange={(p) => {
                    setNotificationPage(p);
                    reloadNotifications(p);
                  }}
                  onDateFilterChange={(from, to) => {
                    setNotificationFromDate(from);
                    setNotificationToDate(to);
                    setNotificationPage(1);
                    reloadNotifications(1, from, to);
                  }}
                />
              ) : null}

              {tab === "finance" ? (
                <FinanceTab actorRole={String(role)} profileId={String(profile?.id ?? session?.user?.id ?? "")} showToast={showToast} />
              ) : null}

              {tab === "attendance" && canViewCompanyTabs ? (
                <AttendanceTab profile={profile} showToast={showToast} />
              ) : null}

              {tab === "calendar" && canViewCompanyTabs ? (
                <CompanyCalendarTab />
              ) : null}

              {tab === "visitors" && canViewVisitorsTab ? (
                <VisitorsTab showToast={showToast} />
              ) : null}
            </>}
          </>
          )}
        </div>
      </section>
    </main>
  );
}
