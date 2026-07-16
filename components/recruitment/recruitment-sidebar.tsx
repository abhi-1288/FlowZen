"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard, Briefcase, Users, Columns3, Calendar, FileText, UserPlus, LogOut
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";
import { NavButton } from "@/components/profile/profile-hub/chrome";

type NotificationPreview = {
  readAt?: string | null;
};

type SidebarCounts = {
  jobsOpen: number;
  jobsClosed: number;
  candidatesOpen: number;
  candidatesClosed: number;
  interviewsOpen: number;
  interviewsClosed: number;
  offersOpen: number;
  offersClosed: number;
  referralsOpen: number;
  referralsClosed: number;
  pendingTasks: number;
  myRequestCount: number;
  otherRequestCount: number;
};

const navItems = [
  { href: "/recruitment/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recruitment/jobs", label: "Jobs", icon: Briefcase },
  { href: "/recruitment/candidates", label: "Candidates", icon: Users },
  { href: "/recruitment/board", label: "Kanban Board", icon: Columns3 },
  { href: "/recruitment/interviews", label: "Interviews", icon: Calendar },
  { href: "/recruitment/offers", label: "Offers", icon: FileText },
  { href: "/recruitment/referrals", label: "Referrals", icon: UserPlus },
];

export function RecruitmentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isSeniorSecurity = role === "security" && Boolean((session?.user as any)?.isSeniorSecurity);
  const isFullAccess = role === "admin" || role === "human-resource" || isSeniorSecurity;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  const { showNotificationToast } = useNotificationToast();
  const sseRef = useRef<EventSource | null>(null);

  const navigateToTab = (href: string) => {
    if (window.location.pathname === href) return;
    window.history.pushState(null, "", href);
    window.dispatchEvent(new Event("flowzen:recruitment-navigation"));
  };

  useEffect(() => {
    async function fetchNotificationCount() {
      const result = await apiFetch<{ notifications: NotificationPreview[] }>("/api/notifications").catch(() => null);
      setUnreadNotifications(result?.notifications.filter((item) => !item.readAt).length ?? 0);
    }
    void fetchNotificationCount();
  }, []);

  useEffect(() => {
    async function fetchCounts() {
      const result = await apiFetch<SidebarCounts>("/api/recruitment/sidebar-counts").catch(() => null);
      if (result) setCounts(result);
    }
    void fetchCounts();
  }, []);

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
    router.prefetch("/profile");
  }, [router]);

  useEffect(() => {
    if (!session?.user?.id) return;
    let mounted = true;
    const connect = () => {
      try {
        sseRef.current = new EventSource("/api/events", { withCredentials: true });
        sseRef.current.addEventListener("notification:new", () => {
          if (!mounted) return;
          apiFetch<{ notifications: any[] }>("/api/notifications")
            .then((res) => {
              const latest = res.notifications?.[0];
              if (latest) showNotificationToast(String(latest.title ?? "Notification"), String(latest.body ?? ""));
              setUnreadNotifications(res.notifications.filter((item) => !item.readAt).length);
            })
            .catch(() => {});
        });
        sseRef.current.onerror = () => {
          if (mounted) {
            sseRef.current?.close();
            setTimeout(connect, 3000);
          }
        };
      } catch { /* ignore */ }
    };
    connect();
    return () => {
      mounted = false;
      sseRef.current?.close();
    };
  }, [session?.user?.id, showNotificationToast]);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-y-auto border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#000000] md:flex md:flex-col">
      <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg">
            <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">Recruitment</h1>
            <p className="text-xs text-slate-500 capitalize dark:text-zinc-400">{session?.user?.company || "—"}</p>
            <p className="text-xs text-slate-400 capitalize dark:text-zinc-500">{session?.user?.name} &middot; {session?.user?.role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.filter((item) =>
          isFullAccess ||
          item.href === "/recruitment/dashboard" ||
          item.href === "/recruitment/jobs" ||
          item.href === "/recruitment/candidates" ||
          item.href === "/recruitment/interviews"
        ).map((item) => {
          const isActive = !!(pathname && (pathname === item.href || pathname.startsWith(item.href + "/")));
          const chip = item.href !== "/recruitment/dashboard" && item.href !== "/recruitment/board" && counts
            ? {
                open: counts[`${item.href.replace("/recruitment/", "")}Open` as keyof SidebarCounts] as number,
                closed: counts[`${item.href.replace("/recruitment/", "")}Closed` as keyof SidebarCounts] as number,
              }
            : null;
          const chips = (() => {
            const items: React.ReactNode[] = [];
            if (chip) {
              items.push(<span key="o" className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950" title={`${chip.open} open`}>{chip.open}</span>);
              items.push(<span key="c" className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950" title={`${chip.closed} closed`}>{chip.closed}</span>);
            }

            return items.length > 0 ? <span className="flex items-center gap-1.5">{items}</span> : undefined;
          })();
          return (
            <NavButton
              key={item.href}
              active={isActive}
              icon={<item.icon size={16} />}
              label={item.label}
              onClick={() => navigateToTab(item.href)}
              after={chips}
            />
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-zinc-800">
        <NavButton
          active={pathname?.startsWith("/profile") ?? false}
          label={`Profile Center${unreadNotifications ? ` (${unreadNotifications})` : ""}`}
          onClick={() => router.push("/profile")}
        />
        <button
          suppressHydrationWarning
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
