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
  const isFullAccess = role === "admin" || role === "human-resource";
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  const { showNotificationToast } = useNotificationToast();
  const sseRef = useRef<EventSource | null>(null);

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
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-y-auto border-r border-slate-800/60 bg-slate-950/95 text-white backdrop-blur-xl md:flex md:flex-col">
      <div className="border-b border-slate-800/60 p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
            <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Recruitment</h1>
            <p className="text-xs text-slate-400 capitalize">{session?.user?.company || "—"}</p>
            <p className="text-xs text-slate-500 capitalize">{session?.user?.name} &middot; {session?.user?.role}</p>
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
              items.push(<span key="o" className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400" title={`${chip.open} open`}>{chip.open}</span>);
              items.push(<span key="c" className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-rose-400" title={`${chip.closed} closed`}>{chip.closed}</span>);
            }

            return items.length > 0 ? <span className="flex items-center gap-1.5">{items}</span> : undefined;
          })();
          return (
            <NavButton
              key={item.href}
              active={isActive}
              icon={<item.icon size={16} />}
              label={item.label}
              onClick={() => router.push(item.href)}
              after={chips}
            />
          );
        })}
      </nav>

      <div className="border-t border-slate-800/60 p-3">
        <NavButton
          active={pathname?.startsWith("/profile") ?? false}
          label={`Profile Center${unreadNotifications ? ` (${unreadNotifications})` : ""}`}
          onClick={() => router.push("/profile")}
        />
        <button
          suppressHydrationWarning
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400 transition-all hover:bg-white/10 hover:text-rose-300"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
