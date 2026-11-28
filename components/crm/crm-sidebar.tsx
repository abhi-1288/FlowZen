"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard, Users, Building2, Briefcase, CalendarClock, FileText,
  Headphones, BarChart3, Zap, LogOut, ChevronRight,
} from "lucide-react";
import { NavButton } from "@/components/profile/profile-hub/chrome";

const navItems = [
  { href: "/crm/dashboard", label: "CRM Dashboard", icon: LayoutDashboard },
  { href: "/crm/leads", label: "Leads", icon: Users },
  { href: "/crm/contacts", label: "Contacts", icon: Users },
  { href: "/crm/companies", label: "Companies", icon: Building2 },
  { href: "/crm/deals", label: "Deals & Pipeline", icon: Briefcase },
  { href: "/crm/activities", label: "Activities", icon: CalendarClock },
  { href: "/crm/quotations", label: "Quotations", icon: FileText },
  { href: "/crm/support", label: "Customer Support", icon: Headphones },
  { href: "/crm/reports", label: "Reports", icon: BarChart3 },
  { href: "/crm/automation", label: "Automation", icon: Zap },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-[#000000]">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg shadow-sm shadow-indigo-500/20">
            <Image src="/Logos/logo.jpg" alt="CRM logo" fill className="object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CRM</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 capitalize">
          {session?.user?.name} &bull; {session?.user?.role}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {session?.user?.company ? session.user.company : "No company on file"}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {active && <ChevronRight size={14} className="ml-auto" />}
            </button>
          );
        })}
        <div className="pt-4 mt-4 border-t border-slate-200">
          <button
            onClick={() => router.push("/profile")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronRight size={16} />
            Profile Center
          </button>
        </div>
      </nav>
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
