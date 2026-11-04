"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { useRouter } from "next/navigation";
import {
  Bell, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, Copy, Eye, EyeOff,
  Filter, History, Inbox, LayoutDashboard, Menu, Plus, RefreshCcw, Search, Send, Settings,
  ShieldCheck, Users, X,
} from "lucide-react";

type Delegation = {
  id: string; featureKey: string; featureName: string; scope: string[]; status: string;
  createdAt: string; expiresAt: string; reason?: string;
  authorizer?: Person; recipient?: Person; pin?: string;
  review?: Review;
};
type Review = {
  status?: "none" | "submitted" | "approved" | "changes-requested";
  submittedAt?: string | null;
  submitNote?: string;
  reviewedAt?: string | null;
  reviewNote?: string;
};
type Person = { id?: string; name: string; role: string; email?: string; avatarUrl?: string; regionLabel?: string };
type Feature = { key: string; name: string; actions: string[] };
type Tab = "delegations" | "share" | "approvals" | "history";

/**
 * Every delegatable feature key maps to the page that actually renders it.
 *
 * Keep this list exhaustive: an unmatched key falls back to the delegation
 * screen, which makes a successful PIN verification look like nothing happened.
 */
const FEATURE_DESTINATIONS: Record<string, string> = {
  "hr-policy-editing": "/profile/hr-policy",
  "hr-member-management": "/profile/members",
  "hr-salary-management": "/profile/members",
  "hr-export-excels": "/profile/members",
  "hr-onboarding": "/profile/onboarding",
  "recruitment-create-jobs": "/profile/careers",
  "recruitment-screening": "/profile/careers",
  "recruitment-offers": "/profile/careers",
  "recruitment-assessments": "/profile/careers",
  "recruitment-interviews": "/profile/careers",
  "finance-policy-editing": "/profile/finance-policy",
  "finance-expense-requests": "/profile/finance",
  "finance-invoices": "/profile/finance",
  "finance-project-budgets": "/profile/finance",
  "finance-salaries": "/profile/finance",
  "finance-attendance-export": "/profile/attendance",
  "finance-checkout-requests": "/profile/members",
  "project-management": "/board",
  "project-task-management": "/board",
  "project-budget-planning": "/board",
  "project-reports": "/profile/command-center",
  "qa-test-plans": "/recruitment",
  "qa-assessment-review": "/recruitment",
  "qa-defect-review": "/recruitment",
  "qa-reports": "/recruitment",
  "it-tickets": "/profile/it",
  "it-provisioning": "/profile/it",
  "it-joining-codes": "/profile/it",
  "it-team-management": "/profile/it",
  "warehouse-inventory": "/profile/store/manage",
  "warehouse-stock-movements": "/profile/store/manage",
  "warehouse-orders": "/profile/store/orders",
  "warehouse-delivery": "/profile/store/delivery",
  "warehouse-reports": "/profile/store/manage",
  "security-visitors": "/profile/visitors",
  "security-entry-logs": "/profile/security",
  "security-lost-cards": "/profile/security",
  "security-access-review": "/profile/security",
};

function featureDestination(featureKey: string) {
  if (FEATURE_DESTINATIONS[featureKey]) return FEATURE_DESTINATIONS[featureKey];
  if (featureKey.startsWith("finance-")) return "/profile/finance";
  if (featureKey.startsWith("hr-")) return "/profile/members";
  if (featureKey.startsWith("recruitment-")) return "/profile/careers";
  if (featureKey.startsWith("it-")) return "/profile/it";
  if (featureKey.startsWith("warehouse-")) return "/profile/store";
  if (featureKey.startsWith("security-")) return "/profile/security";
  if (featureKey.startsWith("project-")) return "/board";
  if (featureKey.startsWith("qa-")) return "/recruitment";
  return "/profile/feature-delegation";
}

const roleLabel = (role = "") => role.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (name = "") => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const remaining = (value: string) => {
  const days = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
  return days === 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"} left`;
};
const isActive = (row: Delegation) => row.status === "active" && new Date(row.expiresAt) > new Date();

const WORK_STATUS_META: Record<string, { label: string; chip: string; hint: string }> = {
  none: { label: "No work sent yet", chip: "bg-slate-100 text-slate-500", hint: "" },
  submitted: { label: "Awaiting approval", chip: "bg-amber-100/70 text-amber-700", hint: "Waiting on the feature owner" },
  approved: { label: "Approved · published", chip: "bg-emerald-50 text-emerald-700", hint: "" },
  "changes-requested": { label: "Changes requested", chip: "bg-rose-50 text-rose-600", hint: "" },
};

