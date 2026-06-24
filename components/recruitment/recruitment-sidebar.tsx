"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Briefcase, Users, Columns3, Calendar, FileText, UserPlus, LogOut
} from "lucide-react";
import { cn, apiFetch } from "@/lib/client-utils";
import { useNotificationToast } from "@/lib/toast-context";

type NotificationPreview = {
  readAt?: string | null;
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
  const isHr = role === "admin" || role === "human-resource";
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-y-auto border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
            <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Recruitment</h1>
            <p className="text-xs text-slate-500 capitalize">{session?.user?.name}: {session?.user?.role}</p>
            <p className="text-xs text-slate-500 capitalize">Company: {session?.user?.company || "—"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.filter((item) => isHr || item.href === "/recruitment/candidates").map((item) => {
          const isActive = !!(pathname && (pathname === item.href || pathname.startsWith(item.href + "/")));
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => router.prefetch(item.href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/profile"
          className="mb-1 block rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-950"
        >
          Profile Center{unreadNotifications ? ` (${unreadNotifications})` : ""}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
