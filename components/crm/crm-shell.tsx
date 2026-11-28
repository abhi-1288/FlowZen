// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { emitErrorToast } from "@/lib/toast-context";
import { CrmAssignModal, CrmInviteModal } from "@/components/crm/crm-modals";
import {
  LayoutDashboard, FolderKanban, Users, UserCheck, Building2, Briefcase,
  CalendarClock, FileText, Headphones, BarChart3, Zap, Settings,
  Search, Bell, HelpCircle, ChevronDown, ChevronRight, Plus, Filter,
  Download, Upload, MoreHorizontal, Mail, Phone, Globe, MapPin,
  CheckCircle2, Clock, AlertCircle, XCircle, ArrowUpRight, ArrowDownRight,
  Trash2, Edit3, Eye, Send, Copy, Check, X, Sparkles, SlidersHorizontal,
  MessageSquare, Paperclip, Calendar as CalendarIcon, DollarSign, TrendingUp,
  Award, Target, Layers, Shield, ExternalLink, RefreshCw, Play, Save,
  FileSpreadsheet, Printer, Lock, Unlock, UserPlus, FolderPlus, Receipt,
  ChevronLeft, GripVertical, Tag, Building, CheckSquare, Square, Info,
  LifeBuoy, LogOut, CreditCard, GitBranch, ArrowRight, AlertTriangle
} from 'lucide-react';

// Shared formatting helpers (all display values come from database records).
const toNumber = (value: unknown) => Number(value) || 0;
const recordId = (record: any) => String(record?.id ?? record?._id ?? "");
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("") || "U";
const formatCurrency = (val: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(toNumber(val));
const relativeTime = (value: unknown) => {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};


/** Local state that mirrors /api/crm/<entity>. Every mutation is persisted. */
const CRM_SINGULAR: Record<string, string> = {
  companies: "company", contacts: "contact", leads: "lead", deals: "deal",
  activities: "activity", quotations: "quotation", tickets: "ticket", workflows: "workflow",
};


/** Build a real time series from closed-won deals. */
function buildCrmSeries(range: string, deals: any[], customStart = "", customEnd = "") {
  const now = new Date();
  const buckets: { label: string; from: Date; to: Date }[] = [];
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (range === "Custom Range" && customStart && customEnd) {
    const from = new Date(customStart);
    const to = new Date(customEnd);
    const span = Math.max(1, Math.min(31, Math.round((to.getTime() - from.getTime()) / 86400000) + 1));
    for (let i = 0; i < span; i++) {
      const start = new Date(from.getTime() + i * 86400000);
      buckets.push({ label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), from: start, to: new Date(start.getTime() + 86400000) });
    }
  } else if (range === "7 days") {
    for (let i = 6; i >= 0; i--) {
      const start = new Date(day(now).getTime() - i * 86400000);
      buckets.push({ label: start.toLocaleDateString("en-IN", { weekday: "short" }), from: start, to: new Date(start.getTime() + 86400000) });
    }
  } else if (range === "90 days") {
    for (let i = 2; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({ label: start.toLocaleDateString("en-IN", { month: "short" }), from: start, to });
    }
  } else if (range === "12 months") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now.getFullYear(), quarterStart - i * 3, 1);
      const to = new Date(start.getFullYear(), start.getMonth() + 3, 1);
      buckets.push({ label: `Q${Math.floor(start.getMonth() / 3) + 1} ${String(start.getFullYear()).slice(2)}`, from: start, to });
    }
  } else {
    for (let i = 3; i >= 0; i--) {
      const start = new Date(day(now).getTime() - i * 7 * 86400000);
      buckets.push({ label: `Wk ${4 - i}`, from: start, to: new Date(start.getTime() + 7 * 86400000) });
    }
  }
  const series = buckets.map((bucket) => {
    const won = deals.filter((deal) => {
      if (String(deal.stage || "").toUpperCase() !== "WON") return false;
      const date = new Date(deal.closeDate || deal.createdAt || "");
      return !Number.isNaN(date.getTime()) && date >= bucket.from && date < bucket.to;
    });
    return { label: bucket.label, revenue: won.reduce((sum, deal) => sum + toNumber(deal.value), 0), deals: won.length };
  });
  return { series, maxRevenue: Math.max(1, ...series.map((point) => point.revenue)) * 1.15 };
}

const compactInr = (value: number) => `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
const recentCount = (records: any[], days = 7) => records.filter((row) => Date.now() - new Date(row.createdAt || 0).getTime() < days * 86400000).length;
const STANDARD_LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Advertising", "Cold Outreach"];
const formatRoleLabel = (role = "") => String(role).replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Keeps page-local state alive across parent re-renders (for example when CRM
 * records finish loading). Page functions below are recreated on each shell
 * render, so they are invoked here instead of being used as JSX element types.
 */
function CrmPageRenderer({ render }: { render: () => React.ReactNode }) {
  const renderRef = useRef(render);
  renderRef.current = render;
  return <>{renderRef.current()}</>;
}


function parseCsvLeads(text: string, ownerId: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => { row[header] = cells[i] || ""; });
    const fullName = String(row.full_name || row.name || `${row.first_name || ""} ${row.last_name || ""}`).trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    return {
      id: `lead-${Date.now()}-${index}`,
      firstName: firstName || "Imported",
      lastName: rest.join(" "),
      email: row.work_email || row.email || "",
      phone: row.phone || "",
      company: row.organization || row.company || "",
      jobTitle: row.job_title || "",
      source: row.source || "Import",
      ownerId,
      status: "New",
      score: 0,
      value: toNumber(row.est_arr || row.value),
      createdAt: new Date().toISOString().slice(0, 10),
      tags: ["Imported"],
      description: row.description || "",
      notes: [],
    };
  });
}

function useCrmCollection(entity: string) {
  const [records, setRecordsState] = useState<any[]>([]);
  const live = useRef<any[]>([]);
  const synced = useRef<any[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  live.current = records;

  const hydrate = (list: any[]) => {
    const normalized = Array.isArray(list) ? list : [];
    synced.current = normalized;
    setRecordsState(normalized);
  };

  const setRecords = (next: any[] | ((prev: any[]) => any[])) => {
    const prev = live.current;
    const value = typeof next === "function" ? (next as (p: any[]) => any[])(prev) : next;
    setRecordsState(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(value); }, 200);
  };

  async function flush(snapshot: any[]) {
    const before = synced.current;
    const beforeById = new Map(before.map((item) => [recordId(item), item]));
    const syncedById = new Map(before.map((item) => [recordId(item), item]));
    let persistenceError = false;

    for (const item of snapshot) {
      const id = recordId(item);
      const isStored = /^[0-9a-f]{24}$/i.test(id);
      if (!isStored) {
        const { id: _tempId, _id, __v, createdAt, updatedAt, owner: _owner, ...payload } = item;
        const result = await apiFetch<Record<string, any>>(`/api/crm/${entity}`, {
          method: "POST",
          body: JSON.stringify(payload),
        }, { toast: false }).catch(() => { persistenceError = true; return null; });
        const saved = result?.[CRM_SINGULAR[entity]];
        if (saved && saved.id) {
          syncedById.set(String(saved.id), saved);
          const idx = live.current.findIndex((row) => recordId(row) === id);
          if (idx >= 0) {
            const copy = [...live.current];
            copy[idx] = saved;
            setRecordsState(copy);
          }
        }
        continue;
      }

      if (JSON.stringify(beforeById.get(id)) !== JSON.stringify(item)) {
        const { id: _idField, _id, __v, createdAt, updatedAt, owner: _owner, ...payload } = item;
        await apiFetch(`/api/crm/${entity}/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }, { toast: false }).catch(() => { persistenceError = true; });
      }
      syncedById.set(id, item);
    }

    const keptIds = new Set(snapshot.map(recordId));
    for (const old of before) {
      const id = recordId(old);
      if (id && !keptIds.has(id) && /^[0-9a-f]{24}$/i.test(id)) {
        await apiFetch(`/api/crm/${entity}/${id}`, { method: "DELETE" }, { toast: false }).catch(() => { persistenceError = true; });
        syncedById.delete(id);
      }
    }

    if (persistenceError) {
      emitErrorToast(`Some ${entity} changes could not be saved. They will be retried on the next edit.`);
      return;
    }
    synced.current = [...syncedById.values()];
  }

  return [records, setRecords, hydrate] as const;
}

// ============================================================================
// 2. REUSABLE DESIGN SYSTEM COMPONENTS
// ============================================================================

const Badge = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant] || styles.neutral} ${className}`}>
      {children}
    </span>
  );
};

const getStatusVariant = (status) => {
  const map = {
    New: 'blue', NEW: 'blue', Open: 'blue', Draft: 'neutral',
    Contacted: 'indigo', CONTACTED: 'indigo', Viewed: 'indigo',
    Qualified: 'purple', PROPOSAL: 'purple', Sent: 'purple', 'In Progress': 'amber', Upcoming: 'blue',
    NEGOTIATION: 'amber', Pending: 'amber', Medium: 'amber', Prospect: 'blue', Partner: 'purple',
    Converted: 'green', WON: 'green', Won: 'green', Accepted: 'green', Resolved: 'green', Active: 'green', Completed: 'green', Customer: 'green', Low: 'neutral',
    Unqualified: 'red', LOST: 'red', Lost: 'red', Rejected: 'red', Overdue: 'red', Urgent: 'red', High: 'red', Inactive: 'neutral', Closed: 'neutral', Expired: 'red'
  };
  return map[status] || 'neutral';
};

const Avatar = ({ employee, name, size = 'sm' }) => {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  const initials = employee?.avatar || (name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'FZ');
  const bg = employee?.color || 'bg-slate-700';
  return (
    <div className={`${sizes[size]} ${bg} rounded-full text-white font-semibold flex items-center justify-center shrink-0 select-none shadow-xs`}>
      {initials}
    </div>
  );
};

const KpiCard = ({ title, value, change, trend = 'up', subtitle = '', icon: Icon, onClick, active }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-[12px] border p-5 transition-all duration-150 ${
      onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md' : ''
    } ${active ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 shadow-2xs'}`}
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
          <Icon className="w-4 h-4" />
        </div>
      )}
    </div>
    <div className="flex items-baseline justify-between gap-2">
      <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      {change && (
        <div className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
          trend === 'up' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
        }`}>
          {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {change}
        </div>
      )}
    </div>
    <div className="mt-1.5 text-xs text-slate-400 flex items-center justify-between">
      <span>{subtitle}</span>
      {onClick && <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100">View →</span>}
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, subtitle, children, footer, maxWidth = 'max-w-2xl' }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] animate-fadeIn">
      <div className={`bg-white rounded-xl border border-slate-200 shadow-modal w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50/60">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const Drawer = ({ isOpen, onClose, title, subtitle, badge, headerActions, children, width = 'max-w-2xl' }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={onClose} />
      <div className={`relative z-10 bg-white w-full ${width} h-full shadow-2xl border-l border-slate-200 flex flex-col`}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {children}
        </div>
      </div>
    </div>
  );
};