function Avatar({ person, size = "h-9 w-9" }: { person?: Person; size?: string }) {
  return person?.avatarUrl ? (
    <img src={person.avatarUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-200 text-xs font-bold text-indigo-700`}>
      {initials(person?.name)}
    </div>
  );
}

export function FeatureDelegationWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("delegations");
  const [view, setView] = useState<"managed" | "shared">("managed");
  const [rows, setRows] = useState<Delegation[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [metrics, setMetrics] = useState({ active: 0, pending: 0, expiring: 0, members: 0 });
  const [managedCount, setManagedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [lastPin, setLastPin] = useState<{ pin: string; name: string; feature: string; expiresAt: string } | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pins, setPins] = useState<Record<string, string>>({});

  // Green-PIN verification modal (opens a shared feature).
  const [verifyFor, setVerifyFor] = useState<Delegation | null>(null);
  const [verifyPin, setVerifyPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Work submission (recipient) and review (authorizer) modals.
  const [workFor, setWorkFor] = useState<Delegation | null>(null);
  const [reviewFor, setReviewFor] = useState<Delegation | null>(null);
  const [decision, setDecision] = useState<"approved" | "changes-requested">("approved");
  const [workNote, setWorkNote] = useState("");
  const [working, setWorking] = useState(false);

  // Extend modal.
  const [extendFor, setExtendFor] = useState<Delegation | null>(null);
  const [extendDays, setExtendDays] = useState("30");

  // Approval inbox holds its own managed-view copy so the list works
  // regardless of which view ("managed"/"shared") the table is showing.
  const [inboxRows, setInboxRows] = useState<Delegation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  // Share form.
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [memberResults, setMemberResults] = useState<Person[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [currentRegion, setCurrentRegion] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [otherRegionMode, setOtherRegionMode] = useState(false);
  const [featureKey, setFeatureKey] = useState("");
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function notify(tone: "info" | "success" | "error", text: string) {
    setMessageTone(tone);
    setMessage(text);
  }
  async function clearPin(id: string) {
    if (pins[id]) {
      setPinFor(pinFor === id ? null : id);
      return;
    }
    try {
      const result = await apiFetch<{ pin: string }>(`/api/delegations/${id}/pin`, undefined, { toast: false });
      setPins((old) => ({ ...old, [id]: result.pin }));
      setPinFor(id);
    } catch {
      notify("error", "PIN is available only while the delegation is active.");
    }
  }
  async function loadInbox() {
    setInboxLoading(true);
    try {
      const result = await apiFetch<{ delegations: Delegation[] }>("/api/delegations?view=managed", undefined, { toast: false });
      setInboxRows(result.delegations ?? []);
    } catch {
      /* keep previous inbox content */
    } finally {
      setInboxLoading(false);
    }
  }
  async function load(nextView = view) {
    setLoading(true);
    try {
      const result = await apiFetch<{ delegations: Delegation[]; features: Feature[]; metrics: typeof metrics }>(
        `/api/delegations?view=${nextView}`, undefined, { toast: false },
      );
      setRows(result.delegations ?? []);
      setFeatures(result.features ?? []);
      setMetrics(result.metrics ?? { active: 0, pending: 0, expiring: 0, members: 0 });
    } catch {
      notify("error", "Unable to load delegation data right now.");
    } finally {
      setLoading(false);
    }
  }
  async function refreshCounts() {
    try {
      const [managed, shared] = await Promise.all([
        apiFetch<{ delegations: Delegation[] }>("/api/delegations?view=managed", undefined, { toast: false }),
        apiFetch<{ delegations: Delegation[] }>("/api/delegations?view=shared", undefined, { toast: false }),
      ]);
      setManagedCount((managed.delegations ?? []).length);
      setSharedCount((shared.delegations ?? []).length);
    } catch { /* ignore */ }
  }

  useEffect(() => { void load(view); }, [view]);
  useEffect(() => { void refreshCounts(); }, []);
  useEffect(() => {
    if (tab === "approvals") void loadInbox();
  }, [tab]);
  // Deep links from notifications: ?view=shared or ?tab=approvals.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "approvals") setTab("approvals");
    else if (params.get("view") === "shared") { setView("shared"); setTab("delegations"); }
  }, []);
  useEffect(() => {
    if (tab !== "share") return;
    void apiFetch<{ regions: string[]; currentRegion: string }>("/api/delegations?members=1", undefined, { toast: false })
      .then((result) => {
        setRegions(result.regions ?? []);
        setCurrentRegion(result.currentRegion ?? "");
        setSelectedRegion((value) => value || result.currentRegion || "");
      })
      .catch(() => undefined);
  }, [tab]);
  useEffect(() => {
    if (tab !== "share" || recipientName.trim().length < 2 || !selectedRegion) {
      setMemberResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void apiFetch<{ members: Person[] }>(`/api/delegations?members=1&region=${encodeURIComponent(selectedRegion)}&q=${encodeURIComponent(recipientName)}`, undefined, { toast: false })
        .then((result) => setMemberResults(result.members ?? []))
        .catch(() => setMemberResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, recipientName, selectedRegion]);

  const filtered = useMemo(
    () => rows.filter((row) => `${row.featureName} ${row.recipient?.name ?? row.authorizer?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );
  const selectedFeature = features.find((item) => item.key === featureKey);
  const inboxPending = inboxRows.filter((row) => row.review?.status === "submitted");
  const inboxDecided = inboxRows
    .filter((row) => row.review?.status === "approved" || row.review?.status === "changes-requested")
    .sort((a, b) => new Date(b.review?.reviewedAt ?? 0).getTime() - new Date(a.review?.reviewedAt ?? 0).getTime());

  async function createDelegation(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const expiresAt = new Date(Date.now() + Number(days) * 86400000).toISOString();
      const result = await apiFetch<{ delegation: Delegation }>("/api/delegations", {
        method: "POST",
        body: JSON.stringify({ recipientId, featureKey, expiresAt, reason, scope: selectedFeature?.actions }),
      });
      setLastPin({ pin: result.delegation.pin ?? "", name: recipientName, feature: result.delegation.featureName, expiresAt });
      notify("success", `Feature shared with ${recipientName}. They can start once they verify the Temporary Green-PIN.`);
      setRecipientId("");
      setRecipientName("");
      setReason("");
      setView("managed");
      setTab("delegations");
      await load("managed");
      await refreshCounts();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not create delegation.");
    } finally {
      setSubmitting(false);
    }
  }
  async function revoke(id: string) {
    if (!window.confirm("Revoke this delegated access now?")) return;
    try {
      await apiFetch(`/api/delegations/${id}`, { method: "DELETE" });
      notify("success", "Delegated access revoked.");
      await load();
      await refreshCounts();
      await loadInbox();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not revoke access.");
    }
  }
  async function extendConfirm() {
    if (!extendFor) return;
    const daysToAdd = Number(extendDays);
    if (!Number.isInteger(daysToAdd) || daysToAdd < 1 || daysToAdd > 366) {
      notify("error", "Enter a whole number from 1 to 366.");
      return;
    }
    try {
      await apiFetch(`/api/delegations/${extendFor.id}`, {
        method: "PATCH",
        body: JSON.stringify({ expiresAt: new Date(Math.max(Date.now(), new Date(extendFor.expiresAt).getTime()) + daysToAdd * 86400000).toISOString() }),
      });
      notify("success", `Delegation extended by ${daysToAdd} day${daysToAdd === 1 ? "" : "s"}.`);
      setExtendFor(null);
      await load();
      await refreshCounts();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not extend access.");
    }
  }
  async function submitWork() {
    if (!workFor) return;
    if (workNote.trim().length < 5) {
      notify("error", "Describe the completed work before sending it for approval.");
      return;
    }
    setWorking(true);
    try {
      await apiFetch(`/api/delegations/${workFor.id}/submit-work`, { method: "POST", body: JSON.stringify({ note: workNote.trim() }) });
      notify("success", `Work sent to ${workFor.authorizer?.name ?? "the feature owner"} for approval.`);
      setWorkFor(null);
      setWorkNote("");
      await load();
      await refreshCounts();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not submit the work.");
    } finally {
      setWorking(false);
    }
  }
  async function reviewWork() {
    if (!reviewFor) return;
    if (decision === "changes-requested" && workNote.trim().length < 5) {
      notify("error", "Tell the member what to change before requesting changes.");
      return;
    }
    setWorking(true);
    try {
      await apiFetch(`/api/delegations/${reviewFor.id}/review`, { method: "POST", body: JSON.stringify({ decision, note: workNote.trim() }) });
      notify(
        "success",
        decision === "approved"
          ? `Approved — ${reviewFor.recipient?.name ?? "the member"}'s work in ${reviewFor.featureName} has been published.`
          : `Changes requested in ${reviewFor.featureName}. The member can redo and resubmit.`,
      );
      setReviewFor(null);
      setWorkNote("");
      setDecision("approved");
      await load();
      await refreshCounts();
      await loadInbox();
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not record the review.");
    } finally {
      setWorking(false);
    }
  }
  async function openSharedFeature() {
    if (!verifyFor) return;
    setVerifying(true);
    setMessage("");
    try {
      await apiFetch(`/api/delegations/${verifyFor.id}/verify`, { method: "POST", body: JSON.stringify({ pin: verifyPin }) });
      const target = featureDestination(verifyFor.featureKey);
      const separator = target.includes("?") ? "&" : "?";
      const url = `${target}${separator}delegation=${encodeURIComponent(verifyFor.id)}&feature=${encodeURIComponent(verifyFor.featureKey)}`;
      setVerifyFor(null);
      setVerifyPin("");
      router.push(url, { scroll: false });
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to verify this delegation.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className={`feature-delegation-shell ${embedded ? "bg-transparent" : "min-h-screen bg-[var(--c-bg)]"} text-[var(--c-text)]`}>
      <div className="flex min-h-screen">
        <aside className={embedded ? "hidden" : "w-[224px] shrink-0 flex-col bg-[#10182b] text-white lg:flex"}>
          <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-6">
            <div className="grid h-8 w-8 rotate-45 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500">
              <ShieldCheck className="-rotate-45 text-white" size={20} />
            </div>
            <span className="text-[22px] font-semibold tracking-tight">FlowZen</span>
          </div>
          <div className="px-3 py-5">
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-sm font-semibold">{session?.user?.company ?? "Your company"}</p>
              <p className="mt-1 text-xs text-white/60">Enterprise workspace</p>
            </div>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Workspace</p>
            <SideItem icon={<LayoutDashboard size={17} />} label="Dashboard" />
            <SideItem icon={<Users size={17} />} label="Members" />
            <SideItem icon={<Clock3 size={17} />} label="My Tasks" />
          </div>
          <div className="px-3">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Feature Delegation</p>
            <SideItem active icon={<Users size={17} />} label="Manage Delegations" onClick={() => { setTab("delegations"); setView("managed"); }} />
            <SideItem icon={<Plus size={17} />} label="Share Feature" onClick={() => setTab("share")} />
            <SideItem icon={<Inbox size={17} />} label="Approval Inbox" badge={metrics.pending || undefined} onClick={() => setTab("approvals")} />
            <SideItem icon={<History size={17} />} label="Delegation History" onClick={() => setTab("history")} />
          </div>
          <div className="mt-auto px-3 pb-5">
            <SideItem icon={<Settings size={17} />} label="Settings" />
            <SideItem icon={<ChevronRight size={17} />} label="Help &amp; Support" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className={embedded ? "hidden" : "flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"}>
            <div className="flex min-w-0 items-center gap-3">
              <Menu className="text-slate-400 lg:hidden" size={21} />
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex sm:w-[380px]">
                <Search size={17} className="text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search members, features, approvals..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-5">
              <button className="relative text-slate-500" onClick={() => setTab("approvals")} aria-label="Approval inbox">
                <Bell size={19} />
                {metrics.pending ? <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{metrics.pending}</span> : null}
              </button>
              <div className="hidden items-center gap-2 sm:flex">
                <Avatar person={{ name: session?.user?.name ?? "", role: session?.user?.role ?? "" }} size="h-9 w-9" />
                <div>
                  <p className="text-sm font-semibold">{session?.user?.name}</p>
                  <p className="text-[11px] text-slate-500">{roleLabel(session?.user?.role)}</p>
                </div>
                <ChevronDown size={15} className="text-slate-500" />
              </div>
            </div>
          </header>

          <div className={`mx-auto max-w-[1440px] ${embedded ? "p-0" : "p-4 sm:p-7"}`}>
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200">
                  <ShieldCheck size={29} />
                </div>
                <div>
                  <h1 className="text-[28px] font-bold tracking-tight text-[#12203d]">Feature Delegation</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Share features with temporary Green-PIN access. Members verify the PIN, do the work, send it back for approval — you publish it.
                  </p>
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200"
                onClick={() => setTab("share")}
              >
                <Plus size={18} /> Share a Feature
              </button>
            </div>

            {lastPin ? (
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Temporary Green-PIN for {lastPin.name}</p>
                    <p className="text-xs text-emerald-700">Share it through a private channel. {lastPin.feature} · expires {dateLabel(lastPin.expiresAt)}.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-xl border border-emerald-300 bg-white px-4 py-2 font-mono text-lg tracking-[.35em] text-emerald-800">{lastPin.pin}</code>
                  <button
                    className="rounded-lg border border-emerald-300 bg-white p-2 text-emerald-700"
                    title="Copy PIN"
                    onClick={() => void navigator.clipboard?.writeText(lastPin.pin).catch(() => undefined)}
                  >
                    <Copy size={16} />
                  </button>
                  <button className="rounded-lg border border-emerald-300 bg-white p-2 text-emerald-700" title="Dismiss" onClick={() => setLastPin(null)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className={`mb-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
                messageTone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : messageTone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-violet-200 bg-violet-50 text-violet-800"
              }`}>
                <span>{message}</span>
                <button onClick={() => setMessage("")} aria-label="Dismiss message"><X size={16} /></button>
              </div>
            ) : null}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<ShieldCheck />} label="Active Delegations" value={metrics.active} tone="green" />
              <Metric icon={<Clock3 />} label="Works Awaiting Approval" value={metrics.pending} tone="blue" />
              <Metric icon={<Clock3 />} label="Expiring Soon" value={metrics.expiring} tone="amber" />
              <Metric icon={<Users />} label="Members Using Access" value={metrics.members} tone="rose" />
            </div>

            <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-slate-200">
              <TabButton active={tab === "delegations"} onClick={() => setTab("delegations")} label={view === "managed" ? "My Delegations" : "Shared With Me"} />
              <TabButton active={tab === "share"} onClick={() => setTab("share")} label="Share Feature" />
              <TabButton active={tab === "approvals"} onClick={() => setTab("approvals")} label={`Approval Inbox${metrics.pending ? ` (${metrics.pending})` : ""}`} />
              <TabButton active={tab === "history"} onClick={() => setTab("history")} label="Delegation History" />
            </div>

            {tab === "share" ? (
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <ShareForm
                  features={features}
                  featureKey={featureKey}
                  setFeatureKey={setFeatureKey}
                  recipientId={recipientId}
                  setRecipientId={setRecipientId}
                  recipientName={recipientName}
                  setRecipientName={setRecipientName}
                  memberResults={memberResults}
                  regions={regions}
                  currentRegion={currentRegion}
                  selectedRegion={selectedRegion}
                  setSelectedRegion={setSelectedRegion}
                  otherRegionMode={otherRegionMode}
                  setOtherRegionMode={setOtherRegionMode}
                  days={days}
                  setDays={setDays}
                  reason={reason}
                  setReason={setReason}
                  onSubmit={createDelegation}
                  submitting={submitting}
                />
                <ShareAside
                  recipientName={recipientName}
                  recipientId={recipientId}
                  memberResults={memberResults}
                  featureName={selectedFeature?.name ?? ""}
                  actions={selectedFeature?.actions ?? []}
                  days={Number(days) || 0}
                />
              </div>
            ) : tab === "approvals" ? (
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <ApprovalInbox
                  pending={inboxPending}
                  decided={inboxDecided}
                  loading={inboxLoading}
                  onReview={(row, nextDecision) => { setReviewFor(row); setDecision(nextDecision); setWorkNote(""); }}
                  onRefresh={() => void loadInbox()}
                />
                <ApprovalAside pending={inboxPending} rows={inboxRows} />
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <DelegationsTable
                  rows={filtered}
                  loading={loading}
                  view={view}
                  history={tab === "history"}
                  onOpen={(row) => { setVerifyFor(row); setVerifyPin(""); }}
                  onReview={(row, nextDecision) => { setReviewFor(row); setDecision(nextDecision); setWorkNote(""); }}
                  onSubmitWork={(row) => { setWorkFor(row); setWorkNote(row.review?.status === "changes-requested" ? row.review.submitNote ?? "" : ""); }}
                  onTogglePin={(id) => void clearPin(id)}
                  pinFor={pinFor}
                  pins={pins}
                  onExtend={(row) => { setExtendFor(row); setExtendDays("30"); }}
                  onRevoke={(id) => void revoke(id)}
                  query={query}
                  onQuery={setQuery}
                  emptyShare={() => setTab("share")}
                  onReload={() => { void load(); void refreshCounts(); }}
                  onViewChange={(nextView) => setView(nextView)}
                  managedCount={managedCount}
                  sharedCount={sharedCount}
                />
                <DelegationsAside
                  rows={rows}
                  onShare={() => setTab("share")}
                  onApprovals={() => setTab("approvals")}
                  onHistory={() => setTab("history")}
                />
              </div>
            )}
          </div>

          {verifyFor ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Open {verifyFor.featureName}</h3>
                    <p className="mt-1 text-sm text-slate-500">Enter the eight-digit Temporary Green-PIN to work in this shared feature.</p>
                  </div>
                  <button className="text-slate-400" onClick={() => setVerifyFor(null)}><X size={19} /></button>
                </div>
                <div className="mt-5 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">
                  Shared by <span className="font-semibold">{verifyFor.authorizer?.name ?? "your approver"}</span>
                  <br />
                  <span className="text-violet-700">Access expires {dateLabel(verifyFor.expiresAt)} — when your work is done, send it back for approval from Shared With Me.</span>
                </div>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={8}
                  className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-lg tracking-[.35em] outline-none focus:border-violet-500"
                  placeholder="8-digit PIN"
                  value={verifyPin}
                  onChange={(event) => setVerifyPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                />
                <div className="mt-5 flex justify-end gap-3">
                  <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setVerifyFor(null)}>Cancel</button>
                  <button
                    disabled={verifying || verifyPin.length !== 8}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void openSharedFeature()}
                  >
                    {verifying ? "Verifying..." : "Verify and Open"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {workFor ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Send work for approval</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Submit your completed work in <span className="font-semibold">{workFor.featureName}</span> to {workFor.authorizer?.name ?? "the feature owner"} for review.
                    </p>
                  </div>
                  <button className="text-slate-400" onClick={() => setWorkFor(null)}><X size={19} /></button>
                </div>
                <div className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-xs text-violet-800">
                  Your PIN access stays active while they review — use it for follow-up edits if changes are requested.
                </div>
                {workFor.review?.status === "changes-requested" && workFor.review?.reviewNote ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    <span className="font-semibold">Requested changes:</span> {workFor.review.reviewNote}
                  </div>
                ) : null}
                <textarea
                  autoFocus
                  rows={5}
                  maxLength={2000}
                  className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                  placeholder="Describe what you completed, decisions made, links or evidence…"
                  value={workNote}
                  onChange={(event) => setWorkNote(event.target.value)}
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-400">{workNote.length}/2,000 characters</p>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setWorkFor(null)}>Cancel</button>
                  <button
                    disabled={working || workNote.trim().length < 5}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void submitWork()}
                  >
                    <Send size={15} /> {working ? "Sending..." : "Send for approval"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {reviewFor ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Review submitted work</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {reviewFor.recipient?.name ?? "The member"} finished their work in <span className="font-semibold">{reviewFor.featureName}</span>. Approve to publish it or request changes.
                    </p>
                  </div>
                  <button className="text-slate-400" onClick={() => setReviewFor(null)}><X size={19} /></button>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Submitted note</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{reviewFor.review?.submitNote || "No note provided."}</p>
                  {reviewFor.review?.submittedAt ? <p className="mt-2 text-[11px] text-slate-400">Sent {dateLabel(reviewFor.review.submittedAt)}</p> : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${decision === "approved" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
                    onClick={() => setDecision("approved")}
                  >
                    <CheckCircle2 size={15} className="mr-1 inline" /> Approve &amp; publish
                  </button>
                  <button
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${decision === "changes-requested" ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500"}`}
                    onClick={() => setDecision("changes-requested")}
                  >
                    <RefreshCcw size={15} className="mr-1 inline" /> Request changes
                  </button>
                </div>
                <textarea
                  rows={3}
                  maxLength={2000}
                  className={`mt-3 w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none ${decision === "changes-requested" ? "border-rose-200 focus:border-rose-400" : "border-slate-200 focus:border-violet-500"}`}
                  placeholder={decision === "approved" ? "Optional note for the member (records stay in history)…" : "What exactly needs to change? *"}
                  value={workNote}
                  onChange={(event) => setWorkNote(event.target.value)}
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setReviewFor(null)}>Cancel</button>
                  <button
                    disabled={working || (decision === "changes-requested" && workNote.trim().length < 5)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${decision === "approved" ? "bg-emerald-600" : "bg-rose-600"}`}
                    onClick={() => void reviewWork()}
                  >
                    {working ? "Saving..." : decision === "approved" ? "Approve and publish" : "Request changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {extendFor ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Extend access</h3>
                    <p className="mt-1 text-sm text-slate-500">Add more days to <span className="font-semibold">{extendFor.recipient?.name ?? "the member"}</span>&apos;s access to {extendFor.featureName}.</p>
                  </div>
                  <button className="text-slate-400" onClick={() => setExtendFor(null)}><X size={19} /></button>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500">Days to add</p>
                  <input
                    type="number"
                    min={1}
                    max={366}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500"
                    value={extendDays}
                    onChange={(event) => setExtendDays(event.target.value)}
                  />
                  <p className="mt-2 text-xs text-slate-400">Maximum 366 days per extension.</p>
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setExtendFor(null)}>Cancel</button>
                  <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void extendConfirm()}>Extend</button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

/* ── Table (Manage Delegations / History) ─────────────────────────────────── */

function DelegationsTable({
  rows, loading, view, history, onOpen, onReview, onSubmitWork, onTogglePin, pinFor, pins, onExtend, onRevoke, query, onQuery, emptyShare, onReload, onViewChange, managedCount, sharedCount,
}: {
  rows: Delegation[];
  loading: boolean;
  view: "managed" | "shared";
  history: boolean;
  managedCount: number;
  sharedCount: number;
  onOpen: (row: Delegation) => void;
  onReview: (row: Delegation, decision: "approved" | "changes-requested") => void;
  onSubmitWork: (row: Delegation) => void;
  onTogglePin: (id: string) => void;
  pinFor: string | null;
  pins: Record<string, string>;
  onExtend: (row: Delegation) => void;
  onRevoke: (id: string) => void;
  query: string;
  onQuery: (value: string) => void;
  emptyShare: () => void;
  onReload: () => void;
  onViewChange: (view: "managed" | "shared") => void;
}) {
  function workCell(row: Delegation) {
    if (view === "managed") return null;
    if (row.review?.status === "approved") return <p className="text-[11px] font-medium text-emerald-600">Approved by {row.authorizer?.name ?? "owner"}</p>;
    if (row.review?.status === "submitted") return <p className="text-[11px] font-medium text-amber-600">Sent {dateLabel(row.review?.submittedAt ?? row.expiresAt)}</p>;
    if (row.review?.status === "changes-requested") return <p className="text-[11px] font-medium text-rose-500">Redo and resubmit</p>;
    return <p className="text-[11px] text-slate-400">Finish, then send for approval</p>;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold">{history ? "Delegation History" : view === "managed" ? "My Active Delegations" : "Shared With Me"}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {history
              ? "Every delegation you shared or received, including its review outcome."
              : view === "managed"
                ? "Manage members, view PINs, extend or revoke access."
                : "Verify the Green-PIN to open the feature, then send your completed work back for approval."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {history ? null : (
            <>
              <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "managed" ? "bg-violet-50 text-violet-700" : "border border-slate-200 text-slate-500"}`} onClick={() => onViewChange("managed")}>
                Managed ({managedCount})
              </button>
              <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "shared" ? "bg-violet-50 text-violet-700" : "border border-slate-200 text-slate-500"}`} onClick={() => onViewChange("shared")}>
                Shared with me ({sharedCount})
              </button>
            </>
          )}
          <button className="rounded-lg border border-slate-200 p-2 text-slate-500" title="Filter" aria-haspopup="true">
            <Filter size={16} />
          </button>
          <button className="rounded-lg border border-slate-200 p-2 text-slate-500" title="Reload" onClick={onReload}>
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>
      {query ? (
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500">
          Filtering list for&nbsp;<span className="font-semibold text-slate-700">“{query}”</span>
          <button className="ml-2 font-semibold text-violet-600" onClick={() => onQuery("")}>Clear</button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-6">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : rows.length === 0 ? (
          <Empty view={view} onShare={emptyShare} />
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{view === "managed" ? "Member" : "Shared by"}</th>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Temporary Green-PIN</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const workMeta = WORK_STATUS_META[row.review?.status ?? "none"];
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar person={view === "managed" ? row.recipient : row.authorizer} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{(view === "managed" ? row.recipient : row.authorizer)?.name ?? "Member"}</p>
                          <p className="text-xs capitalize text-slate-500">{roleLabel((view === "managed" ? row.recipient : row.authorizer)?.role)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-700">{row.featureName}</p>
                      {row.scope.length > 0 ? <p className="mt-1 max-w-[190px] truncate text-xs text-slate-400" title={row.scope.join(" · ")}>{row.scope.join(" · ")}</p> : null}
                      {view === "shared" ? workCell(row) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex w-[132px] items-center justify-between rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tracking-wider">
                        {pinFor === row.id ? pins[row.id] ?? "••••••••" : "••••••••"}
                        {view === "managed" ? (
                          <button onClick={() => onTogglePin(row.id)} aria-label="Show or hide PIN" className="text-slate-400 hover:text-violet-600">
                            {pinFor === row.id ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        ) : (
                          <span className="text-slate-300"><Eye size={16} /></span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-xs font-medium text-slate-700">{dateLabel(row.expiresAt)}</p>
                      <p className={`mt-1 text-[11px] ${remaining(row.expiresAt) === "Expired" ? "text-rose-500" : "text-slate-400"}`}>{remaining(row.expiresAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <Status status={row.status} />
                        {row.review?.status && row.review.status !== "none" ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${workMeta.chip}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />{workMeta.label}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {view === "shared" && isActive(row) ? (
                          <button className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700" onClick={() => onOpen(row)}>Open feature</button>
                        ) : null}
                        {view === "shared" && isActive(row) && row.review?.status !== "submitted" ? (
                          <button className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50" onClick={() => onSubmitWork(row)}>
                            {row.review?.status === "changes-requested" ? "Resubmit work" : row.review?.status === "approved" ? "Send more work" : "Send work for approval"}
                          </button>
                        ) : null}
                        {view === "managed" && row.review?.status === "submitted" ? (
                          <>
                            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => onReview(row, "approved")}>Approve &amp; publish</button>
                            <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={() => onReview(row, "changes-requested")}>Request changes</button>
                          </>
                        ) : null}
                        {view === "managed" && row.status !== "revoked" && isActive(row) ? (
                          <>
                            <button className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50" onClick={() => onExtend(row)}>Extend</button>
                            <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={() => onRevoke(row.id)}>Revoke</button>
                          </>
                        ) : null}
                      </div>
                      {view === "shared" && row.review?.status === "changes-requested" && row.review?.reviewNote ? (
                        <p className="mt-2 max-w-[220px] rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-600" title={row.review.reviewNote}>
                          “{row.review.reviewNote.slice(0, 90)}{row.review.reviewNote.length > 90 ? "…" : ""}”
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ── Share feature tab ────────────────────────────────────────────────────── */

function ShareForm({
  features, featureKey, setFeatureKey, recipientId, setRecipientId, recipientName, setRecipientName, memberResults, regions, currentRegion, selectedRegion, setSelectedRegion, otherRegionMode, setOtherRegionMode, days, setDays, reason, setReason, onSubmit, submitting,
}: {
  features: Feature[];
  featureKey: string;
  setFeatureKey: (v: string) => void;
  recipientId: string;
  setRecipientId: (v: string) => void;
  recipientName: string;
  setRecipientName: (v: string) => void;
  memberResults: Person[];
  regions: string[];
  currentRegion: string;
  selectedRegion: string;
  setSelectedRegion: (v: string) => void;
  otherRegionMode: boolean;
  setOtherRegionMode: (v: boolean) => void;
  days: string;
  setDays: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Share a Feature</h2>
        <p className="mt-1 text-sm text-slate-500">
          Grant a member temporary access to one specific feature. Their role and existing permissions remain unchanged — the access expires on its own.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">Member</label>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span>Showing employees from <strong>{selectedRegion || currentRegion || "your region"}</strong></span>
            {otherRegionMode ? (
              <button type="button" className="font-semibold text-violet-700" onClick={() => { setOtherRegionMode(false); setSelectedRegion(currentRegion); setRecipientId(""); setRecipientName(""); }}>
                Use my region
              </button>
            ) : (
              <button type="button" className="font-semibold text-violet-700" onClick={() => { setOtherRegionMode(true); setSelectedRegion(""); setRecipientId(""); setRecipientName(""); }}>
                Send feature to another region
              </button>
            )}
          </div>
          {otherRegionMode ? (
            <select
              required
              value={selectedRegion}
              onChange={(e) => { setSelectedRegion(e.target.value); setRecipientId(""); setRecipientName(""); }}
              className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
            >
              <option value="">Select destination region</option>
              {regions.filter((region) => region.toLowerCase() !== currentRegion.toLowerCase()).map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          ) : null}
          <div className="relative">
            <input
              required
              value={recipientName}
              onChange={(e) => { setRecipientName(e.target.value); setRecipientId(""); }}
              placeholder={otherRegionMode ? "Search employees in selected region" : "Search employees in your region"}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
            />
            {memberResults.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {memberResults.map((member) => (
                  <button
                    type="button"
                    key={member.id}
                    onClick={() => { setRecipientId(member.id ?? ""); setRecipientName(member.name); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-violet-50"
                  >
                    <Avatar person={member} size="h-8 w-8" />
                    <span>
                      <span className="block text-sm font-semibold">{member.name}</span>
                      <span className="block text-xs capitalize text-slate-500">{roleLabel(member.role)} · {member.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {recipientId ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 size={13} /> Member selected: {recipientName}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">Only approved members in your company appear in search.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Feature and permitted actions</label>
          <select
            required
            value={featureKey}
            onChange={(e) => setFeatureKey(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
          >
            <option value="">Select a feature you can delegate</option>
            {features.map((feature) => <option value={feature.key} key={feature.key}>{feature.name}</option>)}
          </select>
          {featureKey ? (
            <div className="mt-3 rounded-xl bg-violet-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">Permitted actions</p>
              <p className="mt-1 text-sm text-violet-800">{features.find((f) => f.key === featureKey)?.actions.join(" · ")}</p>
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Access duration</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {["30", "60", "90", "180", "360"].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setDays(value)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${days === value ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600"}`}
              >
                {value} days
              </button>
            ))}
            <input
              type="number"
              min="1"
              max="366"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Expires on <strong>{new Date(Date.now() + Number(days || 0) * 86400000).toLocaleDateString()}</strong></p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Reason or work description <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why does this member need temporary access?"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-800">
            Verification is always enforced. The member receives a Temporary Green-PIN they must verify before opening the feature, and when their work is done it comes back to you for approval and publishing — nothing goes live without your sign-off.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            disabled={submitting || !recipientId}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create delegation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ShareAside({ recipientName, recipientId, memberResults, featureName, actions, days }: {
  recipientName: string;
  recipientId: string;
  memberResults: Person[];
  featureName: string;
  actions: string[];
  days: number;
}) {
  const suggested = memberResults.find((member) => member.id === recipientId);
  const expiresDate = days > 0 ? new Date(Date.now() + days * 86400000) : null;
  const steps = [
    { title: "Share the feature", body: "Create the delegation — a one-time 8-digit Green-PIN is generated.", done: true },
    { title: "Member verifies PIN", body: `${recipientId ? `${suggested?.name ?? recipientName}` : "They"} verify the PIN to open the feature. Access is audited.`, done: Boolean(recipientId) },
    { title: "Work happens", body: "They work inside the feature under your scope and expiry limits.", done: false },
    { title: "Submit for approval", body: "They send a work summary back to you from “Shared With Me”.", done: false },
    { title: "You approve & publish", body: "Review in the Approval Inbox, then approve to publish — or request changes.", done: false },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Delegation preview</h3>
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600">Live</span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Avatar person={suggested ?? { name: recipientName || "Not selected yet", role: "" }} size="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{recipientId ? (suggested?.name ?? recipientName) : "Recipient not selected"}</p>
              <p className="truncate text-xs text-slate-500">{recipientId ? roleLabel(suggested?.role) : "Search and pick a member to preview"}</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Feature</p>
            <p className="mt-0.5 font-medium text-slate-700">{featureName || "Not selected yet"}</p>
            {actions.length > 0 ? <p className="mt-1 text-xs text-slate-400">{actions.join(" · ")}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Duration</p>
              <p className="mt-0.5 font-medium text-slate-700">{days ? `${days} days` : "—"}</p>
              {expiresDate ? <p className="mt-0.5 text-[11px] text-slate-400">until {expiresDate.toLocaleDateString()}</p> : null}
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">PIN</p>
              <p className="mt-0.5 font-mono font-medium text-slate-700">••••••••</p>
              <p className="mt-0.5 text-[11px] text-emerald-600">one-time reveal</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">How the approval loop works</h3>
        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-violet-50 text-violet-600"}`}>
                {step.done ? <Check size={13} /> : index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <h3 className="flex items-center gap-2 font-bold text-amber-900">Before you share</h3>
        <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-amber-800">
          <li className="flex gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Hand the Green-PIN over a private channel — it is shown once and stored encrypted.</li>
          <li className="flex gap-2"><Clock3 size={14} className="mt-0.5 shrink-0" /> Access self-expires; extend it only if the work genuinely needs more time.</li>
          <li className="flex gap-2"><Inbox size={14} className="mt-0.5 shrink-0" /> Submitted work appears in your Approval Inbox — approve to publish, or request changes with a note.</li>
        </ul>
      </div>
    </div>
  );
}

/* ── Approval inbox ───────────────────────────────────────────────────────── */

function ApprovalInbox({
  pending, decided, loading, onReview, onRefresh,
}: {
  pending: Delegation[];
  decided: Delegation[];
  loading: boolean;
  onReview: (row: Delegation, decision: "approved" | "changes-requested") => void;
  onRefresh: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Inbox size={18} className="text-violet-600" /> Approval Inbox</h2>
          <p className="mt-1 text-xs text-slate-500">Work your members completed in shared features. Approve to publish it, or request changes with a note.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={onRefresh}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : pending.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center text-center">
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 size={28} /></div>
              <h3 className="mt-4 font-bold">Inbox zero</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                No work is waiting for your approval right now. When a member finishes work in a shared feature, their summary lands here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((row) => (
              <article key={row.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <Avatar person={row.recipient} size="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{row.recipient?.name ?? "Member"}</p>
                      <p className="text-xs capitalize text-slate-500">{roleLabel(row.recipient?.role)} · {row.featureName}</p>
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Submitted {row.review?.submittedAt ? dateLabel(row.review.submittedAt) : "recently"} · access expires {dateLabel(row.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => onReview(row, "approved")}>
                      Approve &amp; publish
                    </button>
                    <button className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50" onClick={() => onReview(row, "changes-requested")}>
                      Request changes
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Work summary</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{row.review?.submitNote || "No note was provided."}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {decided.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-700">Recent decisions</h3>
            <ul className="mt-3 space-y-2">
              {decided.slice(0, 5).map((row) => {
                const approved = row.review?.status === "approved";
                return (
                  <li key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{row.recipient?.name ?? "Member"} · {row.featureName}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {row.review?.reviewedAt ? `Reviewed ${dateLabel(row.review.reviewedAt)}` : ""}
                        {row.review?.reviewNote ? ` — “${row.review.reviewNote.slice(0, 70)}${row.review.reviewNote.length > 70 ? "…" : ""}”` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${approved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                      {approved ? "Published" : "Changes requested"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ApprovalAside({ pending, rows }: { pending: Delegation[]; rows: Delegation[] }) {
  const approvedCount = rows.filter((row) => row.review?.status === "approved").length;
  const changesCount = rows.filter((row) => row.review?.status === "changes-requested").length;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">Review snapshot</h3>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Insight icon={<Clock3 />} value={pending.length} label="Awaiting you" tone="blue" />
          <Insight icon={<CheckCircle2 />} value={approvedCount} label="Published" tone="green" />
          <Insight icon={<RefreshCcw />} value={changesCount} label="Redoing" tone="rose" />
        </div>
      </div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
        <h3 className="font-bold text-violet-900">What happens on approval</h3>
        <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-violet-800">
          <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0" /> The member is notified that their work is approved and published.</li>
          <li className="flex gap-2"><History size={14} className="mt-0.5 shrink-0" /> Every review is written to the audit trail under “delegation.work_reviewed”.</li>
          <li className="flex gap-2"><RefreshCcw size={14} className="mt-0.5 shrink-0" /> “Request changes” keeps their PIN access active so they can redo and resubmit.</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">Tip</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Delegations expire on their own — if a member is mid-review when the access expires, extend it from My Delegations so they can still make the requested changes.
        </p>
      </div>
    </div>
  );
}

/* ── Right column for the delegations table ──────────────────────────────── */

function DelegationsAside({ rows, onShare, onApprovals, onHistory }: { rows: Delegation[]; onShare: () => void; onApprovals: () => void; onHistory: () => void }) {
  const submitted = rows.filter((row) => row.review?.status === "submitted").length;
  const approved = rows.filter((row) => row.review?.status === "approved").length;
  const changes = rows.filter((row) => row.review?.status === "changes-requested").length;
  return (
    <aside className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">Quick Actions</h3>
        <div className="mt-4 space-y-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white" onClick={onShare}>
            <Plus size={17} /> Share a Feature
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700" onClick={onApprovals}>
            <Check className="text-violet-600" size={18} /> Approval Inbox
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700" onClick={onHistory}>
            <History className="text-violet-600" size={18} /> Delegation Reports
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Work Review Insights</h3>
          <span className="text-xs text-slate-400">Current delegations</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Insight icon={<Clock3 />} value={submitted} label="Works Submitted" tone="blue" />
          <Insight icon={<CheckCircle2 />} value={approved} label="Approved · Published" tone="green" />
          <Insight icon={<RefreshCcw />} value={changes} label="Changes Requested" tone="rose" />
          <Insight icon={<Send />} value={rows.filter((row) => row.status === "active" && new Date(row.expiresAt) > new Date()).length} label="Access Active" tone="violet" />
        </div>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
        <h3 className="flex items-center gap-2 font-bold text-emerald-900"><ShieldCheck size={16} /> Safe by design</h3>
        <p className="mt-2 text-xs leading-relaxed text-emerald-800">
          Redirected members never change roles or permissions — they exercise only the actions inside this delegation, with PIN verification on entry and your approval on the way out.
        </p>
      </div>
    </aside>
  );
}

// The delegation tab state stays local inside FeatureDelegationWorkspace; the
// aside receives callbacks directly, so no cross-component events are needed.

/* ── Small shared pieces ─────────────────────────────────────────────────── */

function SideItem({ icon, label, active, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-white shadow-lg shadow-indigo-950/20" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
      {icon}
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
    </button>
  );
}
function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const colors: Record<string, string> = { green: "bg-emerald-100 text-emerald-600", blue: "bg-blue-100 text-blue-600", amber: "bg-amber-100 text-amber-600", rose: "bg-rose-100 text-rose-600" };
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid h-12 w-12 place-items-center rounded-xl ${colors[tone]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${active ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>;
}
function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    expired: "bg-slate-100 text-slate-500",
    revoked: "bg-rose-50 text-rose-600",
    "pending-approval": "bg-amber-50 text-amber-700",
    suspended: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${map[status] ?? map.expired}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{status.replaceAll("-", " ")}
    </span>
  );
}
function Insight({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  const colors: Record<string, string> = { blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600", green: "bg-emerald-100 text-emerald-600", rose: "bg-rose-100 text-rose-600" };
  return (
    <div>
      <div className={`mb-2 grid h-9 w-9 place-items-center rounded-full ${colors[tone]}`}>{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
function Empty({ view, onShare }: { view: string; onShare: () => void }) {
  return (
    <div className="grid min-h-[270px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-500"><ShieldCheck size={28} /></div>
        <h3 className="mt-4 font-bold">{view === "shared" ? "No shared features yet" : "No delegations yet"}</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          {view === "shared"
            ? "When a feature owner shares one with you, it appears here — verify the Green-PIN to open it."
            : "Create a temporary, narrowly scoped access delegation for a teammate. Completed work comes back to you for approval."}
        </p>
        {view !== "shared" ? <button onClick={onShare} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Share a Feature</button> : null}
      </div>
    </div>
  );
}
