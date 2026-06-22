"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Briefcase, Users, Columns3, Calendar, FileText, UserPlus, LogOut
} from "lucide-react";
import { cn } from "@/lib/client-utils";

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
  const { data: session } = useSession();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
            <Image src="/Logos/logo.jpg" alt="FlowZen Logo" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Recruitment</h1>
            <p className="text-[10px] text-slate-500 capitalize">{session?.user?.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = !!(pathname && (pathname === item.href || pathname.startsWith(item.href + "/")));
          return (
            <Link
              key={item.href}
              href={item.href}
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
          className="mb-1 block rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-950"
        >
          Profile Center
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