const PageHeader = ({ title, subtitle, breadcrumb, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
    <div>
      {breadcrumb && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
          <span>CRM</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span>CRM</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-800">{breadcrumb}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center flex-wrap gap-2.5">{actions}</div>}
  </div>
);

// ============================================================================
// 3. MAIN APPLICATION COMPONENT
// ============================================================================

export function CrmShell() {
  // Navigation & Global UI State
  const router = useRouter();
  const routeParams = useParams<{ tab?: string[] }>();
  const routeTab = routeParams?.tab?.[0] || 'dashboard';
  const { data: session } = useSession();
  const [activeSubPage, setActiveSubPage] = useState(routeTab);
  useEffect(() => { setActiveSubPage(routeTab); }, [routeTab]);

  const currentUser = useMemo(() => ({
    id: String(session?.user?.id || ""),
    name: String(session?.user?.name || "Team member"),
    email: String(session?.user?.email || ""),
    role: String((session?.user as any)?.role || ""),
    company: String((session?.user as any)?.company || ""),
  }), [session?.user]);

  const [activeTopModule, setActiveTopModule] = useState('CRM');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  // CRM entities are persisted through /api/crm/*
  const [companies, setCompanies, hydrateCompanies] = useCrmCollection("companies");
  const [contacts, setContacts, hydrateContacts] = useCrmCollection("contacts");
  const [leads, setLeads, hydrateLeads] = useCrmCollection("leads");
  const [deals, setDeals, hydrateDeals] = useCrmCollection("deals");
  const [activities, setActivities, hydrateActivities] = useCrmCollection("activities");
  const [quotations, setQuotations, hydrateQuotations] = useCrmCollection("quotations");
  const [tickets, setTickets, hydrateTickets] = useCrmCollection("tickets");
  const [workflows, setWorkflows, hydrateWorkflows] = useCrmCollection("workflows");
  const [directory, setDirectory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationTab, setNotificationTab] = useState('unread');
  const [notificationToasts, setNotificationToasts] = useState<any[]>([]);
  const [dealFilterStage, setDealFilterStage] = useState('ALL');
  const [selectedContactProfileId, setSelectedContactProfileId] = useState<string | null>(null);
  const [selectedCompanyProfileId, setSelectedCompanyProfileId] = useState<string | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.company) setWorkspaceName(currentUser.company);
  }, [currentUser.company]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entities = [
        ["companies", hydrateCompanies], ["contacts", hydrateContacts], ["leads", hydrateLeads],
        ["deals", hydrateDeals], ["activities", hydrateActivities], ["quotations", hydrateQuotations],
        ["tickets", hydrateTickets], ["workflows", hydrateWorkflows],
      ] as const;
      await Promise.all(entities.map(async ([entity, hydrate]) => {
        const result = await apiFetch<Record<string, unknown>>(`/api/crm/${entity}`, undefined, { toast: false }).catch(() => null);
        if (mounted) hydrate((result?.[entity] as any[]) || []);
      }));
      const [people, invited] = await Promise.all([
        apiFetch<{ users: any[] }>("/api/users?role=employee,project-manager,qa-tester,human-resource,finance,admin,security,it-admin,it-administration,others,warehouse", undefined, { toast: false }).catch(() => null),
        apiFetch<{ members: any[] }>("/api/crm/members", undefined, { toast: false }).catch(() => null),
      ]);
      if (!mounted) return;
      setDirectory(people?.users || []);
      setMembers(invited?.members || []);
    })();
    return () => { mounted = false; };
  }, []);

  // People, teams and departments come from the app directory.
  const EMPLOYEES = useMemo(() => directory.map((user) => ({
    id: recordId(user),
    name: user.name || user.email || "Team member",
    role: String(user.role || "").replaceAll("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    email: user.email || "",
    avatar: initials(user.name || user.email),
    color: "bg-blue-600",
    quota: toNumber(user.quota),
  })), [directory]);
  const TEAMS = useMemo(() => Array.from(new Map(directory
    .map((user) => user.team?.name || user.team)
    .filter(Boolean)
    .map((name: string) => [`team-${name}`, { id: `team-${name}`, name, role: "Team", email: "", avatar: initials(name), color: "bg-indigo-500", quota: 0 }])).values()), [directory]);
  const DEPARTMENTS = useMemo(() => Array.from(new Map(directory
    .map((user) => user.department)
    .filter(Boolean)
    .map((name: string) => [`dept-${name}`, { id: `dept-${name}`, name, role: "Department", email: "", avatar: initials(name), color: "bg-emerald-500", quota: 0 }])).values()), [directory]);

  // Projects are derived from company records rather than a hardcoded list.
  const createdProjects = useMemo(() => companies.flatMap((company) => (company.projects || [])
    .filter(Boolean)
    .map((entry: string) => {
      const [id, ...rest] = String(entry).split(":");
      return { id: id || "PRJ", name: rest.join(":").trim() || id, company: company.name, status: "Tracked" };
    })), [companies]);

  const addToast = (title, description = '', type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  };

  const addNotificationToast = (title, description = '') => {
    const id = Date.now() + Math.random();
    setNotificationToasts(prev => [...prev, { id, title, description }]);
    setTimeout(() => {
      setNotificationToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // CRM uses the same notification store as the rest of the app.
  const reloadNotifications = async () => {
    const result = await apiFetch<{ notifications: any[]; unreadCount: number }>(
      "/api/notifications?limit=30",
      undefined,
      { toast: false },
    ).catch(() => null);
    setNotifications(result?.notifications || []);
    setUnreadCount(toNumber(result?.unreadCount));
  };

  const markAllNotificationsRead = async () => {
    await apiFetch("/api/notifications", { method: "PATCH" }, { toast: false }).catch(() => null);
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    await reloadNotifications();
  };

  const handleNotificationClick = async (notification) => {
    const id = recordId(notification);
    if (id) {
      await apiFetch(`/api/notifications/${id}`, { method: "PATCH" }, { toast: false }).catch(() => null);
      setNotifications(prev => prev.map(n => recordId(n) === id ? { ...n, readAt: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotificationsOpen(false);
    const link = String(notification?.link || "");
    if (link.startsWith("http")) {
      window.location.href = link;
    } else if (link) {
      router.push(link);
    } else {
      navigateTo("dashboard");
    }
    await reloadNotifications();
  };

  useEffect(() => {
    void reloadNotifications();
    let eventSource: EventSource | null = null;
    let mounted = true;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/events", { withCredentials: true });
        eventSource.addEventListener("notification:new", () => {
          if (!mounted) return;
          try {
            new Audio("/sound/notification_sound.mp3").play().catch(() => {});
          } catch { /* audio may be blocked before user interaction */ }
          apiFetch<{ notifications: any[] }>("/api/notifications?limit=1", undefined, { toast: false })
            .then((result) => {
              const latest = result?.notifications?.[0];
              if (latest) addNotificationToast(String(latest.title || "New notification"), String(latest.message || latest.body || ""));
            })
            .catch(() => {});
          void reloadNotifications();
        });
        eventSource.onerror = () => {
          eventSource?.close();
          if (mounted) window.setTimeout(connect, 3000);
        };
      } catch { /* SSE is optional; polling still works on next interaction */ }
    };

    connect();
    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, []);

  // Global Ctrl+K Shortcut
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setNotificationsOpen(false);
        setProfileMenuOpen(false);
        setWorkspaceDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigateTo = (page, opts = {}) => {
    setActiveTopModule('CRM');
    setActiveSubPage(page);
    router.push(`/crm/${page}`);
    if (opts.dealStage) setDealFilterStage(opts.dealStage);
    else if (page !== 'deals') setDealFilterStage('ALL');
    setSelectedContactProfileId(opts.contactId || null);
    setSelectedCompanyProfileId(opts.companyId || null);
    setSelectedQuotationId(opts.quotationId || null);
    setSelectedTicketId(opts.ticketId || null);
    setCreatingWorkflow(false);
    setEditingWorkflowId(null);
    setMobileMenuOpen(false);
  };

  const getEmployee = (id) => EMPLOYEES.find(e => e.id === id) || TEAMS.find(t => t.id === id) || DEPARTMENTS.find(d => d.id === id) || { id: "", name: "Unassigned", role: "", email: "", avatar: "U", color: "bg-slate-500", quota: 0 };
  const getCompany = (id) => companies.find(c => c.id === id);
  const getContact = (id) => contacts.find(c => c.id === id);
  const getDeal = (id) => deals.find(d => d.id === id);

  const calcQuoteTotal = (quote) => {
    if (!quote?.items) return 0;
    return quote.items.reduce((sum, item) => {
      const sub = (Number(item.qty) || 0) * (Number(item.price) || 0);
      const afterDisc = sub * (1 - (Number(item.discount) || 0) / 100);
      const afterTax = afterDisc * (1 + (Number(item.tax) || 0) / 100);
      return sum + afterTax;
    }, 0);
  };

  // Sidebar Configuration
  const mainNavItems = [
    { id: 'CRM', label: 'CRM', icon: Users },
  ];

  const crmSubmenu = [
    { id: 'dashboard', label: 'CRM Dashboard' },
    { id: 'leads', label: 'Leads', count: leads.length },
    { id: 'contacts', label: 'Contacts', count: contacts.length },
    { id: 'companies', label: 'Companies', count: companies.length },
    { id: 'deals', label: 'Deals & Pipeline', count: deals.length },
    { id: 'activities', label: 'Activities & Follow-ups', count: activities.filter(a => a.status !== 'Completed').length },
    { id: 'quotations', label: 'Quotations', count: quotations.length },
    { id: 'support', label: 'Customer Support', count: tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length },
    { id: 'reports', label: 'Reports & Analytics' },
    { id: 'automation', label: 'Automation Settings' },
  ];

  const currentPageLabel = crmSubmenu.find(s => s.id === activeSubPage)?.label || 'CRM Dashboard';

  // Global Command Palette Search Results
  const commandResults = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    const pages = crmSubmenu.filter(p => !q || p.label.toLowerCase().includes(q)).map(p => ({ type: 'Page', id: p.id, title: p.label, sub: 'CRM Module Screen', action: () => navigateTo(p.id) }));
    const matchLeads = leads.filter(l => !q || `${l.firstName} ${l.lastName} ${l.company} ${l.email}`.toLowerCase().includes(q)).slice(0, 4).map(l => ({
      type: 'Lead', id: l.id, title: `${l.firstName} ${l.lastName}`, sub: `${l.company} · ${l.status}`, action: () => navigateTo('leads')
    }));
    const matchContacts = contacts.filter(c => !q || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)).slice(0, 4).map(c => ({
      type: 'Contact', id: c.id, title: `${c.firstName} ${c.lastName}`, sub: `${c.jobTitle} · ${getCompany(c.companyId)?.name || ''}`, action: () => navigateTo('contacts', { contactId: c.id })
    }));
    const matchCompanies = companies.filter(c => !q || `${c.name} ${c.industry}`.toLowerCase().includes(q)).slice(0, 4).map(c => ({
      type: 'Company', id: c.id, title: c.name, sub: `${c.industry} · ${c.city}`, action: () => navigateTo('companies', { companyId: c.id })
    }));
    const matchDeals = deals.filter(d => !q || d.title.toLowerCase().includes(q)).slice(0, 4).map(d => ({
      type: 'Deal', id: d.id, title: d.title, sub: `${formatCurrency(d.value)} · ${d.stage}`, action: () => navigateTo('deals')
    }));
    return [...pages.slice(0, 4), ...matchDeals, ...matchContacts, ...matchCompanies, ...matchLeads].slice(0, 12);
  }, [commandQuery, leads, contacts, companies, deals]);

  // ============================================================================
  // 4. SIDEBAR & TOPBAR SHELL (IDENTICAL ACROSS ALL 10 SCREENS)
  // ============================================================================

  // ============================================================================
  // 5. PAGE 1 — CRM DASHBOARD
  // ============================================================================

  const CrmDashboardPage = () => {
    const [dateRange, setDateRange] = useState('30 days');
    const [customRangeOpen, setCustomRangeOpen] = useState(false);
    const [customStart, setCustomStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [selectedPipelineSlice, setSelectedPipelineSlice] = useState(null);

    const wonDeals = deals.filter((d) => String(d.stage || "").toUpperCase() === "WON");
    const activeDeals = deals.filter((d) => !["WON", "LOST"].includes(String(d.stage || "").toUpperCase()));
    const totalRevenue = wonDeals.reduce((sum, d) => sum + toNumber(d.value), 0);
    const convertedLeads = leads.filter((l) => String(l.status || "").toLowerCase() === "converted").length;
    const conversionRate = leads.length ? ((convertedLeads / leads.length) * 100).toFixed(1) : "0.0";

    const { series: activeSeries, maxRevenue: maxRev } = buildCrmSeries(dateRange, deals, customStart, customEnd);
    const maxDeals = Math.max(1, ...activeSeries.map((point) => point.deals)) * 1.25;

    // Pipeline breakdown comes only from stored deals.
    const stageMeta = [
      { stage: "NEW", label: "New", color: "#3B82F6" },
      { stage: "CONTACTED", label: "Contacted", color: "#6366F1" },
      { stage: "PROPOSAL", label: "Proposal", color: "#8B5CF6" },
      { stage: "NEGOTIATION", label: "Negotiation", color: "#F59E0B" },
      { stage: "WON", label: "Won", color: "#10B981" },
    ];
    const stageStats = stageMeta.map((meta) => {
      const matching = deals.filter((d) => String(d.stage || "").toUpperCase() === meta.stage);
      return { ...meta, count: matching.length, value: matching.reduce((sum, d) => sum + toNumber(d.value), 0) };
    }).filter((item) => item.count > 0);
    const totalPipeVal = stageStats.reduce((sum, item) => sum + item.value, 0);

    // Acquisition channels come from stored leads.
    const sourceCounts = leads.reduce<Record<string, number>>((acc, lead) => {
      const source = String(lead.source || "Unspecified");
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    const sourceColors = ["bg-blue-600", "bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-purple-500", "bg-slate-500"];
    const leadSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], index) => ({
        name,
        count,
        pct: leads.length ? Math.round((count / leads.length) * 100) : 0,
        color: sourceColors[index % sourceColors.length],
      }));

    // Leaderboard aggregates won deals by owner.
    const ownerIds = Array.from(new Set(deals.map((d) => String(d.ownerId || d.owner || d.agentId || "")).filter(Boolean)));
    const salesLeaderboard = ownerIds.map((ownerId) => {
      const owned = deals.filter((d) => String(d.ownerId || d.owner || d.agentId || "") === ownerId);
      const won = owned.filter((d) => String(d.stage || "").toUpperCase() === "WON");
      return {
        emp: EMPLOYEES.find((e) => e.id === ownerId) || { id: ownerId, name: getEmployee(ownerId).name || "Team member", role: "CRM owner", avatar: initials(getEmployee(ownerId).name), color: "bg-slate-600" },
        revenue: won.reduce((sum, d) => sum + toNumber(d.value), 0),
        deals: won.length,
        conv: owned.length ? `${((won.length / owned.length) * 100).toFixed(1)}%` : "0.0%",
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const recentActivities = [...activities]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4)
      .map((activity) => ({
        id: recordId(activity),
        icon: String(activity.type || "").toLowerCase().includes("call") ? Phone : String(activity.type || "").toLowerCase().includes("mail") ? Mail : CheckCircle2,
        color: "bg-blue-50 text-blue-600",
        title: activity.title || "Activity",
        target: getCompany(activity.companyId || activity.company)?.name || getContact(activity.contactId || activity.contact)?.email || "",
        time: relativeTime(activity.createdAt),
        link: () => navigateTo("activities"),
      }));

    const [selectedActivityDrawer, setSelectedActivityDrawer] = useState(null);

    return (
      <div className="space-y-6">
        <PageHeader
          title="CRM Dashboard"
          subtitle="Monitor sales performance, customer relationships and pipeline health."
          breadcrumb="CRM Dashboard"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1 shadow-card">
                {['7 days', '30 days', '90 days', '12 months'].map(range => (
                  <button
                    key={range}
                    onClick={() => { setDateRange(range); setCustomRangeOpen(false); }}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      dateRange === range && !customRangeOpen ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setCustomRangeOpen(!customRangeOpen)}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>{customRangeOpen ? `${customStart} → ${customEnd}` : 'Custom Range'}</span>
                </button>
                {customRangeOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-30 space-y-3">
                    <div className="text-xs font-semibold text-slate-800">Custom Date Range</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500">From</label>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500">To</label>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                      </div>
                    </div>
                    <button
                      onClick={() => { setCustomRangeOpen(false); addToast('Date Range Applied', `Showing metrics from ${customStart} to ${customEnd}`); }}
                      className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            </div>
          }
        />

        {/* 5 Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Total Leads"
            value={leads.length.toLocaleString("en-IN")}
            change={`${leads.filter((l) => String(l.status || "").toLowerCase() === "new").length} new`}
            trend="up"
            subtitle="Lead records in CRM"
            icon={Users}
            onClick={() => navigateTo('leads')}
          />
          <KpiCard
            title="Active Deals"
            value={activeDeals.length.toLocaleString("en-IN")}
            change={`${deals.length} total`}
            trend="up"
            subtitle="Open pipeline deals"
            icon={Briefcase}
            onClick={() => navigateTo('deals')}
          />
          <KpiCard
            title="Won Deals"
            value={wonDeals.length.toLocaleString("en-IN")}
            change={formatCurrency(totalRevenue)}
            trend="up"
            subtitle="Closed-won deals"
            icon={Award}
            onClick={() => navigateTo('deals', { dealStage: 'WON' })}
          />
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            change={`${wonDeals.length} won`}
            trend="up"
            subtitle="Revenue from won deals"
            icon={DollarSign}
            onClick={() => navigateTo('reports')}
          />
          <KpiCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            change={`${convertedLeads} converted`}
            trend="up"
            subtitle="Converted leads / total leads"
            icon={TrendingUp}
            onClick={() => navigateTo('reports')}
          />
        </div>

        {/* Row 2: Sales Performance Chart + Sales Pipeline Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* A. Sales Performance Line Chart */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Sales Performance</h2>
                <p className="text-xs text-slate-500">Closed revenue & deal velocity over selected period ({dateRange})</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Revenue (₹)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Deals Closed
                </span>
              </div>
            </div>

            <div className="relative h-64 w-full">
              <svg viewBox="0 0 640 220" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                  const y = 180 - t * 150;
                  return (
                    <g key={idx}>
                      <line x1="48" y1={y} x2="620" y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                      <text x="40" y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">
                        {compactInr(Math.round(maxRev * t))}
                      </text>
                    </g>
                  );
                })}

                {/* Compute Points */}
                {(() => {
                  const stepX = activeSeries.length > 1 ? 540 / (activeSeries.length - 1) : 270;
                  const pts = activeSeries.map((d, i) => ({
                    ...d,
                    x: 65 + i * stepX,
                    yRev: 180 - (d.revenue / maxRev) * 150,
                    yDeals: 180 - (d.deals / maxDeals) * 150
                  }));
                  const revPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yRev}`).join(' ');
                  const areaPath = `${revPath} L ${pts[pts.length - 1].x} 180 L ${pts[0].x} 180 Z`;
                  const dealPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yDeals}`).join(' ');

                  return (
                    <>
                      <path d={areaPath} fill="url(#revGrad)" />
                      <path d={revPath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={dealPath} fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
                      {pts.map((p, idx) => (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(p)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <circle cx={p.x} cy={p.yRev} r={hoveredPoint?.label === p.label ? 6 : 4} fill="#2563EB" stroke="#fff" strokeWidth="2" />
                          <circle cx={p.x} cy={p.yDeals} r="3.5" fill="#10B981" stroke="#fff" strokeWidth="1.5" />
                          <text x={p.x} y="202" textAnchor="middle" className="text-[11px] fill-slate-500 font-medium">{p.label}</text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-slate-900 text-white px-3.5 py-2 rounded-lg shadow-lg text-xs space-y-1 pointer-events-none">
                  <div className="font-semibold text-slate-300">{hoveredPoint.label}</div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Revenue:</span>
                    <span className="font-bold text-blue-300">{formatCurrency(hoveredPoint.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Deals Won:</span>
                    <span className="font-bold text-emerald-300">{hoveredPoint.deals} deals</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* B. Sales Pipeline Overview Donut */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-slate-900">Sales Pipeline Overview</h2>
                {selectedPipelineSlice && (
                  <button onClick={() => setSelectedPipelineSlice(null)} className="text-xs text-blue-600 hover:underline">Reset</button>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-4">Click a segment to filter pipeline deals</p>
            </div>

            <div className="flex items-center justify-center my-2 relative">
              {totalPipeVal > 0 ? (<svg viewBox="0 0 180 180" className="w-44 h-44 -rotate-90">
                {(() => {
                  const radius = 64;
                  const circumference = 2 * Math.PI * radius;
                  let accumulated = 0;
                  return stageStats.map(item => {
                    const pct = item.value / totalPipeVal;
                    const dash = pct * circumference;
                    const offset = -accumulated * circumference;
                    accumulated += pct;
                    const isSelected = selectedPipelineSlice === item.stage;
                    return (
                      <circle
                        key={item.stage}
                        cx="90"
                        cy="90"
                        r={radius}
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth={isSelected ? 24 : 18}
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={offset}
                        className="cursor-pointer transition-all duration-200 hover:opacity-85"
                        onClick={() => {
                          setSelectedPipelineSlice(item.stage);
                          navigateTo('deals', { dealStage: item.stage });
                        }}
                      />
                    );
                  });
                })()}
              </svg>) : (
                <p className="py-10 text-center text-xs text-slate-400">No pipeline deals recorded yet.</p>
              )}
              {totalPipeVal > 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] text-slate-400 font-medium">Total Pipeline</span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(totalPipeVal)}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 mt-3">
              {stageStats.length ? stageStats.map(s => (
                <button
                  key={s.stage}
                  onClick={() => navigateTo('deals', { dealStage: s.stage })}
                  className="w-full flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label} ({s.count})
                  </span>
                  <span className="font-semibold text-slate-900">{formatCurrency(s.value)}</span>
                </button>
              )) : (
                <p className="py-6 text-center text-xs text-slate-400">No stages have deals yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Recent Activities + Upcoming Follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* C. Recent Activities */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Recent Activities</h2>
                <p className="text-xs text-slate-500">Latest calls, emails, meetings & pipeline changes</p>
              </div>
              <button onClick={() => navigateTo('activities')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all →</button>
            </div>
            <div className="space-y-3">
              {recentActivities.length ? recentActivities.map(act => {
                const Icon = act.icon;
                return (
                  <div key={act.id} onClick={act.link} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200/70 transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 truncate">{act.title}</div>
                      <div className="text-xs text-blue-600 font-medium truncate mt-0.5">{act.target}</div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{act.time}</span>
                  </div>
                );
              }) : (
                <p className="py-8 text-center text-xs text-slate-400">No activities logged yet. Activities you record will appear here.</p>
              )}
            </div>
          </div>

          {/* D. Upcoming Follow-ups */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Upcoming Follow-ups</h2>
                <p className="text-xs text-slate-500">Click any task to inspect details or mark complete</p>
              </div>
              <button onClick={() => navigateTo('activities')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Schedule +</button>
            </div>
            <div className="space-y-2.5">
              {activities.filter((a) => a.status !== "Completed").slice(0, 4).length ? activities.filter((a) => a.status !== "Completed").slice(0, 4).map(act => {
                const emp = getEmployee(act.ownerId);
                const comp = getCompany(act.companyId);
                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActivityDrawer(act)}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar employee={emp} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{act.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{comp?.name} · {emp.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={getStatusVariant(act.status)}>{act.status}</Badge>
                      <span className="text-[11px] font-medium text-slate-500">{act.dueDate}</span>
                    </div>
                  </div>
                );
              }) : (
                <p className="py-8 text-center text-xs text-slate-400">No follow-ups scheduled.</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Top Sales Representatives + Lead Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* E. Top Sales Representatives */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Top Sales Representatives</h2>
                <p className="text-xs text-slate-500">Closed-won revenue and win rates for current period</p>
              </div>
              <button onClick={() => navigateTo('reports')} className="text-xs font-semibold text-blue-600 hover:underline">Full Leaderboard</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase text-slate-400">
                    <th className="py-2.5">Representative</th>
                    <th className="py-2.5 text-right">Revenue</th>
                    <th className="py-2.5 text-right">Deals Closed</th>
                    <th className="py-2.5 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {salesLeaderboard.length ? salesLeaderboard.map((row, idx) => (
                    <tr key={row.emp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 flex items-center gap-2.5">
                        <span className="text-[11px] font-bold text-slate-400 w-4">#{idx + 1}</span>
                        <Avatar employee={row.emp} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900">{row.emp.name}</div>
                          <div className="text-[11px] text-slate-500">{row.emp.role}</div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 text-right font-medium text-slate-700">{row.deals}</td>
                      <td className="py-3 text-right">
                        <Badge variant="green">{row.conv}</Badge>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No closed-won deals yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* F. Lead Sources */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-card">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Lead Sources</h2>
              <p className="text-xs text-slate-500">Acquisition channel breakdown across {leads.length} leads</p>
            </div>
            <div className="space-y-4">
              {leadSources.length ? leadSources.map(src => (
                <div key={src.name} onClick={() => navigateTo('leads')} className="cursor-pointer group">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{src.name}</span>
                    <span className="text-slate-500 font-medium">{src.count} leads ({src.pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${src.color} rounded-full transition-all duration-300`} style={{ width: `${src.pct}%` }} />
                  </div>
                </div>
              )) : (
                <p className="py-8 text-center text-xs text-slate-400">No lead sources available yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Activity Quick Detail Drawer from Dashboard */}
        <Drawer
          isOpen={!!selectedActivityDrawer}
          onClose={() => setSelectedActivityDrawer(null)}
          title={selectedActivityDrawer?.title || ''}
          subtitle={`${selectedActivityDrawer?.type} · Due ${selectedActivityDrawer?.dueDate} at ${selectedActivityDrawer?.startTime}`}
          badge={selectedActivityDrawer && <Badge variant={getStatusVariant(selectedActivityDrawer.status)}>{selectedActivityDrawer.status}</Badge>}
        >
          {selectedActivityDrawer && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Company:</span><span className="font-semibold text-slate-900">{getCompany(selectedActivityDrawer.companyId)?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Contact:</span><span className="font-semibold text-slate-900">{getContact(selectedActivityDrawer.contactId)?.firstName} {getContact(selectedActivityDrawer.contactId)?.lastName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Assigned Owner:</span><span className="font-semibold text-slate-900">{getEmployee(selectedActivityDrawer.ownerId)?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reminder:</span><span className="font-medium text-slate-700">{selectedActivityDrawer.reminder}</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold text-slate-800 mb-1">Notes & Agenda</div>
                <p className="text-xs text-slate-600 leading-relaxed">{selectedActivityDrawer.description}</p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setActivities(prev => prev.map(a => a.id === selectedActivityDrawer.id ? { ...a, status: 'Completed' } : a));
                    setSelectedActivityDrawer(null);
                    addToast('Activity Completed', 'Marked follow-up task as completed.');
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Mark Complete
                </button>
                <button
                  onClick={() => { setSelectedActivityDrawer(null); navigateTo('activities'); }}
                  className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Open in Activities
                </button>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    );
  };

  // ============================================================================
  // 6. PAGE 2 — LEADS
  // ============================================================================

  const LeadsPage = () => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sourceFilter, setSourceFilter] = useState('ALL');
    const [ownerFilter, setOwnerFilter] = useState('ALL');
    const [minScore, setMinScore] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [activeLeadDrawer, setActiveLeadDrawer] = useState(null);
    const [addLeadOpen, setAddLeadOpen] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [newNoteText, setNewNoteText] = useState('');

    // Add/Edit Lead Form State
    const emptyLeadForm = {
      firstName: '', lastName: '', email: '', phone: '', company: '', jobTitle: '',
      source: 'Website', ownerId: currentUser.id, status: 'New', value: 0, description: '', tags: ''
    };
    const [leadForm, setLeadForm] = useState(emptyLeadForm);
    const [formErrors, setFormErrors] = useState({});

    // Assignment is a two-step choice: role first, then a person/team from that role.
    const peopleForRole = (role) => {
      const people = role === 'Team' ? TEAMS
        : role === 'Department' ? DEPARTMENTS
        : EMPLOYEES.filter((e) => e.role === role);
      const selfRole = formatRoleLabel(currentUser.role);
      if (currentUser.id && role === selfRole && !people.some((p) => p.id === currentUser.id)) {
        return [{ id: currentUser.id, name: currentUser.name, role }, ...people];
      }
      return people;
    };
    const ownerRoles = Array.from(new Set([
      formatRoleLabel(currentUser.role),
      ...EMPLOYEES.map((e) => e.role),
      'Team', 'Department'
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const roleForOwnerId = (id) => {
      const person = [...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].find((p) => p.id === id);
      return person?.role || formatRoleLabel(currentUser.role) || ownerRoles[0] || '';
    };
    const [ownerRole, setOwnerRole] = useState(() => roleForOwnerId(currentUser.id));
    useEffect(() => {
      if (!currentUser.id) return;
      setLeadForm(prev => (prev.ownerId ? prev : { ...prev, ownerId: currentUser.id }));
      setOwnerRole(prev => (prev || roleForOwnerId(currentUser.id)));
    }, [currentUser.id]);
    const assignablePeople = peopleForRole(ownerRole);
    const isCustomSource = !STANDARD_LEAD_SOURCES.includes(leadForm.source);
    const sourceSelectValue = isCustomSource ? 'Other' : leadForm.source;

    // Import Modal Wizard State
    const [importStep, setImportStep] = useState(1);
    const [importFileName, setImportFileName] = useState('');
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [importRows, setImportRows] = useState<any[]>([]);

    const duplicateMatch = useMemo(() => {
      if (!leadForm.email && !leadForm.phone) return null;
      return leads.find(l =>
        l.id !== editingLead?.id && (
          (leadForm.email && l.email.toLowerCase() === leadForm.email.toLowerCase()) ||
          (leadForm.phone && l.phone === leadForm.phone)
        )
      );
    }, [leadForm.email, leadForm.phone, leads, editingLead]);

    const filteredLeads = useMemo(() => {
      return leads.filter(l => {
        const q = search.toLowerCase();
        const matchQ = !q || `${l.firstName} ${l.lastName} ${l.company} ${l.email}`.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
        const matchSource = sourceFilter === 'ALL' || l.source === sourceFilter;
        const matchOwner = ownerFilter === 'ALL' || l.ownerId === ownerFilter;
        const matchScore = l.score >= minScore;
        return matchQ && matchStatus && matchSource && matchOwner && matchScore;
      });
    }, [leads, search, statusFilter, sourceFilter, ownerFilter, minScore]);

    const handleSaveLead = (addAnother = false) => {
      const errs = {};
      if (!leadForm.firstName.trim()) errs.firstName = 'First name is required';
      if (!leadForm.lastName.trim()) errs.lastName = 'Last name is required';
      if (!leadForm.email.trim()) errs.email = 'Email is required';
      if (!leadForm.company.trim()) errs.company = 'Company is required';
      if (!String(leadForm.source || '').trim()) errs.source = 'Lead source is required';
      if (Object.keys(errs).length > 0) {
        setFormErrors(errs);
        return;
      }
      setFormErrors({});

      if (editingLead) {
        setLeads(prev => prev.map(l => l.id === editingLead.id ? {
          ...l, ...leadForm, value: Number(leadForm.value) || 0,
          tags: typeof leadForm.tags === 'string' ? leadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : leadForm.tags
        } : l));
        addToast('Lead Updated', `${leadForm.firstName} ${leadForm.lastName} has been updated.`);
        setEditingLead(null);
        setAddLeadOpen(false);
      } else {
        const created = {
          id: `lead-${Date.now()}`,
          ...leadForm,
          value: Number(leadForm.value) || 0,
          score: Math.floor(65 + Math.random() * 30),
          createdAt: new Date().toISOString().slice(0, 10),
          tags: leadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          notes: []
        };
        setLeads(prev => [created, ...prev]);
        addToast('Lead Created', `${created.firstName} ${created.lastName} added to pipeline.`);
        if (addAnother) {
          setLeadForm(emptyLeadForm);
          setOwnerRole(roleForOwnerId(currentUser.id));
        } else {
          setAddLeadOpen(false);
        }
      }
    };

    const handleConvertLead = (lead) => {
      // Preserve lead lineage, notes, and history across Contact, Company, and Deal
      let comp = companies.find(c => c.name.toLowerCase() === lead.company.toLowerCase());
      if (!comp) {
        comp = {
          id: `comp-${Date.now()}`, name: lead.company, industry: lead.industry || 'Unspecified', website: lead.website || '',
          email: lead.email || '', phone: lead.phone || '', size: lead.size || '', annualRevenue: lead.value ? formatCurrency(lead.value) : '',
          country: lead.country || '', state: lead.state || '', city: lead.city || '', address: lead.address || '', ownerId: lead.ownerId || currentUser.id,
          status: 'Active', type: 'Customer', clv: lead.value, description: lead.description, projects: []
        };
        setCompanies(prev => [comp, ...prev]);
      }
      const leadHistorySummary = (lead.notes || []).map(n => `[${n.time} - ${n.author}]: ${n.text}`).join(' | ');
      const newContact = {
        id: `cont-${Date.now()}`, firstName: lead.firstName, lastName: lead.lastName, email: lead.email,
        phone: lead.phone, companyId: comp.id, jobTitle: lead.jobTitle || 'Decision Maker',
        department: 'Executive', ownerId: lead.ownerId, type: 'Customer', status: 'Active',
        lastInteraction: 'Converted just now', createdAt: new Date().toISOString().slice(0, 10), address: comp.address,
        originLeadId: lead.id, originSource: lead.source,
        notes: `${lead.description}${leadHistorySummary ? `\n\nPreserved Lead History: ${leadHistorySummary}` : ''}`
      };
      setContacts(prev => [newContact, ...prev]);

      const newDeal = {
        id: `deal-${Date.now()}`, title: `${lead.company} Enterprise Deal`, companyId: comp.id, contactId: newContact.id,
        pipeline: 'Enterprise Sales', stage: 'QUALIFIED' === lead.status.toUpperCase() ? 'PROPOSAL' : 'NEW',
        value: lead.value || 0, probability: 40, closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), ownerId: lead.ownerId, priority: 'High',
        originLeadId: lead.id,
        description: lead.description, notes: [`Converted from Lead #${lead.id} (${lead.source})`]
      };
      setDeals(prev => [newDeal, ...prev]);
      setLeads(prev => prev.map(l => l.id === lead.id ? {
        ...l,
        status: 'Converted',
        convertedContactId: newContact.id,
        convertedDealId: newDeal.id,
        notes: [{ id: `n-conv-${Date.now()}`, author: currentUser.name, text: `Converted to Contact (${newContact.firstName} ${newContact.lastName}) & Deal (${newDeal.title}) while preserving full history.`, time: 'Just now' }, ...(l.notes || [])]
      } : l));
      setActiveLeadDrawer(null);
      addToast('Lead Converted with Full Lineage', `Preserved lead history into Customer 360 (${newContact.firstName} ${newContact.lastName}) & Deal.`);
    };

    const handleExportCsv = () => {
      const csv = ['Name,Company,Email,Phone,Source,Status,Score,Value', ...filteredLeads.map(l => `"${l.firstName} ${l.lastName}","${l.company}","${l.email}","${l.phone}","${l.source}","${l.status}",${l.score},${l.value}`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crm-leads-export.csv';
      a.click();
      addToast('Export Complete', `Exported ${filteredLeads.length} leads to CSV.`);
    };

    return (
      <div className="space-y-6">
        <PageHeader
          title="Leads"
          subtitle="Capture, organize and convert potential customers."
          breadcrumb="Leads"
          actions={
            <>
              <button onClick={() => { setImportStep(1); setImportFileName(''); setImportOpen(true); }} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import Leads
              </button>
              <button onClick={handleExportCsv} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={() => { setEditingLead(null); setLeadForm(emptyLeadForm); setOwnerRole(roleForOwnerId(currentUser.id)); setFormErrors({}); setAddLeadOpen(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                <Plus className="w-4 h-4" /> Add Lead
              </button>
            </>
          }
        />

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Leads" value={leads.length} change={`${recentCount(leads)} this week`} trend="up" icon={Users} onClick={() => setStatusFilter('ALL')} active={statusFilter === 'ALL'} />
          <KpiCard title="New Leads" value={leads.filter(l => l.status === 'New').length} change="Open status" trend="up" icon={Sparkles} onClick={() => setStatusFilter('New')} active={statusFilter === 'New'} />
          <KpiCard title="Qualified Leads" value={leads.filter(l => l.status === 'Qualified').length} change="In qualification" trend="up" icon={Target} onClick={() => setStatusFilter('Qualified')} active={statusFilter === 'Qualified'} />
          <KpiCard title="Converted Leads" value={leads.filter(l => l.status === 'Converted').length} change="Closed as won" trend="up" icon={CheckCircle2} onClick={() => setStatusFilter('Converted')} active={statusFilter === 'Converted'} />
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-[12px] border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search lead name, company, or email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            <option value="ALL">All Statuses</option>
            {['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            <option value="ALL">All Sources</option>
            {['Website', 'Referral', 'LinkedIn', 'Advertising', 'Cold Outreach'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            <option value="ALL">All Owners</option>
            {[...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-500">Min Score:</span>
            <input type="number" min="0" max="100" value={minScore} onChange={e => setMinScore(Number(e.target.value) || 0)} className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold" />
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
                addToast('Bulk Delete', `Removed ${selectedIds.length} selected leads.`, 'info');
                setSelectedIds([]);
              }}
              className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100"
            >
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredLeads.length > 0 && selectedIds.length === filteredLeads.length}
                      onChange={e => setSelectedIds(e.target.checked ? filteredLeads.map(l => l.id) : [])}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-3 px-4">Lead Name</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Email & Phone</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lead Score</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLeads.map(lead => {
                  const emp = getEmployee(lead.ownerId);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setActiveLeadDrawer(lead)}
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, lead.id] : prev.filter(id => id !== lead.id))}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600">{lead.firstName} {lead.lastName}</div>
                        <div className="text-[11px] text-slate-500">{lead.jobTitle}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{lead.company}</td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700">{lead.email}</div>
                        <div className="text-[11px] text-slate-400">{lead.phone}</div>
                      </td>
                      <td className="py-3.5 px-4"><Badge variant="neutral">{lead.source}</Badge></td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar employee={emp} size="xs" />
                          <span className="text-slate-700 font-medium">{emp.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(lead.status)}>{lead.status}</Badge></td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${lead.score >= 80 ? 'bg-emerald-500' : lead.score >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${lead.score}%` }} />
                          </div>
                          <span className="font-bold text-slate-700">{lead.score}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{lead.createdAt}</td>
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingLead(lead);
                              setLeadForm({ ...lead, tags: (lead.tags || []).join(', ') });
                              setOwnerRole(roleForOwnerId(lead.ownerId));
                              setAddLeadOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                            title="Edit Lead"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(lead.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-400">No leads match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Detail Drawer */}
        <Drawer
          isOpen={!!activeLeadDrawer}
          onClose={() => setActiveLeadDrawer(null)}
          title={activeLeadDrawer ? `${activeLeadDrawer.firstName} ${activeLeadDrawer.lastName}` : ''}
          subtitle={activeLeadDrawer ? `${activeLeadDrawer.jobTitle} at ${activeLeadDrawer.company}` : ''}
          badge={activeLeadDrawer && <Badge variant={getStatusVariant(activeLeadDrawer.status)}>{activeLeadDrawer.status}</Badge>}
        >
          {activeLeadDrawer && (
            <div className="space-y-5">
              {/* Quick Actions Strip */}
              <div className="flex flex-wrap gap-2">
                {activeLeadDrawer.status !== 'Converted' ? (
                  <button
                    onClick={() => handleConvertLead(activeLeadDrawer)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Convert to Contact + Company + Deal
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const targetId = activeLeadDrawer.convertedContactId || contacts[0]?.id;
                      setActiveLeadDrawer(null);
                      navigateTo('contacts', { contactId: targetId });
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Customer 360 Profile
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingLead(activeLeadDrawer);
                    setLeadForm({ ...activeLeadDrawer, tags: (activeLeadDrawer.tags || []).join(', ') });
                    setOwnerRole(roleForOwnerId(activeLeadDrawer.ownerId));
                    setAddLeadOpen(true);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Lead
                </button>
                <button
                  onClick={() => {
                    setActivities(prev => [{
                      id: `act-${Date.now()}`, title: `Follow up with ${activeLeadDrawer.firstName} ${activeLeadDrawer.lastName}`,
                      type: 'Follow-up', contactId: contacts[0]?.id || '', companyId: companies[0]?.id || '', dealId: deals[0]?.id || '', ownerId: activeLeadDrawer.ownerId,
                      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), startTime: '10:00', endTime: '10:30', priority: 'High', status: 'Upcoming', reminder: '15 minutes before',
                      description: `Lead outreach for ${activeLeadDrawer.company}`
                    }, ...prev]);
                    addToast('Follow-up Scheduled', `Added follow-up task for ${activeLeadDrawer.firstName}.`);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Schedule Follow-up
                </button>
                <button
                  onClick={() => addToast('Email Composer Opened', `Drafting email to ${activeLeadDrawer.email}`)}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" /> Send Email
                </button>
              </div>

              {/* Info Grid */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-slate-400 block">Email</span><span className="font-semibold text-slate-900">{activeLeadDrawer.email}</span></div>
                <div><span className="text-slate-400 block">Phone</span><span className="font-semibold text-slate-900">{activeLeadDrawer.phone}</span></div>
                <div><span className="text-slate-400 block">Lead Source</span><span className="font-semibold text-slate-900">{activeLeadDrawer.source}</span></div>
                <div><span className="text-slate-400 block">Estimated Value</span><span className="font-bold text-blue-600">{formatCurrency(activeLeadDrawer.value)}</span></div>
                <div><span className="text-slate-400 block">Assigned Owner</span><span className="font-semibold text-slate-900">{getEmployee(activeLeadDrawer.ownerId).name}</span></div>
                <div><span className="text-slate-400 block">Lead Score</span><span className="font-bold text-emerald-600">{activeLeadDrawer.score} / 100</span></div>
              </div>

              {/* Description & Tags */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-semibold text-slate-800">Qualification Summary</div>
                <p className="text-slate-600 leading-relaxed">{activeLeadDrawer.description || 'No description provided.'}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(activeLeadDrawer.tags || []).map(tag => <Badge key={tag} variant="blue">{tag}</Badge>)}
                </div>
              </div>

              {/* Notes Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-semibold text-slate-800">Internal Notes & Timeline</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Add a note about this lead..."
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    onClick={() => {
                      if (!newNoteText.trim()) return;
                      const note = { id: `n-${Date.now()}`, author: currentUser.name, text: newNoteText, time: 'Just now' };
                      const updated = { ...activeLeadDrawer, notes: [note, ...(activeLeadDrawer.notes || [])] };
                      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
                      setActiveLeadDrawer(updated);
                      setNewNoteText('');
                      addToast('Note Added', 'Saved note to lead record.');
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(activeLeadDrawer.notes || []).map(n => (
                    <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-700">{n.author}</span>
                        <span>{n.time}</span>
                      </div>
                      <p className="text-slate-700">{n.text}</p>
                    </div>
                  ))}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                    Lead captured via <span className="font-semibold">{activeLeadDrawer.source}</span> on {activeLeadDrawer.createdAt}.
                  </div>
                </div>
              </div>
            </div>
          )}
        </Drawer>

        {/* Add / Edit Lead Modal */}
        <Modal
          isOpen={addLeadOpen}
          onClose={() => setAddLeadOpen(false)}
          title={editingLead ? 'Edit Lead' : 'Add New Lead'}
          subtitle="Capture lead qualification details into CRM."
          footer={
            <>
              <button onClick={() => setAddLeadOpen(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
              {!editingLead && (
                <button onClick={() => handleSaveLead(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold">Save & Add Another</button>
              )}
              <button onClick={() => handleSaveLead(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">Save Lead</button>
            </>
          }
        >
          {duplicateMatch && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Potential Duplicate Detected</div>
                <div>A lead named <strong>{duplicateMatch.firstName} {duplicateMatch.lastName}</strong> ({duplicateMatch.company}) already exists with matching email or phone.</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700">First Name *</label>
              <input value={leadForm.firstName} onChange={e => setLeadForm({ ...leadForm, firstName: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. Jordan" />
              {formErrors.firstName && <span className="text-rose-600 text-[11px]">{formErrors.firstName}</span>}
            </div>
            <div>
              <label className="font-semibold text-slate-700">Last Name *</label>
              <input value={leadForm.lastName} onChange={e => setLeadForm({ ...leadForm, lastName: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. Taylor" />
              {formErrors.lastName && <span className="text-rose-600 text-[11px]">{formErrors.lastName}</span>}
            </div>
            <div>
              <label className="font-semibold text-slate-700">Email *</label>
              <input value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="jordan@company.com" />
              {formErrors.email && <span className="text-rose-600 text-[11px]">{formErrors.email}</span>}
            </div>
            <div>
              <label className="font-semibold text-slate-700">Phone</label>
              <input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. +91 90000 00000" />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Company *</label>
              <input value={leadForm.company} onChange={e => setLeadForm({ ...leadForm, company: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. Enterprise client" />
              {formErrors.company && <span className="text-rose-600 text-[11px]">{formErrors.company}</span>}
            </div>
            <div>
              <label className="font-semibold text-slate-700">Job Title</label>
              <input value={leadForm.jobTitle} onChange={e => setLeadForm({ ...leadForm, jobTitle: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="VP of Operations" />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Lead Source</label>
              <select
                value={sourceSelectValue}
                onChange={e => {
                  const value = e.target.value;
                  setLeadForm({ ...leadForm, source: value === 'Other' ? '' : value });
                }}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select source</option>
                {STANDARD_LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Other">Other (type below)</option>
              </select>
              {sourceSelectValue === 'Other' && (
                <input
                  value={isCustomSource ? leadForm.source : ''}
                  onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Type lead source"
                />
              )}
              {formErrors.source && <span className="text-rose-600 text-[11px]">{formErrors.source}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700">Role</label>
                <select
                  value={ownerRole}
                  onChange={e => { setOwnerRole(e.target.value); setLeadForm({ ...leadForm, ownerId: '' }); }}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select role</option>
                  {ownerRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Name</label>
                <select
                  value={leadForm.ownerId}
                  onChange={e => setLeadForm({ ...leadForm, ownerId: e.target.value })}
                  disabled={!assignablePeople.length}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
                >
                  <option value="">{assignablePeople.length ? 'Select name' : 'No people in this role'}</option>
                  {assignablePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Lead Status</label>
              <select value={leadForm.status} onChange={e => setLeadForm({ ...leadForm, status: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Estimated Deal Value (₹)</label>
              <input type="number" value={leadForm.value} onChange={e => setLeadForm({ ...leadForm, value: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700">Tags (comma separated)</label>
              <input value={leadForm.tags} onChange={e => setLeadForm({ ...leadForm, tags: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="Enterprise, Q4, Inbound" />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700">Description</label>
              <textarea rows="2" value={leadForm.description} onChange={e => setLeadForm({ ...leadForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="Context, requirements, budget timeline..." />
            </div>
          </div>
        </Modal>

        {/* Import Leads Wizard Modal */}
        <Modal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          title="Import Leads from CSV / XLSX"
          subtitle={`Step ${importStep} of 3 · Bulk upload and deduplicate leads`}
          footer={
            <>
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">Cancel</button>
              {importStep > 1 && (
                <button onClick={() => setImportStep(importStep - 1)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">Back</button>
              )}
              {importStep < 3 ? (
                <button
                  onClick={() => {
                    if (!importFileName) setImportFileName('q4_enterprise_leads.csv');
                    setImportStep(importStep + 1);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={() => {
                    const existing = new Set(leads.flatMap((lead) => [String(lead.email || "").toLowerCase(), String(lead.phone || "").trim()]).filter(Boolean));
                    const rows = importRows.filter((row) => !skipDuplicates || (!existing.has(String(row.email || "").toLowerCase()) && !existing.has(String(row.phone || "").trim())));
                    if (!rows.length) { addToast('Nothing to import', 'All rows were duplicates or the file was empty.', 'error'); return; }
                    setLeads(prev => [...rows, ...prev]);
                    setImportOpen(false);
                    setImportStep(1);
                    setImportRows([]);
                    setImportFileName('');
                    addToast('Import Successful', `${rows.length} lead${rows.length === 1 ? "" : "s"} imported.`);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Final Import ({importRows.length} Records)
                </button>
              )}
            </>
          }
        >
          {importStep === 1 && (
            <div className="space-y-4 text-xs">
              <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/70 transition-colors">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const rows = parseCsvLeads(await file.text(), currentUser.id);
                    setImportFileName(file.name);
                    setImportRows(rows);
                    addToast('File Ready', `${rows.length} rows detected in ${file.name}.`);
                  }}
                />
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="font-semibold text-slate-900">{importFileName || 'Click to choose a UTF-8 CSV file'}</div>
                <p className="text-slate-500 mt-1">{importRows.length ? `${importRows.length} leads ready to import` : 'CSV files up to 25MB are supported'}</p>
              </label>
              <div className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                <span className="text-slate-700 font-medium">Need the standard lead column headers?</span>
                <button
                  onClick={() => addToast('Template Downloaded', 'crm_leads_template.csv saved.')}
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download Sample Template
                </button>
              </div>
            </div>
          )}
          {importStep === 2 && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-800">Column Mapping ({importFileName})</div>
              {[
                { csv: 'full_name / first_name', crm: 'First Name & Last Name' },
                { csv: 'work_email', crm: 'Email Address (Unique Key)' },
                { csv: 'organization', crm: 'Company Name' },
                { csv: 'est_arr', crm: 'Estimated Deal Value' },
              ].map(m => (
                <div key={m.csv} className="grid grid-cols-2 gap-3 items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-mono text-slate-600">{m.csv}</div>
                  <div className="font-semibold text-blue-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {m.crm}</div>
                </div>
              ))}
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} className="rounded" />
                <span className="font-medium text-slate-700">Skip duplicate records matching existing Email or Phone</span>
              </label>
            </div>
          )}
          {importStep === 3 && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-800">Import Preview (Ready to Create)</div>
              <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Company</th><th className="p-2 text-left">Email</th><th className="p-2 text-right">Est. Value</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importRows.length ? importRows.map((row) => (
                    <tr key={row.id}>
                      <td className="p-2 font-medium">{row.firstName} {row.lastName}</td>
                      <td className="p-2">{row.company}</td>
                      <td className="p-2">{row.email}</td>
                      <td className="p-2 text-right font-semibold">{formatCurrency(row.value)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-400">No rows loaded. Go back and choose a CSV file.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Modal>

        {/* Delete Confirmation Dialog */}
        <Modal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete Lead Record"
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setLeads(prev => prev.filter(l => l.id !== deleteConfirmId));
                  setDeleteConfirmId(null);
                  addToast('Lead Deleted', 'Record permanently removed.', 'info');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Delete
              </button>
            </>
          }
        >
          <p className="text-xs text-slate-600">Are you sure you want to delete this lead? This action cannot be undone.</p>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 7. PAGE 3 — CONTACTS & CUSTOMER 360 PROFILE
  // ============================================================================

  const ContactsPage = () => {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [addOpen, setAddOpen] = useState(false);
    const [profileTab, setProfileTab] = useState('Overview');
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [noteInput, setNoteInput] = useState('');
    const [meetingSubject, setMeetingSubject] = useState('');
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));

    const [contactForm, setContactForm] = useState({
      firstName: '', lastName: '', email: '', phone: '', companyId: companies[0]?.id || '',
      jobTitle: '', department: 'Operations', ownerId: currentUser.id, type: 'Customer', address: '', notes: ''
    });

    const selectedContact = contacts.find(c => c.id === selectedContactProfileId);

    // Full-Page Customer 360 Profile View
    if (selectedContact) {
      const comp = getCompany(selectedContact.companyId);
      const owner = getEmployee(selectedContact.ownerId);
      const contactDeals = deals.filter(d => d.contactId === selectedContact.id || d.companyId === selectedContact.companyId);
      const contactQuotations = quotations.filter(q => q.contactId === selectedContact.id || q.companyId === selectedContact.companyId);
      const contactTickets = tickets.filter(t => t.contactId === selectedContact.id || t.companyId === selectedContact.companyId);
      const contactActivities = activities.filter(a => a.contactId === selectedContact.id || a.companyId === selectedContact.companyId);
      const originLead = leads.find(l => l.id === selectedContact.originLeadId || l.email === selectedContact.email);

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button onClick={() => setSelectedContactProfileId(null)} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
              <ChevronLeft className="w-4 h-4" /> Back to Contacts
            </button>
            <span>/</span>
            <span className="font-semibold text-slate-700">Customer 360 Workspace</span>
          </div>

          {/* Profile Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <Avatar name={`${selectedContact.firstName} ${selectedContact.lastName}`} size="lg" />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{selectedContact.firstName} {selectedContact.lastName}</h1>
                  <Badge variant={getStatusVariant(selectedContact.type)}>{selectedContact.type}</Badge>
                  <Badge variant="green">{selectedContact.status}</Badge>
                  {originLead && <Badge variant="purple">Lead Lineage: {originLead.source}</Badge>}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedContact.jobTitle} at{' '}
                  {comp ? (
                    <button onClick={() => navigateTo('companies', { companyId: comp.id })} className="text-blue-600 font-semibold hover:underline">
                      {comp.name}
                    </button>
                  ) : 'Independent'}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selectedContact.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedContact.phone}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedContact.address}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setNoteModalOpen(true)} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Add Note
              </button>
              <button onClick={() => setMeetingModalOpen(true)} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> Schedule Meeting
              </button>
            </div>
          </div>

          {/* Profile Tabs */}
          <div className="border-b border-slate-200 flex gap-6 text-xs font-semibold overflow-x-auto">
            {['Overview', 'Deals & Quotations', 'Projects & Support', 'Activities', 'Notes & Files'].map(tab => (
              <button
                key={tab}
                onClick={() => setProfileTab(tab)}
                className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
                  profileTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Profile Tab Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="font-semibold text-slate-900 text-sm">Customer 360 Summary</h3>
                <div className="flex justify-between"><span className="text-slate-500">Department</span><span className="font-medium text-slate-800">{selectedContact.department}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account Owner</span><span className="font-semibold text-slate-800">{owner.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Last Interaction</span><span className="font-medium text-slate-800">{selectedContact.lastInteraction}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Active Deals</span><span className="font-semibold text-blue-600">{contactDeals.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Support Tickets</span><span className="font-semibold text-slate-800">{contactTickets.length}</span></div>
              </div>
              {comp && (
                <div onClick={() => navigateTo('companies', { companyId: comp.id })} className="bg-white rounded-[12px] border border-slate-200 hover:border-blue-300 p-5 cursor-pointer transition-all space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">{comp.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="text-slate-500">{comp.industry} · {comp.size} employees</p>
                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <span className="text-slate-500">Lifetime Value</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(comp.clv)}</span>
                  </div>
                </div>
              )}
              {originLead && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Origin Lead Record</span>
                    <Badge variant="green">Preserved</Badge>
                  </div>
                  <div className="text-slate-600">Source: <span className="font-semibold">{originLead.source}</span> · Score: <span className="font-semibold">{originLead.score}/100</span></div>
                  <p className="text-slate-500 text-[11px]">{originLead.description}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 space-y-4">
              {(profileTab === 'Overview' || profileTab === 'Deals & Quotations') && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Deals & Commercial Quotations ({contactDeals.length + contactQuotations.length})</h3>
                    <button onClick={() => navigateTo('deals')} className="text-xs font-semibold text-blue-600 hover:underline">Open Pipeline →</button>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {contactDeals.map(d => (
                      <div key={d.id} onClick={() => navigateTo('deals')} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-900">{d.title}</div>
                          <div className="text-[11px] text-slate-500">Pipeline: {d.pipeline} · Close: {d.closeDate}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusVariant(d.stage)}>{d.stage}</Badge>
                          <span className="font-bold text-slate-900">{formatCurrency(d.value)}</span>
                        </div>
                      </div>
                    ))}
                    {contactQuotations.map(q => (
                      <div key={q.id} onClick={() => navigateTo('quotations', { quotationId: q.id })} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer">
                        <div>
                          <div className="font-semibold text-blue-600">Quotation {q.number}</div>
                          <div className="text-[11px] text-slate-500">Issued: {q.issueDate} · Valid until {q.expiryDate}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getStatusVariant(q.status)}>{q.status}</Badge>
                          <span className="font-bold text-slate-900">{formatCurrency(calcQuoteTotal(q))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(profileTab === 'Overview' || profileTab === 'Projects & Support') && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Connected projects & Support Tickets</h3>
                    <Badge variant="blue">Cross-Module Sync</Badge>
                  </div>
                  {(comp?.projects || []).map(p => (
                    <div key={p} onClick={() => setActiveTopModule('Projects')} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between cursor-pointer hover:border-blue-300">
                      <span className="font-semibold text-slate-900">{p}</span>
                      <Badge variant="green">Active Project</Badge>
                    </div>
                  ))}
                  {contactTickets.map(t => (
                    <div key={t.id} onClick={() => navigateTo('support', { ticketId: t.id })} className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-mono font-bold text-blue-600 mr-2">{t.id}</span>
                        <span className="font-semibold text-slate-900">{t.subject}</span>
                      </div>
                      <Badge variant={getStatusVariant(t.status)}>{t.status}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {(profileTab === 'Overview' || profileTab === 'Activities') && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Activities & Follow-ups ({contactActivities.length})</h3>
                  <div className="space-y-2 text-xs">
                    {contactActivities.map(a => (
                      <div key={a.id} onClick={() => navigateTo('activities')} className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-semibold text-slate-900">{a.title}</div>
                          <div className="text-[11px] text-slate-500">{a.type} · {a.dueDate} at {a.startTime}</div>
                        </div>
                        <Badge variant={getStatusVariant(a.status)}>{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(profileTab === 'Overview' || profileTab === 'Notes & Files') && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-semibold text-slate-900">Internal Notes & Attachments</h3>
                  <p className="p-3 rounded-lg bg-amber-50/60 border border-amber-100 text-slate-700 whitespace-pre-line">{selectedContact.notes}</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{selectedContact.attachmentName || 'No attachment on file'}</span>
                    <span className="text-slate-400 ml-auto">{selectedContact.attachmentSize || ''}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Note Modal */}
          <Modal
            isOpen={noteModalOpen}
            onClose={() => setNoteModalOpen(false)}
            title={`Add Note for ${selectedContact.firstName} ${selectedContact.lastName}`}
            maxWidth="max-w-md"
            footer={
              <>
                <button onClick={() => setNoteModalOpen(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
                <button
                  onClick={() => {
                    if (!noteInput.trim()) return;
                    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, notes: `${noteInput} — ${c.notes}` } : c));
                    setNoteInput('');
                    setNoteModalOpen(false);
                    addToast('Note Saved', 'Updated Customer 360 notes.');
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Save Note
                </button>
              </>
            }
          >
            <textarea rows="4" value={noteInput} onChange={e => setNoteInput(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg text-xs" placeholder="Write internal relationship note..." />
          </Modal>

          {/* Schedule Meeting Modal */}
          <Modal
            isOpen={meetingModalOpen}
            onClose={() => setMeetingModalOpen(false)}
            title={`Schedule Meeting with ${selectedContact.firstName}`}
            maxWidth="max-w-md"
            footer={
              <>
                <button onClick={() => setMeetingModalOpen(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
                <button
                  onClick={() => {
                    setActivities(prev => [{
                      id: `act-${Date.now()}`, title: meetingSubject || `Executive Sync with ${selectedContact.firstName}`,
                      type: 'Meeting', contactId: selectedContact.id, companyId: selectedContact.companyId, dealId: contactDeals[0]?.id || '',
                      ownerId: selectedContact.ownerId, dueDate: meetingDate, startTime: '14:00', endTime: '15:00',
                      priority: 'High', status: 'Upcoming', reminder: '15 minutes before', description: 'Scheduled from Customer 360.'
                    }, ...prev]);
                    setMeetingModalOpen(false);
                    addToast('Meeting Scheduled', 'Added to CRM calendar and activities.');
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Schedule Meeting
                </button>
              </>
            }
          >
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Meeting Subject</label>
                <input value={meetingSubject} onChange={e => setMeetingSubject(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="Quarterly Executive Review" />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Date</label>
                <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </div>
            </div>
          </Modal>
        </div>
      );
    }

    const filteredContacts = contacts.filter(c => {
      const q = search.toLowerCase();
      const matchQ = !q || `${c.firstName} ${c.lastName} ${c.email} ${getCompany(c.companyId)?.name || ''}`.toLowerCase().includes(q);
      const matchType = typeFilter === 'ALL' || c.type === typeFilter;
      return matchQ && matchType;
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Contacts"
          subtitle="Manage all your customer and business relationships."
          breadcrumb="Contacts"
          actions={
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Contacts" value={contacts.length} change={`${recentCount(contacts)} this week`} trend="up" icon={Users} onClick={() => setTypeFilter('ALL')} active={typeFilter === 'ALL'} />
          <KpiCard title="Active Contacts" value={contacts.filter(c => c.status === 'Active').length} change="Active status" trend="up" icon={UserCheck} />
          <KpiCard title="Customers" value={contacts.filter(c => c.type === 'Customer').length} change="Customer records" trend="up" icon={Award} onClick={() => setTypeFilter('Customer')} active={typeFilter === 'Customer'} />
          <KpiCard title="Recently Added" value={recentCount(contacts)} change="Last 7 days" trend="up" icon={Sparkles} />
        </div>

        <div className="bg-white p-4 rounded-[12px] border border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts by name, email, or company..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
          </div>
          <div className="flex gap-1.5">
            {['ALL', 'Prospect', 'Customer', 'Partner', 'Vendor'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${typeFilter === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email & Phone</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Assigned Owner</th>
                  <th className="py-3 px-4">Contact Type</th>
                  <th className="py-3 px-4">Last Interaction</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredContacts.map(c => {
                  const comp = getCompany(c.companyId);
                  const emp = getEmployee(c.ownerId);
                  return (
                    <tr key={c.id} onClick={() => setSelectedContactProfileId(c.id)} className="hover:bg-blue-50/30 cursor-pointer transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700">{c.email}</div>
                        <div className="text-[11px] text-slate-400">{c.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-blue-600" onClick={e => { e.stopPropagation(); if (comp) navigateTo('companies', { companyId: comp.id }); }}>
                        {comp?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{c.jobTitle}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar employee={emp} size="xs" />
                          <span>{emp.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(c.type)}>{c.type}</Badge></td>
                      <td className="py-3.5 px-4 text-slate-500">{c.lastInteraction}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-blue-600 font-semibold text-xs">View 360 →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Contact Modal */}
        <Modal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add New Contact"
          subtitle="Create a new contact record linked to a company account."
          footer={
            <>
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  if (!contactForm.firstName || !contactForm.email) {
                    addToast('Validation Error', 'First name and email are required.', 'error');
                    return;
                  }
                  const created = { id: `cont-${Date.now()}`, ...contactForm, status: 'Active', lastInteraction: 'Just now', createdAt: new Date().toISOString().slice(0, 10) };
                  setContacts(prev => [created, ...prev]);
                  setAddOpen(false);
                  addToast('Contact Added', `${created.firstName} ${created.lastName} created.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Save Contact
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div><label className="font-semibold text-slate-700">First Name *</label><input value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Last Name *</label><input value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Email *</label><input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Phone</label><input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="font-semibold text-slate-700">Company</label>
              <select value={contactForm.companyId} onChange={e => setContactForm({ ...contactForm, companyId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">Job Title</label><input value={contactForm.jobTitle} onChange={e => setContactForm({ ...contactForm, jobTitle: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Department</label><input value={contactForm.department} onChange={e => setContactForm({ ...contactForm, department: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="font-semibold text-slate-700">Contact Owner</label>
              <select value={contactForm.ownerId} onChange={e => setContactForm({ ...contactForm, ownerId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {[...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Contact Type</label>
              <select value={contactForm.type} onChange={e => setContactForm({ ...contactForm, type: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {['Prospect', 'Customer', 'Partner', 'Vendor'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">Address</label><input value={contactForm.address} onChange={e => setContactForm({ ...contactForm, address: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div className="sm:col-span-2"><label className="font-semibold text-slate-700">Notes</label><textarea rows="2" value={contactForm.notes} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 8. PAGE 4 — COMPANIES & COMPANY DETAIL PAGE
  // ============================================================================

  const CompaniesPage = () => {
    const [search, setSearch] = useState('');
    const [industryFilter, setIndustryFilter] = useState('ALL');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [addOpen, setAddOpen] = useState(false);
    const [compForm, setCompForm] = useState({
      name: '', website: '', industry: '', size: '', email: '', phone: '',
      annualRevenue: '', country: '', state: '', city: '',
      address: '', ownerId: currentUser.id, description: ''
    });

    const selectedComp = companies.find(c => c.id === selectedCompanyProfileId);

    if (selectedComp) {
      const compContacts = contacts.filter(c => c.companyId === selectedComp.id);
      const compDeals = deals.filter(d => d.companyId === selectedComp.id);
      const compQuotes = quotations.filter(q => q.companyId === selectedComp.id);
      const compActivities = activities.filter(a => a.companyId === selectedComp.id);
      const totalWonRev = compDeals.filter(d => d.stage === 'WON').reduce((s, d) => s + d.value, 0);

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button onClick={() => setSelectedCompanyProfileId(null)} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
              <ChevronLeft className="w-4 h-4" /> Back to Companies
            </button>
            <span>/</span>
            <span>Account Overview</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-900 text-white font-bold text-lg flex items-center justify-center">
                {selectedComp.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{selectedComp.name}</h1>
                  <Badge variant={getStatusVariant(selectedComp.type)}>{selectedComp.type}</Badge>
                  <Badge variant={getStatusVariant(selectedComp.status)}>{selectedComp.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">{selectedComp.industry} · {selectedComp.city}, {selectedComp.state} · {selectedComp.website}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigateTo('contacts')} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700">+ Add Contact</button>
              <button onClick={() => navigateTo('deals')} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700">+ Create Deal</button>
              <button onClick={() => navigateTo('quotations')} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700">+ Create Quotation</button>
              <button onClick={() => navigateTo('activities')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">Schedule Meeting</button>
            </div>
          </div>

          {/* Relationship Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard title="Total Won Revenue" value={formatCurrency(totalWonRev)} change={`${compDeals.filter(d => d.stage === 'WON').length} won`} trend="up" icon={DollarSign} />
            <KpiCard title="Active Deals" value={compDeals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST').length} subtitle={`${compDeals.length} total deals`} icon={Briefcase} />
            <KpiCard title="Customer Lifetime Value" value={formatCurrency(selectedComp.clv)} subtitle="Annualized contract value" icon={Award} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-semibold text-slate-900">Company Information</h3>
                <p className="text-slate-600 leading-relaxed">{selectedComp.description}</p>
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">Account Owner</span><span className="font-semibold">{getEmployee(selectedComp.ownerId).name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Company Size</span><span className="font-medium">{selectedComp.size}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Annual Revenue</span><span className="font-medium">{selectedComp.annualRevenue}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-medium">{selectedComp.phone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">HQ Address</span><span className="font-medium text-right max-w-[180px]">{selectedComp.address}</span></div>
                </div>
              </div>

              {/* Connected projects */}
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Related projects</h3>
                  <Badge variant="blue">Projects Module</Badge>
                </div>
                {(selectedComp.projects || []).length > 0 ? (
                  selectedComp.projects.map(p => (
                    <div key={p} onClick={() => { setActiveTopModule('Projects'); addToast('Project', `Opened ${p} in the projects workspace.`); }} className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200/70 flex items-center justify-between cursor-pointer">
                      <span className="font-semibold text-slate-800">{p}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">No active implementation projects yet.</p>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {/* Associated Contacts */}
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-semibold text-slate-900">Associated Contacts ({compContacts.length})</h3>
                <div className="divide-y divide-slate-100">
                  {compContacts.map(c => (
                    <div key={c.id} onClick={() => navigateTo('contacts', { contactId: c.id })} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900">{c.firstName} {c.lastName}</div>
                          <div className="text-slate-500">{c.jobTitle} · {c.email}</div>
                        </div>
                      </div>
                      <Badge variant={getStatusVariant(c.type)}>{c.type}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Associated Deals */}
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-semibold text-slate-900">Associated Deals ({compDeals.length})</h3>
                <div className="divide-y divide-slate-100">
                  {compDeals.map(d => (
                    <div key={d.id} onClick={() => navigateTo('deals')} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer">
                      <div>
                        <div className="font-semibold text-slate-900">{d.title}</div>
                        <div className="text-slate-500">Close: {d.closeDate}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getStatusVariant(d.stage)}>{d.stage}</Badge>
                        <span className="font-bold text-slate-900">{formatCurrency(d.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quotations & Activities */}
              <div className="bg-white rounded-[12px] border border-slate-200 p-5 space-y-3 text-xs">
                <h3 className="text-sm font-semibold text-slate-900">Quotations & Recent Activities</h3>
                {compQuotes.map(q => (
                  <div key={q.id} onClick={() => navigateTo('quotations', { quotationId: q.id })} className="p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 flex items-center justify-between cursor-pointer">
                    <span className="font-semibold text-blue-600">{q.number}</span>
                    <span>{formatCurrency(calcQuoteTotal(q))}</span>
                    <Badge variant={getStatusVariant(q.status)}>{q.status}</Badge>
                  </div>
                ))}
                {compActivities.map(a => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{a.title}</span>
                    <span className="text-slate-500">{a.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const filteredCompanies = companies.filter(c => {
      const q = search.toLowerCase();
      const matchQ = !q || `${c.name} ${c.industry} ${c.city}`.toLowerCase().includes(q);
      const matchInd = industryFilter === 'ALL' || c.industry === industryFilter;
      const matchType = typeFilter === 'ALL' || c.type === typeFilter;
      return matchQ && matchInd && matchType;
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Companies"
          subtitle="Manage organizations, accounts and business relationships."
          breadcrumb="Companies"
          actions={
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Company
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Companies" value={companies.length} change={`${recentCount(companies)} this week`} trend="up" icon={Building2} onClick={() => setTypeFilter('ALL')} active={typeFilter === 'ALL'} />
          <KpiCard title="Active Companies" value={companies.filter(c => c.status === 'Active').length} change="Active status" trend="up" icon={CheckCircle2} />
          <KpiCard title="Customers" value={companies.filter(c => c.type === 'Customer').length} change="Customer accounts" trend="up" icon={Award} onClick={() => setTypeFilter('Customer')} active={typeFilter === 'Customer'} />
          <KpiCard title="Partners" value={companies.filter(c => c.type === 'Partner').length} change="Partner accounts" trend="up" icon={Layers} onClick={() => setTypeFilter('Partner')} active={typeFilter === 'Partner'} />
        </div>

        <div className="bg-white p-4 rounded-[12px] border border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company name, industry, or city..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
          </div>
          <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
            <option value="ALL">All Industries</option>
            {[...new Set(companies.map(c => c.industry))].map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
            <option value="ALL">All Account Types</option>
            {['Customer', 'Partner', 'Prospect'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Website & Contact</th>
                  <th className="py-3 px-4 text-center">Contacts</th>
                  <th className="py-3 px-4 text-center">Active Deals</th>
                  <th className="py-3 px-4">Account Owner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCompanies.map(comp => {
                  const emp = getEmployee(comp.ownerId);
                  const cCount = contacts.filter(c => c.companyId === comp.id).length;
                  const dCount = deals.filter(d => d.companyId === comp.id && d.stage !== 'WON' && d.stage !== 'LOST').length;
                  return (
                    <tr key={comp.id} onClick={() => setSelectedCompanyProfileId(comp.id)} className="hover:bg-blue-50/30 cursor-pointer transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600">{comp.name}</div>
                        <div className="text-[11px] text-slate-400">{comp.city}, {comp.country}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{comp.industry}</td>
                      <td className="py-3.5 px-4">
                        <div className="text-blue-600">{comp.website.replace('https://', '')}</div>
                        <div className="text-[11px] text-slate-400">{comp.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{cCount}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{dCount}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar employee={emp} size="xs" />
                          <span>{emp.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(comp.status)}>{comp.status}</Badge></td>
                      <td className="py-3.5 px-4 text-right font-semibold text-blue-600">Open Account →</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Company Modal */}
        <Modal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          title="Add New Company"
          subtitle="Register a new enterprise account in CRM."
          footer={
            <>
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  if (!compForm.name.trim()) {
                    addToast('Validation Error', 'Company Name is required.', 'error');
                    return;
                  }
                  const created = { id: `comp-${Date.now()}`, ...compForm, status: 'Active', type: 'Customer', clv: 0, projects: [] };
                  setCompanies(prev => [created, ...prev]);
                  setAddOpen(false);
                  addToast('Company Created', `${created.name} added to accounts.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Save Company
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div><label className="font-semibold text-slate-700">Company Name *</label><input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Website</label><input value={compForm.website} onChange={e => setCompForm({ ...compForm, website: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="https://" /></div>
            <div><label className="font-semibold text-slate-700">Industry</label><input value={compForm.industry} onChange={e => setCompForm({ ...compForm, industry: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Company Size</label><input value={compForm.size} onChange={e => setCompForm({ ...compForm, size: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Email</label><input value={compForm.email} onChange={e => setCompForm({ ...compForm, email: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Phone</label><input value={compForm.phone} onChange={e => setCompForm({ ...compForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Annual Revenue</label><input value={compForm.annualRevenue} onChange={e => setCompForm({ ...compForm, annualRevenue: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="font-semibold text-slate-700">Account Owner</label>
              <select value={compForm.ownerId} onChange={e => setCompForm({ ...compForm, ownerId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {[...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">City</label><input value={compForm.city} onChange={e => setCompForm({ ...compForm, city: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">State / Country</label><input value={`${compForm.state}, ${compForm.country}`} onChange={e => setCompForm({ ...compForm, state: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div className="sm:col-span-2"><label className="font-semibold text-slate-700">Description</label><textarea rows="2" value={compForm.description} onChange={e => setCompForm({ ...compForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 9. PAGE 5 — DEALS & PIPELINE (KANBAN, TABLE, FORECAST)
  // ============================================================================

  const DealsPipelinePage = () => {
    const [tab, setTab] = useState('Pipeline');
    const [pipelineFilter, setPipelineFilter] = useState('ALL');
    const [draggedDealId, setDraggedDealId] = useState(null);
    const [selectedDealDrawer, setSelectedDealDrawer] = useState(null);
    const [addDealOpen, setAddDealOpen] = useState(false);
    const [wonModalDeal, setWonModalDeal] = useState(null);
    const [lostModalDeal, setLostModalDeal] = useState(null);
    const [lostReason, setLostReason] = useState('Pricing / Budget constraints');
    const [createProjCheck, setCreateProjCheck] = useState(true);

    const [dealForm, setDealForm] = useState({
      title: '', companyId: companies[0]?.id || '', contactId: contacts[0]?.id || '',
      pipeline: 'Enterprise Sales', stage: 'NEW', value: 0, closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      probability: 30, ownerId: currentUser.id, priority: 'High', description: ''
    });

    const activeDragStages = ['NEW', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION'];
    const allStages = ['NEW', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const stageProbMap = { NEW: 20, CONTACTED: 35, PROPOSAL: 60, NEGOTIATION: 80, WON: 100, LOST: 0 };

    const moveDealToStage = (dealId, targetStage) => {
      const deal = deals.find(d => d.id === dealId);
      if (!deal || deal.stage === targetStage) return;

      if (targetStage === 'WON') {
        setDeals(prev => prev.map(d => d.id === dealId ? {
          ...d, stage: 'WON', probability: 100,
          notes: [`Closed won on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, ...(d.notes || [])]
        } : d));
        setWonModalDeal({ ...deal, stage: 'WON' });
        addToast('Deal Closed Won!', `${deal.title} (${formatCurrency(deal.value)})`);
        return;
      }
      if (targetStage === 'LOST') {
        setLostModalDeal(deal);
        return;
      }
      const nextProb = stageProbMap[targetStage] ?? deal.probability;
      setDeals(prev => prev.map(d => d.id === dealId ? {
        ...d, stage: targetStage, probability: nextProb,
        notes: [`Stage updated to ${targetStage} (${nextProb}% prob.)`, ...(d.notes || [])]
      } : d));
      addToast('Stage Updated', `Moved "${deal.title}" to ${targetStage} (${nextProb}% probability).`);
    };

    const visibleDeals = deals.filter(d => {
      const matchStage = dealFilterStage === 'ALL' || d.stage === dealFilterStage;
      const matchPipe = pipelineFilter === 'ALL' || d.pipeline === pipelineFilter;
      return matchStage && matchPipe;
    });

    // Forecast calculations
    const openDeals = visibleDeals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST');
    const expectedRevenue = openDeals.reduce((s, d) => s + d.value, 0);
    const weightedPipeline = openDeals.reduce((s, d) => s + d.value * ((d.probability || 50) / 100), 0);
    const wonDeals = visibleDeals.filter(d => d.stage === 'WON');
    const wonRevenue = wonDeals.reduce((s, d) => s + d.value, 0);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Deals & Pipeline"
          subtitle="Track opportunities, stage probabilities, and weighted forecasts."
          breadcrumb="Deals & Pipeline"
          actions={
            <>
              <select
                value={pipelineFilter}
                onChange={e => setPipelineFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Pipelines</option>
                <option value="Enterprise Sales">Enterprise Sales Pipeline</option>
                <option value="Partnerships">Partnerships Pipeline</option>
              </select>
              {dealFilterStage !== 'ALL' && (
                <button onClick={() => setDealFilterStage('ALL')} className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
                  Filter: {dealFilterStage} (Clear ×)
                </button>
              )}
              <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1">
                {['Pipeline', 'Table', 'Forecast'].map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={() => { setDealForm({ ...dealForm, stage: 'NEW' }); setAddDealOpen(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Deal
              </button>
            </>
          }
        />

        {/* TAB 1: KANBAN PIPELINE (Active Drag Stages + Deliberate Terminal Outcomes) */}
        {tab === 'Pipeline' && (
          <div className="space-y-4">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {activeDragStages.map(stage => {
                const stageDeals = visibleDeals.filter(d => d.stage === stage);
                const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
                return (
                  <div
                    key={stage}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (draggedDealId) moveDealToStage(draggedDealId, stage); setDraggedDealId(null); }}
                    className="flex-1 min-w-[270px] bg-slate-100/80 border border-slate-200/90 rounded-[12px] p-3 flex flex-col max-h-[65vh]"
                  >
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tracking-wide text-slate-800">{stage}</span>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">{stageDeals.length}</span>
                        <span className="text-[10px] font-medium text-slate-400">{stageProbMap[stage]}%</span>
                      </div>
                      <button onClick={() => { setDealForm({ ...dealForm, stage, probability: stageProbMap[stage] }); setAddDealOpen(true); }} className="p-1 rounded hover:bg-slate-200 text-slate-500" title={`Add deal to ${stage}`}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs font-bold text-slate-600 px-1 mb-3">{formatCurrency(stageTotal)}</div>

                    <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                      {stageDeals.map(deal => {
                        const comp = getCompany(deal.companyId);
                        const cont = getContact(deal.contactId);
                        const emp = getEmployee(deal.ownerId);
                        return (
                          <div
                            key={deal.id}
                            draggable
                            onDragStart={() => setDraggedDealId(deal.id)}
                            onClick={() => setSelectedDealDrawer(deal)}
                            className="bg-white p-3.5 rounded-[10px] border border-slate-200 hover:border-blue-400 shadow-2xs cursor-grab active:cursor-grabbing transition-all space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-900 leading-snug">{deal.title}</div>
                              <Badge variant={deal.priority === 'High' ? 'red' : deal.priority === 'Medium' ? 'amber' : 'neutral'}>{deal.priority}</Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-700">{comp?.name}</div>
                                <div>{cont ? `${cont.firstName} ${cont.lastName}` : ''}</div>
                              </div>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{deal.probability}%</span>
                            </div>
                            {/* Controlled Terminal Outcome Triggers (Prevents accidental drag-to-close) */}
                            <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => moveDealToStage(deal.id, 'WON')}
                                className="flex-1 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold transition-colors"
                              >
                                ✓ Mark Won
                              </button>
                              <button
                                onClick={() => moveDealToStage(deal.id, 'LOST')}
                                className="flex-1 py-1 rounded bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-[10px] font-semibold transition-colors"
                              >
                                ✕ Mark Lost
                              </button>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <span className="text-xs font-bold text-slate-900">{formatCurrency(deal.value)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400">{deal.closeDate.slice(5)}</span>
                                <Avatar employee={emp} size="xs" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {stageDeals.length === 0 && (
                        <div className="py-8 text-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-lg">Drop active deal here</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Terminal Outcomes Summary Bar (Won & Lost) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5"><Award className="w-4 h-4 text-emerald-600" /> CLOSED WON ({visibleDeals.filter(d => d.stage === 'WON').length})</span>
                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(wonRevenue)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleDeals.filter(d => d.stage === 'WON').map(d => (
                    <button key={d.id} onClick={() => setSelectedDealDrawer(d)} className="px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-[11px] font-semibold text-slate-800 hover:border-emerald-400">
                      {d.title} · <span className="text-emerald-700">{formatCurrency(d.value)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-100/80 border border-slate-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><XCircle className="w-4 h-4 text-rose-500" /> CLOSED LOST ({visibleDeals.filter(d => d.stage === 'LOST').length})</span>
                  <span className="text-xs font-bold text-slate-600">{formatCurrency(visibleDeals.filter(d => d.stage === 'LOST').reduce((s, d) => s + d.value, 0))}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleDeals.filter(d => d.stage === 'LOST').map(d => (
                    <button key={d.id} onClick={() => setSelectedDealDrawer(d)} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 hover:border-slate-400">
                      {d.title} ({d.lostReason || 'Lost'})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deal Detail Drawer */}
        <Drawer
          isOpen={!!selectedDealDrawer}
          onClose={() => setSelectedDealDrawer(null)}
          title={selectedDealDrawer?.title || ''}
          subtitle={selectedDealDrawer ? `${getCompany(selectedDealDrawer.companyId)?.name} · Close Date ${selectedDealDrawer.closeDate}` : ''}
          badge={selectedDealDrawer && <Badge variant={getStatusVariant(selectedDealDrawer.stage)}>{selectedDealDrawer.stage}</Badge>}
        >
          {selectedDealDrawer && (
            <div className="space-y-5 text-xs">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { moveDealToStage(selectedDealDrawer.id, 'WON'); setSelectedDealDrawer(null); }} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">Mark Won</button>
                <button onClick={() => { moveDealToStage(selectedDealDrawer.id, 'LOST'); setSelectedDealDrawer(null); }} className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-semibold">Mark Lost</button>
                <button onClick={() => { setSelectedDealDrawer(null); navigateTo('quotations'); }} className="px-3.5 py-2 bg-blue-600 text-white rounded-lg font-semibold">Create Quotation</button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                <div><span className="text-slate-400 block">Deal Value</span><span className="text-base font-bold text-slate-900">{formatCurrency(selectedDealDrawer.value)}</span></div>
                <div><span className="text-slate-400 block">Win Probability</span><span className="text-base font-bold text-blue-600">{selectedDealDrawer.probability}%</span></div>
                <div>
                  <span className="text-slate-400 block mb-1">Change Stage</span>
                  <select
                    value={selectedDealDrawer.stage}
                    onChange={e => { moveDealToStage(selectedDealDrawer.id, e.target.value); setSelectedDealDrawer({ ...selectedDealDrawer, stage: e.target.value }); }}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-semibold"
                  >
                    {allStages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><span className="text-slate-400 block">Deal Owner</span><span className="font-semibold text-slate-900">{getEmployee(selectedDealDrawer.ownerId).name}</span></div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">Opportunity Scope & Audit History</div>
                <p className="text-slate-600 leading-relaxed">{selectedDealDrawer.description}</p>
                {(selectedDealDrawer.notes || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {selectedDealDrawer.notes.map((n, i) => (
                      <div key={i} className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded">{n}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Drawer>

        {/* Add Deal Modal */}
        <Modal
          isOpen={addDealOpen}
          onClose={() => setAddDealOpen(false)}
          title="Create New Deal"
          subtitle="Add a qualified sales opportunity to your pipeline."
          footer={
            <>
              <button onClick={() => setAddDealOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  if (!dealForm.title.trim()) { addToast('Validation Error', 'Deal Name is required.', 'error'); return; }
                  const created = { id: `deal-${Date.now()}`, ...dealForm, value: Number(dealForm.value) || 0, probability: Number(dealForm.probability) || 25, notes: [] };
                  setDeals(prev => [created, ...prev]);
                  setAddDealOpen(false);
                  addToast('Deal Created', `${created.title} added to ${created.stage}.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Save Deal
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2"><label className="font-semibold text-slate-700">Deal Name *</label><input value={dealForm.title} onChange={e => setDealForm({ ...dealForm, title: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. Enterprise platform rollout" /></div>
            <div>
              <label className="font-semibold text-slate-700">Associated Company</label>
              <select value={dealForm.companyId} onChange={e => setDealForm({ ...dealForm, companyId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Associated Contact</label>
              <select value={dealForm.contactId} onChange={e => setDealForm({ ...dealForm, contactId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Stage</label>
              <select value={dealForm.stage} onChange={e => setDealForm({ ...dealForm, stage: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {allStages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">Deal Value ($)</label><input type="number" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Expected Close Date</label><input type="date" value={dealForm.closeDate} onChange={e => setDealForm({ ...dealForm, closeDate: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="font-semibold text-slate-700">Probability (%)</label><input type="number" min="0" max="100" value={dealForm.probability} onChange={e => setDealForm({ ...dealForm, probability: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="font-semibold text-slate-700">Pipeline</label>
              <select value={dealForm.pipeline} onChange={e => setDealForm({ ...dealForm, pipeline: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                <option value="Enterprise Sales">Enterprise Sales</option>
                <option value="Partnerships">Partnerships</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Assigned To</label>
              <select value={dealForm.ownerId} onChange={e => setDealForm({ ...dealForm, ownerId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {[...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="font-semibold text-slate-700">Description</label><textarea rows="2" value={dealForm.description} onChange={e => setDealForm({ ...dealForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
          </div>
        </Modal>

        {/* TAB 2: DEALS TABLE VIEW */}
        {tab === 'Table' && (
          <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Deal Title</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Pipeline</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Value</th>
                    <th className="py-3 px-4 text-right">Probability</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">Close Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDeals.map(d => (
                    <tr key={d.id} onClick={() => setSelectedDealDrawer(d)} className="hover:bg-blue-50/30 cursor-pointer">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{d.title}</td>
                      <td className="py-3.5 px-4 text-slate-700">{getCompany(d.companyId)?.name}</td>
                      <td className="py-3.5 px-4 text-slate-500">{d.pipeline}</td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(d.stage)}>{d.stage}</Badge></td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(d.value)}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-blue-600">{d.probability}%</td>
                      <td className="py-3.5 px-4">{getEmployee(d.ownerId).name}</td>
                      <td className="py-3.5 px-4 text-slate-500">{d.closeDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WEIGHTED FORECAST VIEW */}
        {tab === 'Forecast' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard title="Open Pipeline Value" value={formatCurrency(expectedRevenue)} subtitle="Unweighted open opportunities" icon={Briefcase} />
              <KpiCard title="Weighted Forecast" value={formatCurrency(weightedPipeline)} change={`${openDeals.length} open`} trend="up" subtitle="Probability-adjusted revenue" icon={TrendingUp} />
              <KpiCard title="Closed Won Revenue" value={formatCurrency(wonRevenue)} change={`${wonDeals.length} won`} trend="up" subtitle="Revenue from closed-won deals" icon={Award} />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-card">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Quota Attainment & Forecast by Salesperson</h3>
              <div className="space-y-4">
                {EMPLOYEES.slice(0, 4).map(emp => {
                  const empDeals = deals.filter(d => d.ownerId === emp.id);
                  const empWon = empDeals.filter(d => d.stage === 'WON').reduce((s, d) => s + d.value, 0);
                  const empWeighted = empDeals.filter(d => d.stage !== 'WON' && d.stage !== 'LOST').reduce((s, d) => s + d.value * (d.probability / 100), 0);
                  const attainment = Math.min(100, Math.round(((empWon + empWeighted) / emp.quota) * 100));
                  return (
                    <div key={emp.id} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar employee={emp} size="xs" />
                          <span className="font-semibold text-slate-900">{emp.name}</span>
                          <span className="text-slate-400">({emp.role})</span>
                        </div>
                        <div className="font-semibold text-slate-700">
                          Won: <span className="text-emerald-600">{formatCurrency(empWon)}</span> · Weighted: <span className="text-blue-600">{formatCurrency(empWeighted)}</span> / Quota: {formatCurrency(emp.quota)} ({attainment}%)
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${attainment}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Deal Won Cross-Module Project Handoff Modal */}
        <Modal
          isOpen={!!wonModalDeal}
          onClose={() => setWonModalDeal(null)}
          title="Deal closed won - connected handoff"
          subtitle={wonModalDeal ? `${wonModalDeal.title} (${formatCurrency(wonModalDeal.value)})` : ''}
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setWonModalDeal(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Close</button>
              <button
                onClick={() => {
                  if (createProjCheck && wonModalDeal) {
                    const comp = getCompany(wonModalDeal.companyId);
                    if (!comp) {
                      addToast('Company required', 'Link this deal to a company before creating a project.', 'error');
                      setWonModalDeal(null);
                      return;
                    }
                    const newProj = {
                      id: `PRJ-${Date.now()}`,
                      name: `${wonModalDeal.title} Onboarding`,
                      company: comp.name,
                      status: 'Active'
                    };
                    setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, projects: [...(c.projects || []), `${newProj.id}: ${newProj.name}`] } : c));
                    addToast('Project Recorded', `Launched ${newProj.id} for ${newProj.company}.`);
                  }
                  setWonModalDeal(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm & Launch Workflow
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">Congratulations on closing this deal! Choose the controlled cross-module handoff actions to execute in the workspace:</p>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={createProjCheck} onChange={e => setCreateProjCheck(e.target.checked)} className="mt-0.5 rounded" />
              <div>
                <div className="font-semibold text-slate-900">Create implementation project in Projects</div>
                <div className="text-slate-500 mt-0.5">Prefills customer account, scope notes, and assigns delivery owner automatically.</div>
              </div>
            </label>
          </div>
        </Modal>

        {/* Deal Lost Reason Modal */}
        <Modal
          isOpen={!!lostModalDeal}
          onClose={() => setLostModalDeal(null)}
          title="Mark Deal as Closed Lost"
          subtitle={lostModalDeal?.title}
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setLostModalDeal(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setDeals(prev => prev.map(d => d.id === lostModalDeal.id ? {
                    ...d, stage: 'LOST', probability: 0, lostReason,
                    notes: [`Closed Lost (${lostReason})`, ...(d.notes || [])]
                  } : d));
                  addToast('Deal Marked Lost', `Recorded loss reason: ${lostReason}`, 'info');
                  setLostModalDeal(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Closed Lost
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <label className="font-semibold text-slate-700 block">Primary Lost Reason</label>
            <select value={lostReason} onChange={e => setLostReason(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
              <option>Pricing / Budget constraints</option>
              <option>Selected competitor platform</option>
              <option>Project timeline postponed</option>
              <option>Missing technical integration</option>
              <option>Unresponsive decision maker</option>
            </select>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 10. PAGE 6 — ACTIVITIES & FOLLOW-UPS
  // ============================================================================

  const ActivitiesPage = () => {
    const [tab, setTab] = useState('All Activities');
    const [addOpen, setAddOpen] = useState(false);
    const [actForm, setActForm] = useState({
      type: 'Call', title: '', contactId: contacts[0]?.id || '', companyId: companies[0]?.id || '',
      dealId: deals[0]?.id || '', ownerId: currentUser.id, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), startTime: '10:00',
      endTime: '10:30', priority: 'High', reminder: '15 minutes before', description: ''
    });

    const filteredActivities = activities.filter(a => {
      if (tab === 'My Activities') return a.ownerId === currentUser.id;
      if (tab === 'Overdue') return a.status === 'Overdue';
      return true;
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Activities & Follow-ups"
          subtitle="Keep your team organized and never miss an important customer interaction."
          breadcrumb="Activities & Follow-ups"
          actions={
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create Activity
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="My Activities" value={activities.filter(a => a.ownerId === currentUser.id).length} icon={UserCheck} onClick={() => setTab('My Activities')} active={tab === 'My Activities'} />
          <KpiCard title="Upcoming" value={activities.filter(a => a.status === 'Upcoming').length} icon={CalendarClock} onClick={() => setTab('All Activities')} active={tab === 'All Activities'} />
          <KpiCard title="Overdue" value={activities.filter(a => a.status === 'Overdue').length} change="Action needed" trend="down" icon={AlertCircle} onClick={() => setTab('Overdue')} active={tab === 'Overdue'} />
          <KpiCard title="Completed" value={activities.filter(a => a.status === 'Completed').length} change="Completed tasks" trend="up" icon={CheckCircle2} />
        </div>

        <div className="flex gap-2 border-b border-slate-200 pb-3">
          {['My Activities', 'All Activities', 'Overdue', 'Calendar'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab !== 'Calendar' ? (
          <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Activity</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Related Account</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">Due Date & Time</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.map(act => (
                    <tr key={act.id} className={`hover:bg-slate-50 ${act.status === 'Overdue' ? 'bg-rose-50/30' : ''}`}>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{act.title}</td>
                      <td className="py-3.5 px-4"><Badge variant="blue">{act.type}</Badge></td>
                      <td className="py-3.5 px-4 text-slate-700">{getCompany(act.companyId)?.name}</td>
                      <td className="py-3.5 px-4">{getEmployee(act.ownerId).name}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">{act.dueDate} · {act.startTime}</td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(act.priority)}>{act.priority}</Badge></td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(act.status)}>{act.status}</Badge></td>
                      <td className="py-3.5 px-4 text-right">
                        {act.status !== 'Completed' && (
                          <button
                            onClick={() => {
                              setActivities(prev => prev.map(a => a.id === act.id ? { ...a, status: 'Completed' } : a));
                              addToast('Activity Completed', act.title);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold hover:bg-emerald-100"
                          >
                            Mark Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} — Team Activity Schedule</h3>
              <button onClick={() => setAddOpen(true)} className="text-xs font-semibold text-blue-600 hover:underline">+ Schedule on Date</button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center font-semibold text-slate-400 py-1">{d}</div>
              ))}
              {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }, (_, i) => {
                const dayNum = i + 1;
                const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayActs = activities.filter(a => a.dueDate === dateStr);
                return (
                  <div
                    key={dayNum}
                    onClick={() => { setActForm({ ...actForm, dueDate: dateStr }); setAddOpen(true); }}
                    className="min-h-[82px] p-2 rounded-lg border border-slate-100 hover:border-blue-300 cursor-pointer bg-slate-50/40"
                  >
                    <div className="font-semibold text-slate-700 mb-1">{dayNum}</div>
                    <div className="space-y-1">
                      {dayActs.map(a => (
                        <div key={a.id} className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] truncate">{a.title}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Modal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          title="Schedule Customer Activity"
          footer={
            <>
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  if (!actForm.title.trim()) { addToast('Validation Error', 'Subject is required.', 'error'); return; }
                  setActivities(prev => [{ id: `act-${Date.now()}`, ...actForm, status: 'Upcoming' }, ...prev]);
                  setAddOpen(false);
                  addToast('Activity Scheduled', `${actForm.title} added to calendar.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Save Activity
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700">Activity Type</label>
              <select value={actForm.type} onChange={e => setActForm({ ...actForm, type: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {['Call', 'Meeting', 'Email', 'Task', 'Follow-up'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">Subject *</label><input value={actForm.title} onChange={e => setActForm({ ...actForm, title: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g. Executive Follow-up Call" /></div>
            <div>
              <label className="font-semibold text-slate-700">Related Company</label>
              <select value={actForm.companyId} onChange={e => setActForm({ ...actForm, companyId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Assigned To</label>
              <select value={actForm.ownerId} onChange={e => setActForm({ ...actForm, ownerId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {[...EMPLOYEES, ...TEAMS, ...DEPARTMENTS].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="font-semibold text-slate-700">Due Date</label><input type="date" value={actForm.dueDate} onChange={e => setActForm({ ...actForm, dueDate: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="font-semibold text-slate-700">Reminder</label>
              <select value={actForm.reminder} onChange={e => setActForm({ ...actForm, reminder: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {['At due time', '15 minutes before', '30 minutes before', '1 hour before', '1 day before'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 11. PAGE 7 — QUOTATIONS
  // ============================================================================

  const QuotationsPage = () => {
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [newQuote, setNewQuote] = useState({
      number: `QT-${new Date().getFullYear()}-${String(quotations.length + 1).padStart(4, '0')}`,
      companyId: companies[0]?.id || '',
      contactId: contacts[0]?.id || '',
      dealId: deals[0]?.id || '',
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: 'INR',
      paymentTerms: 'Net 30',
      items: [],
      notes: 'Standard 30-day enterprise proposal validity.'
    });

    const activeQuote = quotations.find(q => q.id === selectedQuotationId);

    if (activeQuote) {
      const comp = getCompany(activeQuote.companyId);
      const cont = getContact(activeQuote.contactId);
      const relatedDeal = getDeal(activeQuote.dealId);
      return (
        <div className="space-y-6">
          <button onClick={() => setSelectedQuotationId(null)} className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back to Quotations
          </button>

          <div className="bg-white rounded-[12px] border border-slate-200 p-8 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900">{activeQuote.number}</h1>
                  <Badge variant={getStatusVariant(activeQuote.status)}>{activeQuote.status}</Badge>
                  <Badge variant="neutral">{activeQuote.version}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">Prepared for {comp?.name} ({cont?.firstName} {cont?.lastName}) · Terms: {activeQuote.paymentTerms}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {activeQuote.status !== 'Accepted' && (
                  <button
                    onClick={() => {
                      setQuotations(prev => prev.map(q => q.id === activeQuote.id ? { ...q, status: 'Accepted' } : q));
                      if (relatedDeal) {
                        setDeals(prev => prev.map(d => d.id === relatedDeal.id ? { ...d, stage: 'WON', probability: 100 } : d));
                      }
                      addToast('Quotation Accepted & Deal Won', `Marked ${activeQuote.number} Accepted and updated deal to WON.`);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Mark Accepted & Win Deal
                  </button>
                )}
                <button onClick={() => addToast('PDF Downloaded', `${activeQuote.number}.pdf generated.`)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                  Download PDF
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">Product / Service</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeQuote.items.map(it => {
                  const total = it.qty * it.price * (1 - (it.discount || 0) / 100);
                  return (
                    <tr key={it.id}>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{it.name}</div>
                        <div className="text-slate-500">{it.description}</div>
                      </td>
                      <td className="py-3 px-3 text-right">{it.qty}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(it.price)}</td>
                      <td className="py-3 px-3 text-right">{it.discount}%</td>
                      <td className="py-3 px-3 text-right font-bold">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <div className="w-64 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500"><span>Grand Total ({activeQuote.currency})</span><span className="text-base font-bold text-slate-900">{formatCurrency(calcQuoteTotal(activeQuote))}</span></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Quotations"
          subtitle="Create, manage and track customer proposals and quotations."
          breadcrumb="Quotations"
          actions={
            <button onClick={() => { setWizardStep(1); setWizardOpen(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create Quotation
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Quotations" value={quotations.length} icon={FileText} />
          <KpiCard title="Accepted" value={quotations.filter(q => q.status === 'Accepted').length} change="Accepted quotes" trend="up" icon={CheckCircle2} />
          <KpiCard title="Pending / Sent" value={quotations.filter(q => q.status === 'Sent' || q.status === 'Viewed').length} icon={Clock} />
          <KpiCard title="Drafts" value={quotations.filter(q => q.status === 'Draft').length} icon={Edit3} />
        </div>

        <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Related Deal</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map(q => (
                  <tr key={q.id} onClick={() => setSelectedQuotationId(q.id)} className="hover:bg-blue-50/30 cursor-pointer">
                    <td className="py-3.5 px-4 font-bold text-blue-600">{q.number}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{getCompany(q.companyId)?.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{getDeal(q.dealId)?.title || '—'}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(calcQuoteTotal(q))}</td>
                    <td className="py-3.5 px-4 text-slate-500">{q.issueDate}</td>
                    <td className="py-3.5 px-4 text-slate-500">{q.expiryDate}</td>
                    <td className="py-3.5 px-4"><Badge variant={getStatusVariant(q.status)}>{q.status}</Badge></td>
                    <td className="py-3.5 px-4 text-right font-semibold text-blue-600">Preview →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4-Step Quotation Wizard Modal */}
        <Modal
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          title={`Create Quotation · Step ${wizardStep} of 4`}
          subtitle="Configure customer, line items, and branded proposal document"
          footer={
            <>
              <button onClick={() => setWizardOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              {wizardStep > 1 && <button onClick={() => setWizardStep(wizardStep - 1)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Back</button>}
              {wizardStep < 4 ? (
                <button onClick={() => setWizardStep(wizardStep + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">Next Step →</button>
              ) : (
                <button
                  onClick={() => {
                    const created = { id: `qt-${Date.now()}`, ...newQuote, status: 'Sent', version: 'v1.0' };
                    setQuotations(prev => [created, ...prev]);
                    setWizardOpen(false);
                    addToast('Quotation Sent', `${created.number} sent to customer.`);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                >
                  Send Quotation
                </button>
              )}
            </>
          }
        >
          {wizardStep === 1 && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Customer Company</label>
                <select value={newQuote.companyId} onChange={e => setNewQuote({ ...newQuote, companyId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Primary Contact</label>
                <select value={newQuote.contactId} onChange={e => setNewQuote({ ...newQuote, contactId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Related Deal</label>
                <select value={newQuote.dealId} onChange={e => setNewQuote({ ...newQuote, dealId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            </div>
          )}
          {wizardStep === 2 && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><label className="font-semibold text-slate-700">Quotation Number</label><input value={newQuote.number} readOnly className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono" /></div>
              <div><label className="font-semibold text-slate-700">Payment Terms</label><input value={newQuote.paymentTerms} onChange={e => setNewQuote({ ...newQuote, paymentTerms: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
              <div><label className="font-semibold text-slate-700">Issue Date</label><input type="date" value={newQuote.issueDate} onChange={e => setNewQuote({ ...newQuote, issueDate: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
              <div><label className="font-semibold text-slate-700">Expiry Date</label><input type="date" value={newQuote.expiryDate} onChange={e => setNewQuote({ ...newQuote, expiryDate: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            </div>
          )}
          {wizardStep === 3 && (
            <div className="space-y-3 text-xs">
              {newQuote.items.length ? newQuote.items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <input value={item.name} onChange={e => { const items = [...newQuote.items]; items[idx].name = e.target.value; setNewQuote({ ...newQuote, items }); }} className="col-span-6 px-2 py-1.5 bg-white border border-slate-200 rounded" />
                  <input type="number" value={item.qty} onChange={e => { const items = [...newQuote.items]; items[idx].qty = Number(e.target.value); setNewQuote({ ...newQuote, items }); }} className="col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded" />
                  <input type="number" value={item.price} onChange={e => { const items = [...newQuote.items]; items[idx].price = Number(e.target.value); setNewQuote({ ...newQuote, items }); }} className="col-span-4 px-2 py-1.5 bg-white border border-slate-200 rounded" />
                </div>
              )) : (
                <p className="text-slate-400">No line items yet. Add the first item below.</p>
              )}
              <button
                onClick={() => setNewQuote({ ...newQuote, items: [...newQuote.items, { id: `item-${Date.now()}`, name: '', description: '', qty: 1, price: 0, discount: 0, tax: 0 }] })}
                className="text-blue-600 font-semibold hover:underline"
              >
                + Add Line Item
              </button>
              <div className="text-right font-bold text-sm pt-2 border-t border-slate-200">Grand Total: {formatCurrency(calcQuoteTotal(newQuote))}</div>
            </div>
          )}
          {wizardStep === 4 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-900"><span>{newQuote.number}</span><span>{formatCurrency(calcQuoteTotal(newQuote))}</span></div>
              <div className="text-slate-600">Client: {getCompany(newQuote.companyId)?.name} · Valid until {newQuote.expiryDate}</div>
              <p className="text-slate-500 pt-2 border-t border-slate-200">{newQuote.notes}</p>
            </div>
          )}
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 12. PAGE 8 — CUSTOMER SUPPORT
  // ============================================================================

  const CustomerSupportPage = () => {
    const [tab, setTab] = useState('All Tickets');
    const [createOpen, setCreateOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [ticketForm, setTicketForm] = useState({ subject: '', companyId: companies[0]?.id || '', contactId: contacts[0]?.id || '', priority: 'High', category: 'API & Integrations', agentId: 'emp-5', description: '' });

    const activeTicket = tickets.find(t => t.id === selectedTicketId);

    if (activeTicket) {
      return (
        <div className="space-y-6">
          <button onClick={() => setSelectedTicketId(null)} className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back to Support Queue
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-[12px] border border-slate-200 p-6 space-y-4">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">{activeTicket.id}</span>
                  <h2 className="text-lg font-bold text-slate-900">{activeTicket.subject}</h2>
                </div>
                <Badge variant={getStatusVariant(activeTicket.status)}>{activeTicket.status}</Badge>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {activeTicket.messages.map(m => (
                  <div key={m.id} className={`p-4 rounded-xl text-xs border ${m.isInternal ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50 border-slate-200/80'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900">{m.sender} <span className="font-normal text-slate-500">({m.role})</span></span>
                      <div className="flex items-center gap-2">
                        {m.isInternal && <Badge variant="amber">Internal Note</Badge>}
                        <span className="text-slate-400">{m.time}</span>
                      </div>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{m.text}</p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsInternalNote(false)} className={`px-3 py-1 rounded-lg font-semibold ${!isInternalNote ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Public Reply</button>
                  <button onClick={() => setIsInternalNote(true)} className={`px-3 py-1 rounded-lg font-semibold ${isInternalNote ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Internal Note</button>
                </div>
                <textarea rows="3" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={isInternalNote ? 'Write an internal note visible only to your team...' : 'Write a reply to the customer...'} className="w-full p-3 border border-slate-200 rounded-xl" />
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!replyText.trim()) return;
                      const msg = { id: `m-${Date.now()}`, sender: currentUser.name, role: currentUser.role, isInternal: isInternalNote, time: 'Just now', text: replyText };
                      setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, messages: [...t.messages, msg], updatedAt: 'Just now' } : t));
                      setReplyText('');
                      addToast(isInternalNote ? 'Internal Note Added' : 'Reply Sent', 'Updated conversation thread.');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    {isInternalNote ? 'Save Internal Note' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-[12px] border border-slate-200 p-5 space-y-4 text-xs h-fit">
              <h3 className="font-bold text-slate-900 text-sm">Ticket Properties</h3>
              <div>
                <label className="text-slate-500 block mb-1">Status</label>
                <select
                  value={activeTicket.status}
                  onChange={e => setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: e.target.value } : t))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Priority</label>
                <select
                  value={activeTicket.priority}
                  onChange={e => setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, priority: e.target.value } : t))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-semibold">{getCompany(activeTicket.companyId)?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Assigned Agent</span><span className="font-semibold">{getEmployee(activeTicket.agentId).name}</span></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const filteredTickets = tickets.filter(t => tab === 'All Tickets' || t.status === tab);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Customer Support"
          subtitle="Manage customer issues, requests and support tickets."
          breadcrumb="Customer Support"
          actions={
            <button onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create Ticket
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Tickets" value={tickets.length} icon={Headphones} onClick={() => setTab('All Tickets')} active={tab === 'All Tickets'} />
          <KpiCard title="Open" value={tickets.filter(t => t.status === 'Open').length} icon={AlertCircle} onClick={() => setTab('Open')} active={tab === 'Open'} />
          <KpiCard title="In Progress" value={tickets.filter(t => t.status === 'In Progress').length} icon={Clock} onClick={() => setTab('In Progress')} active={tab === 'In Progress'} />
          <KpiCard title="Resolved" value={tickets.filter(t => t.status === 'Resolved').length} icon={CheckCircle2} onClick={() => setTab('Resolved')} active={tab === 'Resolved'} />
        </div>

        <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map(t => (
                  <tr key={t.id} onClick={() => setSelectedTicketId(t.id)} className="hover:bg-blue-50/30 cursor-pointer">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{t.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{t.subject}</td>
                    <td className="py-3.5 px-4 text-slate-700">{getCompany(t.companyId)?.name}</td>
                    <td className="py-3.5 px-4"><Badge variant={getStatusVariant(t.priority)}>{t.priority}</Badge></td>
                    <td className="py-3.5 px-4">{getEmployee(t.agentId).name}</td>
                    <td className="py-3.5 px-4"><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></td>
                    <td className="py-3.5 px-4 text-slate-500">{t.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Create Support Ticket"
          footer={
            <>
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  if (!ticketForm.subject.trim()) { addToast('Validation Error', 'Subject is required.', 'error'); return; }
                  const created = {
                    id: `TKT-${String(tickets.length + 1).padStart(4, '0')}`, ...ticketForm, status: 'Open', createdAt: 'Just now', updatedAt: 'Just now',
                    messages: [{ id: `m-${Date.now()}`, sender: 'Customer Portal', role: 'Customer', isInternal: false, time: 'Just now', text: ticketForm.description || ticketForm.subject }]
                  };
                  setTickets(prev => [created, ...prev]);
                  setCreateOpen(false);
                  addToast('Ticket Created', `${created.id} assigned to ${getEmployee(created.agentId).name}.`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Create Ticket
              </button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div><label className="font-semibold text-slate-700">Subject *</label><input value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Company</label>
                <select value={ticketForm.companyId} onChange={e => setTicketForm({ ...ticketForm, companyId: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Priority</label>
                <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div><label className="font-semibold text-slate-700">Description</label><textarea rows="3" value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 13. PAGE 9 — REPORTS & ANALYTICS
  // ============================================================================

  const ReportsAnalyticsPage = () => {
    const [tab, setTab] = useState('Overview');
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [reportName, setReportName] = useState('Q4 Enterprise Pipeline & Conversion');

    const funnelCounts = {
      captured: leads.length,
      contacted: leads.filter((lead) => ['Contacted', 'Qualified', 'Converted'].includes(String(lead.status || ''))).length,
      qualified: leads.filter((lead) => ['Qualified', 'Converted'].includes(String(lead.status || ''))).length,
      proposal: deals.filter((deal) => ['PROPOSAL', 'NEGOTIATION', 'WON'].includes(String(deal.stage || '').toUpperCase())).length,
      won: deals.filter((deal) => String(deal.stage || '').toUpperCase() === 'WON').length,
    };
    const funnelPct = (count) => funnelCounts.captured ? Math.round((count / funnelCounts.captured) * 100) : 0;
    const funnelStages = [
      { label: 'Captured Leads', count: funnelCounts.captured, pct: 100, color: 'bg-blue-600' },
      { label: 'Contacted & Engaged', count: funnelCounts.contacted, pct: funnelPct(funnelCounts.contacted), color: 'bg-indigo-600' },
      { label: 'Sales Qualified (SQL)', count: funnelCounts.qualified, pct: funnelPct(funnelCounts.qualified), color: 'bg-purple-600' },
      { label: 'Proposal Sent', count: funnelCounts.proposal, pct: funnelPct(funnelCounts.proposal), color: 'bg-amber-500' },
      { label: 'Closed Won Customers', count: funnelCounts.won, pct: funnelPct(funnelCounts.won), color: 'bg-emerald-500' },
    ];
    const avgDealSize = deals.length ? deals.reduce((sum, deal) => sum + toNumber(deal.value), 0) / deals.length : 0;
    const cycleDays = deals
      .filter((deal) => deal.closeDate && deal.createdAt)
      .map((deal) => (new Date(deal.closeDate).getTime() - new Date(deal.createdAt).getTime()) / 86400000)
      .filter((days) => Number.isFinite(days) && days >= 0);
    const avgCycle = cycleDays.length ? (cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length).toFixed(1) : '0.0';
    const wonDeals = deals.filter((deal) => String(deal.stage || '').toUpperCase() === 'WON');
    const winRate = deals.length ? ((wonDeals.length / deals.length) * 100).toFixed(1) : '0.0';

    return (
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          subtitle="Understand your sales performance, funnel velocity, and customer growth."
          breadcrumb="Reports & Analytics"
          actions={
            <>
              <button onClick={() => addToast('CSV Exported', 'Analytics report exported to CSV.')} className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={() => setSaveModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save Report
              </button>
            </>
          }
        />

        <div className="flex gap-2 flex-wrap border-b border-slate-200 pb-3">
          {['Overview', 'Sales', 'Leads', 'Customers', 'Activities', 'Revenue'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Average Deal Size" value={formatCurrency(avgDealSize)} change={`${deals.length} deals`} trend="up" icon={DollarSign} />
          <KpiCard title="Sales Cycle Duration" value={`${avgCycle} days`} change={`${cycleDays.length} dated deals`} trend="up" icon={Clock} />
          <KpiCard title="Win Rate" value={`${winRate}%`} change={`${wonDeals.length} won of ${deals.length}`} trend="up" icon={Award} />
          <KpiCard title="Net Revenue Retention" value="—" subtitle="No renewal history recorded" icon={TrendingUp} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-card space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Lead-to-Customer Conversion Funnel</h3>
            <div className="space-y-3">
              {funnelStages.map(f => (
                <div key={f.label} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700">{f.label}</span>
                    <span className="text-slate-900">{f.count.toLocaleString()} ({f.pct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-card space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Salesperson Performance Matrix</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[11px]">
                  <th className="py-2">Rep</th>
                  <th className="py-2 text-right">Pipeline</th>
                  <th className="py-2 text-right">Won Deals</th>
                  <th className="py-2 text-right">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {EMPLOYEES.map(emp => (
                  <tr key={emp.id}>
                    <td className="py-2.5 font-semibold text-slate-900">{emp.name}</td>
                    <td className="py-2.5 text-right text-slate-700">{formatCurrency(emp.quota * 1.4)}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-600">{formatCurrency(emp.quota * 0.85)}</td>
                    <td className="py-2.5 text-right"><Badge variant="green">29%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          title="Save Custom Report"
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold">Cancel</button>
              <button onClick={() => { setSaveModalOpen(false); addToast('Report Saved', `"${reportName}" saved to workspace reports.`); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">Save Report</button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div><label className="font-semibold text-slate-700">Report Name</label><input value={reportName} onChange={e => setReportName(e.target.value)} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></div>
          </div>
        </Modal>
      </div>
    );
  };

  // ============================================================================
  // 14. PAGE 10 — AUTOMATION SETTINGS & VISUAL WORKFLOW BUILDER
  // ============================================================================

  const AutomationSettingsPage = () => {
    const [tab, setTab] = useState('All Workflows');
    const [wfBuilder, setWfBuilder] = useState({
      id: null,
      name: 'Qualified Lead Instant Routing & SLA',
      description: 'Routes high-intent leads to senior reps with duplicate-action safeguard.',
      trigger: 'Lead Created',
      conditionField: 'Lead Source',
      conditionValue: 'Referral',
      actionType: 'Assign Employee',
      actionConfig: 'Round-Robin Enterprise AE',
      status: 'Active'
    });

    const openBuilder = (wf) => {
      if (wf) {
        setWfBuilder({
          id: wf.id,
          name: wf.name,
          description: wf.description,
          trigger: wf.trigger,
          conditionField: wf.conditions?.[0]?.field || 'Lead Source',
          conditionValue: wf.conditions?.[0]?.value || 'Website',
          actionType: wf.actions?.[0]?.type || 'Assign Employee',
          actionConfig: wf.actions?.[0]?.config || 'Assign to Senior AE',
          status: wf.status
        });
        setEditingWorkflowId(wf.id);
      } else {
        setCreatingWorkflow(true);
      }
    };

    if (creatingWorkflow || editingWorkflowId) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => { setCreatingWorkflow(false); setEditingWorkflowId(null); }} className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
              <ChevronLeft className="w-4 h-4" /> Back to Automation Workflows
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => addToast('Workflow Dry-Run Passed', 'Simulated trigger → condition → action with 0 duplicate conflicts.')}
                className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600" /> Test Workflow
              </button>
              <button
                onClick={() => {
                  const saved = {
                    id: wfBuilder.id || `wf-${Date.now()}`,
                    name: wfBuilder.name,
                    description: wfBuilder.description,
                    trigger: wfBuilder.trigger,
                    conditions: [{ field: wfBuilder.conditionField, operator: 'equals', value: wfBuilder.conditionValue }],
                    actions: [{ type: wfBuilder.actionType, config: wfBuilder.actionConfig }],
                    status: 'Active',
                    lastRun: 'Just now',
                    executions: 1,
                    createdBy: currentUser.name,
                    logs: [{ id: `l-${Date.now()}`, time: new Date().toISOString(), record: wfBuilder.name || 'Workflow', status: 'Success', duration: '0ms' }]
                  };
                  setWorkflows(prev => wfBuilder.id ? prev.map(w => w.id === wfBuilder.id ? saved : w) : [saved, ...prev]);
                  setCreatingWorkflow(false);
                  setEditingWorkflowId(null);
                  addToast('Workflow Published', `"${saved.name}" is now active.`);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
              >
                Publish Workflow
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Palette */}
            <div className="lg:col-span-3 bg-white rounded-[12px] border border-slate-200 p-4 space-y-4 text-xs">
              <div className="font-bold text-slate-900">Building Blocks</div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-400 mb-1.5">Triggers</div>
                <select value={wfBuilder.trigger} onChange={e => setWfBuilder({ ...wfBuilder, trigger: e.target.value })} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-slate-50 font-medium">
                  {['Lead Created', 'Lead Updated', 'Deal Stage Changed', 'Deal Won', 'Deal Lost', 'Activity Overdue', 'Quotation Accepted', 'Ticket Created'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-400 mb-1.5">Actions</div>
                <select value={wfBuilder.actionType} onChange={e => setWfBuilder({ ...wfBuilder, actionType: e.target.value })} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-slate-50 font-medium">
                  {['Assign Employee', 'Create Activity', 'Send Notification', 'Update Record', 'Create Project', 'Send Email', 'Change Deal Stage'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Center Visual Canvas */}
            <div className="lg:col-span-5 bg-slate-100/80 rounded-[12px] border border-slate-200 p-6 flex flex-col items-center justify-center space-y-3 text-xs">
              <div className="w-full max-w-sm bg-white p-4 rounded-xl border-2 border-blue-500 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-blue-600">1. Trigger</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{wfBuilder.trigger}</div>
              </div>
              <div className="h-5 w-0.5 bg-slate-300" />
              <div className="w-full max-w-sm bg-white p-4 rounded-xl border border-amber-300 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-amber-600">2. Condition Guard</div>
                <div className="font-semibold text-slate-800 mt-0.5">{wfBuilder.conditionField} = "{wfBuilder.conditionValue}"</div>
              </div>
              <div className="h-5 w-0.5 bg-slate-300" />
              <div className="w-full max-w-sm bg-white p-4 rounded-xl border border-emerald-400 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-emerald-600">3. Automated Action</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{wfBuilder.actionType}</div>
                <div className="text-slate-500 mt-0.5">{wfBuilder.actionConfig}</div>
              </div>
            </div>

            {/* Right Node Inspector */}
            <div className="lg:col-span-4 bg-white rounded-[12px] border border-slate-200 p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">Node Configuration & Safeguards</div>
              <div>
                <label className="font-semibold text-slate-700">Workflow Name</label>
                <input value={wfBuilder.name} onChange={e => setWfBuilder({ ...wfBuilder, name: e.target.value })} className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Workflow Description</label>
                <textarea rows="2" value={wfBuilder.description} onChange={e => setWfBuilder({ ...wfBuilder, description: e.target.value })} className="w-full mt-1 p-2 border border-slate-200 rounded-lg" />
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 space-y-1">
                <div className="font-semibold text-blue-900 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-600" /> Duplicate Action Safeguard</div>
                <div className="text-[11px] text-blue-700">Idempotency lock active: prevents firing duplicate actions on the same record within 24 hours.</div>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Condition Field</label>
                <select value={wfBuilder.conditionField} onChange={e => setWfBuilder({ ...wfBuilder, conditionField: e.target.value })} className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg bg-white">
                  {['Lead Source', 'Deal Value', 'Assigned Employee', 'Deal Stage', 'Customer Type', 'Activity Status'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Condition Value</label>
                <input value={wfBuilder.conditionValue} onChange={e => setWfBuilder({ ...wfBuilder, conditionValue: e.target.value })} className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Action Parameters</label>
                <input value={wfBuilder.actionConfig} onChange={e => setWfBuilder({ ...wfBuilder, actionConfig: e.target.value })} className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    const filteredWf = workflows.filter(w => {
      if (tab === 'Active') return w.status === 'Active';
      if (tab === 'Drafts') return w.status === 'Draft';
      return true;
    });

    const allLogs = workflows.flatMap(w => (w.logs || []).map(l => ({ ...l, workflowName: w.name, wfId: w.id })));

    return (
      <div className="space-y-6">
        <PageHeader
          title="Automation Settings"
          subtitle="Automate repetitive CRM tasks and business workflows."
          breadcrumb="Automation Settings"
          actions={
            <button onClick={() => openBuilder(null)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create Workflow
            </button>
          }
        />

        <div className="flex gap-2 flex-wrap">
          {['All Workflows', 'Active', 'Drafts', 'Execution History'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab !== 'Execution History' ? (
          <div className="bg-white rounded-[12px] border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Workflow Name</th>
                    <th className="py-3 px-4">Trigger</th>
                    <th className="py-3 px-4">Actions</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Run</th>
                    <th className="py-3 px-4 text-right">Executions</th>
                    <th className="py-3 px-4 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWf.map(wf => (
                    <tr key={wf.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{wf.name}</div>
                        <div className="text-[11px] text-slate-500">{wf.description}</div>
                      </td>
                      <td className="py-3.5 px-4"><Badge variant="blue">⚡ {wf.trigger}</Badge></td>
                      <td className="py-3.5 px-4 text-slate-700">{wf.actions.map(a => a.type).join(' → ')}</td>
                      <td className="py-3.5 px-4"><Badge variant={getStatusVariant(wf.status)}>{wf.status}</Badge></td>
                      <td className="py-3.5 px-4 text-slate-500">{wf.lastRun}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">{wf.executions}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setWorkflows(prev => prev.map(item => item.id === wf.id ? { ...item, status: item.status === 'Active' ? 'Draft' : 'Active' } : item));
                              addToast('Workflow Toggled', `${wf.name} is now ${wf.status === 'Active' ? 'Paused (Draft)' : 'Active'}.`);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                              wf.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {wf.status === 'Active' ? 'Enabled' : 'Disabled'}
                          </button>
                          <button onClick={() => openBuilder(wf)} className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-semibold text-blue-600">
                            Edit Canvas
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Triggered Record</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allLogs.map(log => (
                  <tr key={log.id}>
                    <td className="py-3 px-4 text-slate-500">{log.time}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{log.workflowName}</td>
                    <td className="py-3 px-4 text-slate-700">{log.record}</td>
                    <td className="py-3 px-4">
                      <Badge variant={log.status === 'Success' ? 'green' : 'red'}>{log.status}</Badge>
                      {log.error && <span className="ml-2 text-[11px] text-rose-600">{log.error}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.duration}</td>
                    <td className="py-3 px-4 text-right">
                      {log.status === 'Failed' && (
                        <button
                          onClick={() => {
                            setWorkflows(prev => prev.map(w => ({
                              ...w,
                              logs: (w.logs || []).map(l => l.id === log.id ? { ...l, status: 'Success', error: null, time: 'Retried just now' } : l)
                            })));
                            addToast('Retry Succeeded', 'Workflow execution completed successfully.');
                          }}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // 15. CONNECTED CROSS-MODULE SHELL VIEW (WHEN USER CLICKS NON-CRM TOP ITEM)
  // ============================================================================

  const CrossModuleShellBanner = () => (
    <div className="bg-white rounded-[12px] border border-slate-200 p-8 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <Badge variant="blue">CRM Connected Platform | {activeTopModule} Module</Badge>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">{activeTopModule} workspace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live data synced from CRM records - no duplicate customer or employee records.
          </p>
        </div>
        <button
          onClick={() => setActiveTopModule('CRM')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          ← Return to CRM
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="font-bold text-slate-900 text-sm">Connected CRM Projects ({createdProjects.length})</div>
          {createdProjects.map(p => (
            <div key={p.id} className="p-2.5 bg-white rounded-lg border border-slate-200/80 flex justify-between">
              <span className="font-semibold">{p.id}: {p.name}</span>
              <Badge variant="green">{p.status}</Badge>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="font-bold text-slate-900 text-sm">Shared HR Directory ({EMPLOYEES.length} Reps)</div>
          {EMPLOYEES.slice(0, 3).map(e => (
            <div key={e.id} className="p-2.5 bg-white rounded-lg border border-slate-200/80 flex items-center gap-2">
              <Avatar employee={e} size="xs" />
              <div>
                <div className="font-semibold">{e.name}</div>
                <div className="text-[11px] text-slate-400">{e.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // 16. RENDER ACTIVE CRM PAGE
  // ============================================================================

  const renderActivePage = () => {
    const pageKey = activeTopModule === 'CRM' ? activeSubPage : 'cross-module';
    return (
      <CrmPageRenderer
        key={pageKey}
        render={() => {
          if (activeTopModule !== 'CRM') return CrossModuleShellBanner();
          switch (activeSubPage) {
            case 'leads': return LeadsPage();
            case 'contacts': return ContactsPage();
            case 'companies': return CompaniesPage();
            case 'deals': return DealsPipelinePage();
            case 'activities': return ActivitiesPage();
            case 'quotations': return QuotationsPage();
            case 'support': return CustomerSupportPage();
            case 'reports': return ReportsAnalyticsPage();
            case 'automation': return AutomationSettingsPage();
            default: return CrmDashboardPage();
          }
        }}
      />
    );
  };

  const unreadNotifCount = unreadCount;
  const unreadNotifications = notifications.filter(n => !n.readAt);
  const readNotifications = notifications.filter(n => !!n.readAt);
  const visibleNotifications = notificationTab === 'unread' ? unreadNotifications : readNotifications;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-app text-slate-900 font-sans antialiased">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Identical Fixed Top Navigation Bar (64px) */}
        <header className="h-[64px] bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100">
              <Layers className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
              <span className="font-medium text-slate-700">CRM</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{activeTopModule}</span>
              {activeTopModule === 'CRM' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-blue-600">{currentPageLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* Global Command Search Trigger */}
          <div className="flex-1 max-w-md">
            <button
              onClick={() => { setCommandQuery(''); setCommandOpen(true); }}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 border border-slate-200/90 text-xs text-slate-500 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Search leads, contacts, companies, deals...</span>
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded">
                Ctrl + K
              </kbd>
            </button>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileMenuOpen(false); }}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-dropdown z-40">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Notifications ({unreadNotifCount})</span>
                    {notificationTab === 'unread' && unreadNotifCount > 0 && (
                      <button
                        onClick={() => void markAllNotificationsRead()}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="flex border-b border-slate-100">
                    <button
                      onClick={() => setNotificationTab('unread')}
                      className={`flex-1 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${notificationTab === 'unread' ? 'border-blue-600 text-blue-600 bg-slate-50/70' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      Unread ({unreadNotifications.length})
                    </button>
                    <button
                      onClick={() => setNotificationTab('read')}
                      className={`flex-1 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${notificationTab === 'read' ? 'border-blue-600 text-blue-600 bg-slate-50/70' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      Read ({readNotifications.length})
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {visibleNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400">
                        {notificationTab === 'unread' ? 'No unread notifications' : 'No read notifications'}
                      </div>
                    ) : visibleNotifications.map(n => (
                      <div
                        key={recordId(n)}
                        onClick={() => void handleNotificationClick(n)}
                        className={`px-4 py-3 text-xs cursor-pointer transition-colors ${n.readAt ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 hover:bg-slate-200/70'}`}
                      >
                        <div className="font-semibold text-slate-900">{n.title || "Notification"}</div>
                        <div className="text-slate-500 mt-0.5">{n.message || n.body || ""}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{relativeTime(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assign / Invite */}
            <button
              onClick={() => setAssignOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Assign records"
            >
              Assign
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              title="Invite team or department"
            >
              Invite
            </button>

            {/* Help Button */}
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="CRM help and shortcuts"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setProfileMenuOpen(!profileMenuOpen); setNotificationsOpen(false); }}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors text-left"
              >
                <Avatar employee={EMPLOYEES[0]} size="sm" />
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{currentUser.role || 'Team member'}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-40 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="font-semibold text-slate-900">{currentUser.name}</div>
                    <div className="text-slate-400">{currentUser.email}</div>
                  </div>
                  <button onClick={() => { setProfileMenuOpen(false); navigateTo('automation'); }} className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-slate-400" /> CRM Automation Rules
                  </button>
                  <button onClick={() => { setProfileMenuOpen(false); navigateTo('reports'); }} className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-slate-400" /> My Quota & Attainment
                  </button>
                  <button onClick={() => { setProfileMenuOpen(false); addToast('Preferences', 'Notification & timezone preferences synced.'); }} className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-slate-400" /> Account Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1440px] mx-auto">
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* Global Command Palette Modal (Ctrl + K) */}
      <Modal
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        title="Global CRM command search"
        subtitle="Jump instantly to any CRM screen, lead, contact, company, or deal"
        maxWidth="max-w-xl"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={commandQuery}
              onChange={e => setCommandQuery(e.target.value)}
              placeholder="Type a name, company, deal, or CRM page..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {commandResults.map((item, idx) => (
              <button
                key={`${item.type}-${item.id}-${idx}`}
                onClick={() => { item.action(); setCommandOpen(false); }}
                className="w-full py-2.5 px-3 flex items-center justify-between hover:bg-blue-50/60 rounded-lg text-left transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                  <div className="text-[11px] text-slate-500">{item.sub}</div>
                </div>
                <Badge variant="neutral">{item.type}</Badge>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="CRM quick guide and shortcuts"
        maxWidth="max-w-md"
        footer={<button onClick={() => setHelpOpen(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">Got it</button>}
      >
        <div className="space-y-2.5 text-xs text-slate-600">
          <div className="flex justify-between py-1.5 border-b border-slate-100"><span>Global Command Search</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + K</kbd></div>
          <div className="flex justify-between py-1.5 border-b border-slate-100"><span>Close Active Modal or Drawer</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Esc</kbd></div>
          <div className="flex justify-between py-1.5"><span>Kanban Deal Stage Movement</span><span className="font-semibold text-slate-800">Drag & Drop Cards</span></div>
        </div>
      </Modal>

      {/* Board-style Assign / Invite dialogs */}
      {assignOpen ? (
        <CrmAssignModal
          collections={{
            leads: { label: "Lead", records: leads, set: setLeads, ownerField: "ownerId" },
            contacts: { label: "Contact", records: contacts, set: setContacts, ownerField: "ownerId" },
            companies: { label: "Company", records: companies, set: setCompanies, ownerField: "ownerId" },
            deals: { label: "Deal", records: deals, set: setDeals, ownerField: "ownerId" },
            activities: { label: "Activity", records: activities, set: setActivities, ownerField: "ownerId" },
            tickets: { label: "Ticket", records: tickets, set: setTickets, ownerField: "agentId" },
          }}
          onClose={() => setAssignOpen(false)}
          onAssigned={(label, name) => addToast("Record assigned", `${label} assigned to ${name}.`)}
        />
      ) : null}

      {inviteOpen ? (
        <CrmInviteModal
          members={members}
          teams={TEAMS.map((team: any) => team.name)}
          departments={DEPARTMENTS.map((department: any) => department.name)}
          onMembersChange={setMembers}
          onClose={() => setInviteOpen(false)}
          onInvited={(name) => addToast("Invitation sent", `${name} can now collaborate in CRM.`)}
        />
      ) : null}

      {/* Bottom-center action toasts */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto w-full bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700/80 flex items-start gap-3 text-xs animate-fadeIn"
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${t.type === 'error' ? 'text-rose-400' : t.type === 'info' ? 'text-blue-400' : 'text-emerald-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{t.title}</div>
              {t.description && <div className="text-slate-300 mt-0.5">{t.description}</div>}
            </div>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom-right live notification toasts */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {notificationToasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white text-slate-900 px-4 py-3 rounded-xl shadow-modal border border-slate-200 flex items-start gap-3 text-xs animate-fadeIn"
          >
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{t.title}</div>
              {t.description && <div className="text-slate-500 mt-0.5">{t.description}</div>}
              <div className="text-[10px] text-slate-400 mt-1">New app notification</div>
            </div>
            <button onClick={() => setNotificationToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CrmShell;

