import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, useMotionValueEvent, useSpring } from "framer-motion";
import { Briefcase, Building2, ChevronDown, Download, Hash, MapPin, UserMinus, UserPlus, Users, type LucideIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/client-utils";
import { effectiveRegionLabelOf, withMainOfficeSuffix } from "@/lib/company-regions";
import { AnyRecord, formatRole, formatRoleWithCustom, SectionHeader, ActionButton } from "../shared";
import { FinanceMembersView } from "../finance-members-tab";
import { HR_MEMBER_ROLE_KEYS, memberRoleChipMeta } from "./types";
import { IdCodesModal, type IdCodesData } from "./id-codes-modal";
import { FireModal } from "./modals/fire-modal";
import { SalaryModal } from "./modals/salary-modal";
import { RoleModal } from "./modals/role-modal";
import { CustomRoleModal } from "./modals/custom-role-modal";
import { PfEsicModal, type PfEsicFormData } from "./modals/pf-esic-modal";
import { DocumentsModal } from "./modals/documents-modal";
import { MemberListModal } from "./modals/member-list-modal";
import { currencySymbol } from "./helpers";

/** The members page's own scoped payload, from `GET /api/hr/members`. */
interface MembersPayload {
  members: AnyRecord[];
  totalMembers: number;
  roleCounts: Record<string, number>;
  companyPfPct: number;
  companyEsicPct: number;
  companyTdsPct: number;
  joinedThisMonth: number;
  leftThisMonth: number;
  region: string;
  regionLabel: string;
  regionScope: "global" | "region";
  regionFallback: boolean;
  regionForced: boolean;
  canSwitchRegion: boolean;
  allowGlobalRegion: boolean;
  regionOptions: { value: string; label: string }[];
  allRegions: string[];
}


export function MembersTab({
  actorRole,
  company,
  showToast,
  refresh,
  regionOptions = [],
}: {
  actorRole: string;
  company: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: (silent?: boolean) => Promise<void>;
  /** Only a pre-load fallback; the endpoint returns the authoritative list. */
  regionOptions?: string[];
}) {
  const { data: session } = useSession();
  const selfId = session?.user?.id ?? "";

  // The members list is region-scoped, so it comes from its own endpoint rather
  // than from `insights.hr` — that payload is shared with the dashboard, policy
  // tab and team section, and narrowing it there would shrink all of them.
  const [region, setRegion] = useState("");
  const [payload, setPayload] = useState<MembersPayload | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);

  const members = useMemo(() => payload?.members ?? [], [payload]);
  const companyPfPct = Number(payload?.companyPfPct ?? 12);
  const companyEsicPct = Number(payload?.companyEsicPct ?? 0.75);
  const companyTdsPct = Number(payload?.companyTdsPct ?? 0);
  const roleCounts = useMemo(() => payload?.roleCounts ?? {}, [payload]);

  // The assign-region picker must offer every office, not just the ones this
  // viewer can switch between, or a head could never move a member into an
  // office they are not currently looking at.
  const allRegions = payload?.allRegions ?? regionOptions;
  const switchableRegions = payload?.regionOptions ?? [];

  const scopedToRegion = payload?.regionScope === "region";

  // Pure fetcher: no state writes, so both the effect below and the post-mutation
  // refresh can call it without one shadowing the other's loading handling.
  const fetchMembers = useCallback(async (target: string) => {
    const query = target ? `?region=${encodeURIComponent(target)}` : "";
    return apiFetch<MembersPayload>(`/api/hr/members${query}`, undefined, { toast: false });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMembers(region)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setMembersLoading(false);
      })
      .catch(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMembers, region]);

  const changeRegion = useCallback((next: string) => {
    setMembersLoading(true);
    setRegion(next);
  }, []);

  /**
   * Re-read the members list and the rest of the profile together.
   *
   * A write here can move a member between regions, which changes both this
   * list and the dashboard's headcount, so both are refreshed. `refresh` alone
   * would leave the list stale because it no longer reads `insights.hr`.
   */
  const afterMutation = useCallback(async () => {
    await Promise.all([refresh(true), fetchMembers(region).then(setPayload)]);
  }, [fetchMembers, refresh, region]);

  const [modalRole, setModalRole] = useState<string | null>(null);
  const [firingFor, setFiringFor] = useState<string | null>(null);
  const [fireConfirmMember, setFireConfirmMember] = useState<AnyRecord | null>(null);
  const [fireConfirmText, setFireConfirmText] = useState("");
  const [selectedOtherRole, setSelectedOtherRole] = useState("all");
  const [salaryModalMember, setSalaryModalMember] = useState<AnyRecord | null>(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [salaryPeriodType, setSalaryPeriodType] = useState<"monthly" | "yearly" | "hourly" | "daily">("monthly");
  const [salaryCurrency, setSalaryCurrency] = useState("INR");
  const [savingSalaryModal, setSavingSalaryModal] = useState(false);
  const [roleModalMember, setRoleModalMember] = useState<AnyRecord | null>(null);
  const [newRoleValue, setNewRoleValue] = useState("");
  const [isSeniorSecurityChecked, setIsSeniorSecurityChecked] = useState(false);
  const [savingRoleModal, setSavingRoleModal] = useState(false);
  const [customRoleModalMember, setCustomRoleModalMember] = useState<AnyRecord | null>(null);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [savingCustomRoleModal, setSavingCustomRoleModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchInput, setModalSearchInput] = useState("");
  const [pfEsicModalMember, setPfEsicModalMember] = useState<AnyRecord | null>(null);
  const [pfEsicInput, setPfEsicInput] = useState<PfEsicFormData>({ pfNumber: "", pfDeductionAmount: "", esicNumber: "", esicDeductionAmount: "", pfExempted: false, esicExempted: false, tdsDeductionAmount: "", tdsExempted: false });
  const [savingPfEsic, setSavingPfEsic] = useState(false);
  const [docModalMember, setDocModalMember] = useState<AnyRecord | null>(null);
  const [docModalData, setDocModalData] = useState<{
    member: { name: string; email: string; role: string };
    categories: { name: string; mandatory: boolean; fields: { label: string; type: string }[] }[];
    documents: { category: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; fieldValues: { label: string; value: string }[] }[];
  } | null>(null);
  const [loadingDocModal, setLoadingDocModal] = useState(false);

  /* ── Region Modal ── */
  const [regionModalMember, setRegionModalMember] = useState<AnyRecord | null>(null);
  const [regionLabelValue, setRegionLabelValue] = useState("");
  const [savingRegion, setSavingRegion] = useState(false);

  /* ── Employment Type Modal ── */
  const [employmentModalMember, setEmploymentModalMember] = useState<AnyRecord | null>(null);
  const [employmentTypeValue, setEmploymentTypeValue] = useState("");
  const [employmentEndDateValue, setEmploymentEndDateValue] = useState("");
  const [savingEmployment, setSavingEmployment] = useState(false);

  /* ── ID Numbers Modal ── */
  const canViewIdCodes = actorRole === "human-resource" || actorRole === "admin";
  const [showIdCodes, setShowIdCodes] = useState(false);
  const [idCodesLoading, setIdCodesLoading] = useState(false);
  const [idCodesData, setIdCodesData] = useState<IdCodesData | null>(null);

  async function openIdCodes() {
    setShowIdCodes(true);
    setIdCodesLoading(true);
    setIdCodesData(null);
    try {
      const data = await apiFetch<IdCodesData>("/api/hr/identity-codes");
      setIdCodesData(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to load ID numbers.", "error");
    } finally {
      setIdCodesLoading(false);
    }
  }

  function openSalaryModal(member: AnyRecord) {
    const st = String(member.salaryType ?? "per-month");
    const period: "monthly" | "yearly" | "hourly" | "daily" =
      st === "per-hour"
        ? "hourly"
        : st === "per-day"
          ? "daily"
          : st === "per-annum"
            ? "yearly"
            : "monthly";
    const current =
      period === "hourly"
        ? Math.max(0, Number(member.hourlyRate ?? 0))
        : period === "daily"
          ? Math.max(0, Number(member.dailyRate ?? 0))
          : period === "yearly"
            ? Math.max(0, Number(member.baseSalary ?? 0)) * 12
            : Math.max(0, Number(member.baseSalary ?? 0));
    setSalaryInput(current > 0 ? String(current) : "");
    setSalaryPeriodType(period);
    setSalaryCurrency(String(member.salaryCurrency ?? "INR"));
    setSalaryModalMember(member);
  }

  function openRoleModal(member: AnyRecord) {
    setNewRoleValue(String(member.role ?? ""));
    setIsSeniorSecurityChecked(Boolean((member as any).isSeniorSecurity ?? false));
    setRoleModalMember(member);
  }

  function openCustomRoleModal(member: AnyRecord) {
    setCustomRoleInput(String(member.customRole ?? ""));
    setCustomRoleModalMember(member);
  }

  function openPfEsicModal(member: AnyRecord) {
    setPfEsicInput({
      pfNumber: String(member.pfNumber ?? ""),
      pfDeductionAmount: String(Number(member.pfDeductionAmount ?? 0) > 0 ? Number(member.pfDeductionAmount) : companyPfPct),
      esicNumber: String(member.esicNumber ?? ""),
      esicDeductionAmount: String(Number(member.esicDeductionAmount ?? 0) > 0 ? Number(member.esicDeductionAmount) : companyEsicPct),
      pfExempted: Boolean(member.pfExempted ?? false),
      esicExempted: Boolean(member.esicExempted ?? false),
      tdsDeductionAmount: String(Number(member.tdsDeductionAmount ?? 0) > 0 ? Number(member.tdsDeductionAmount) : (companyTdsPct > 0 ? companyTdsPct : "")),
      tdsExempted: Boolean(member.tdsExempted ?? false),
    });
    setPfEsicModalMember(member);
  }

  async function openDocModal(member: AnyRecord) {
    const memberId = String(member.id ?? "");
    if (!memberId) return;
    try {
      setLoadingDocModal(true);
      setDocModalMember(member);
      const res = await apiFetch<{
        member: { name: string; email: string; role: string };
        categories: { name: string; mandatory: boolean; fields: { label: string; type: string }[] }[];
        documents: { category: string; fileName: string; fileUrl: string; fileType: string; fileSize: number; fieldValues: { label: string; value: string }[] }[];
      }>(`/api/hr/member-documents/${memberId}`);
      setDocModalData(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to load documents.", "error");
      setDocModalMember(null);
    } finally {
      setLoadingDocModal(false);
    }
  }

  function openRegionModal(member: AnyRecord) {
    setRegionModalMember(member);
    setRegionLabelValue(String(member.regionLabel ?? ""));
  }

  async function saveRegionModal() {
    const member = regionModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    try {
      setSavingRegion(true);
      await apiFetch(`/api/hr/member-region`, {
        method: "PATCH",
        body: JSON.stringify({ memberId, regionLabel: regionLabelValue }),
      });
      showToast("Region updated.");
      setRegionModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update region.", "error");
    } finally {
      setSavingRegion(false);
    }
  }

  function openEmploymentModal(member: AnyRecord) {
    setEmploymentTypeValue(String(member.employmentType ?? ""));
    setEmploymentEndDateValue(member.employmentEndDate ? String(member.employmentEndDate).slice(0, 10) : "");
    setEmploymentModalMember(member);
  }

  async function saveEmploymentModal() {
    const member = employmentModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    try {
      setSavingEmployment(true);
      await apiFetch(`/api/hr/member-employment/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          employmentType: employmentTypeValue,
          employmentEndDate: employmentEndDateValue || null,
        }),
      });
      showToast("Employment details updated.");
      setEmploymentModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update employment details.", "error");
    } finally {
      setSavingEmployment(false);
    }
  }

  async function saveSalaryModal() {
    const member = salaryModalMember;
    const memberId = String(member?.id ?? "");
    const rawSalary = Number(salaryInput);
    if (!memberId || !(rawSalary > 0)) {
      showToast("Enter a valid salary amount.", "error");
      return;
    }
    const salaryType =
      salaryPeriodType === "hourly"
        ? "per-hour"
        : salaryPeriodType === "daily"
          ? "per-day"
          : salaryPeriodType === "yearly"
            ? "per-annum"
            : "per-month";
    try {
      setSavingSalaryModal(true);
      await apiFetch(`/api/hr/member-salary/${memberId}`, {
        method: "POST",
        body: JSON.stringify({ amount: rawSalary, salaryType, currency: salaryCurrency }),
      });
      showToast("Salary saved.");
      setSalaryModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save salary.", "error");
    } finally {
      setSavingSalaryModal(false);
    }
  }

  async function saveRoleModal() {
    const member = roleModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId || !newRoleValue) return;
    try {
      setSavingRoleModal(true);
      await apiFetch("/api/hr/member-role", {
        method: "PATCH",
        body: JSON.stringify({
          memberId,
          role: newRoleValue,
          isSeniorSecurity: newRoleValue === "security" ? isSeniorSecurityChecked : false,
        }),
      });
      showToast("Role updated.");
      setRoleModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update role.", "error");
    } finally {
      setSavingRoleModal(false);
    }
  }

  async function saveCustomRoleModal() {
    const member = customRoleModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId || !String(customRoleInput ?? "").trim()) return;
    try {
      setSavingCustomRoleModal(true);
      await apiFetch("/api/hr/member-role", {
        method: "PATCH",
        body: JSON.stringify({ memberId, customRole: customRoleInput }),
      });
      showToast("Custom role label updated.");
      setCustomRoleModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update custom role.", "error");
    } finally {
      setSavingCustomRoleModal(false);
    }
  }

  async function savePfEsicModal() {
    const member = pfEsicModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    try {
      setSavingPfEsic(true);
      await apiFetch(`/api/hr/member-pf-esic/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          pfNumber: pfEsicInput.pfNumber,
          pfDeductionAmount: pfEsicInput.pfDeductionAmount ? Number(pfEsicInput.pfDeductionAmount) : 0,
          esicNumber: pfEsicInput.esicNumber,
          esicDeductionAmount: pfEsicInput.esicDeductionAmount ? Number(pfEsicInput.esicDeductionAmount) : 0,
          pfExempted: pfEsicInput.pfExempted,
          esicExempted: pfEsicInput.esicExempted,
          tdsDeductionAmount: pfEsicInput.tdsDeductionAmount ? Number(pfEsicInput.tdsDeductionAmount) : 0,
          tdsExempted: pfEsicInput.tdsExempted,
        }),
      });
      showToast("PF, ESIC & TDS details saved.");
      setPfEsicModalMember(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save PF/ESIC details.", "error");
    } finally {
      setSavingPfEsic(false);
    }
  }

  /**
   * Members grouped into one section per office.
   *
   * Ordered by the company's own `addresses[]` order, with unassigned members
   * last. A member with no `regionLabel` is reported honestly as "Unassigned"
   * rather than folded into the first office, which is what `/api/profile` does
   * — silently filing someone under an office they do not belong to would make
   * every per-office headcount here a quiet lie.
   */
  const otherRoleOptions = useMemo(() => {
    const labels = new Set<string>();
    members.forEach((member) => {
      const value = String(member.customRole ?? "").trim();
      if (value) labels.add(value);
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [members]);

  const otherRoleSelectOptions = useMemo(() => {
    const labels = new Set<string>(otherRoleOptions);
    ["Intern", "Trainee", "Junior Employee", "Employee", "Manager", "Tester", "Junior HR"].forEach((label) => labels.add(label));
    return Array.from(labels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [otherRoleOptions]);

  useEffect(() => {
    if (modalRole !== "others") {
      setSelectedOtherRole("all");
      return;
    }
    if (selectedOtherRole !== "all" && !otherRoleOptions.includes(selectedOtherRole)) {
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

  const actorIsSeniorSecurity = actorRole === "security" && Boolean((session?.user as any)?.isSeniorSecurity);
  const canEditOthersRole = actorRole === "human-resource" || actorRole === "admin" || actorIsSeniorSecurity;

  /**
   * One tile per member group the actor can open, in render order.
   *
   * The visual identity (icon + accent chip) comes from MEMBER_ROLE_META so
   * these tiles and the role chips inside the member modal never drift.
   */
  const roleTiles = useMemo(() => {
    const tiles: { key: string; title: string; count: number; hint: string; meta: { chip: string; icon: LucideIcon } }[] = [];
    if (actorIsSeniorSecurity) {
      // Senior security has no per-role tabs — they are scoped out of the role
      // grid above — so they get one unfiltered tab instead. Without it, hiding
      // the outer list would leave them with no way to reach any member at all,
      // which is a regression rather than a simplification.
      tiles.push({
        key: "all",
        title: "All members",
        count: members.length,
        hint: "View",
        meta: { chip: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300", icon: Users },
      });
      return tiles;
    }
    HR_MEMBER_ROLE_KEYS.forEach((roleName) => {
      tiles.push({
        key: roleName,
        title: formatRole(roleName),
        count: Number(roleCounts[roleName] ?? 0),
        hint: "View & invite",
        meta: memberRoleChipMeta(roleName),
      });
    });
    tiles.push({
      key: "senior-security",
      title: "Senior Security",
      count: members.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity)).length,
      hint: "View & invite",
      meta: memberRoleChipMeta("security", true),
    });
    if (actorRole !== "human-resource" && actorRole !== "admin") {
      tiles.push({
        key: "junior-security",
        title: "Junior Security",
        count: members.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity)).length,
        hint: "View & invite",
        meta: memberRoleChipMeta("security", false),
      });
    }
    return tiles;
  }, [actorRole, actorIsSeniorSecurity, members, roleCounts]);

  function requestFire(member: AnyRecord) {
    setFireConfirmText("");
    setFireConfirmMember(member);
  }

  function exportAllToExcel() {
    const fmtDate = (val: unknown): string => {
      if (!val) return "";
      try { return new Date(String(val)).toLocaleDateString("en-IN"); } catch { return String(val); }
    };
    const header = [
      "Name", "Email", "Role", "Unique Code", "Region/Office",
      "Team(s)", "Base Salary", "Joining Date", "Leaving Date",
      "Phone", "Date of Birth", "Address", "Emergency Contact", "Blood Group",
    ];
    const rows = members.map((m) => {
      const teams = Array.isArray(m.teams) ? m.teams.map(String).join(", ") : "";
      const salary = Number(m.baseSalary ?? 0);
      const cur = String(m.salaryCurrency ?? "INR");
      const salaryDisplay = salary > 0 ? `${currencySymbol(cur)} ${salary.toLocaleString("en-IN")}` : "";
      return [
        String(m.name ?? ""),
        String(m.email ?? ""),
        formatRoleWithCustom(String(m.role ?? "employee"), m.customRole, Boolean(m.isSeniorSecurity)),
        String(m.companyIdentityCode ?? ""),
        withMainOfficeSuffix(company, effectiveRegionLabelOf(company, m)),
        teams,
        salaryDisplay,
        fmtDate(m.companyJoined),
        fmtDate(m.leavingDate),
        String(m.phone ?? ""),
        fmtDate(m.dob),
        String(m.address ?? ""),
        String(m.emergencyContact ?? ""),
        String(m.bloodGroup ?? ""),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 20 },
      { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 14 },
      { wch: 15 }, { wch: 14 }, { wch: 35 }, { wch: 15 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `members-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Excel file exported.", "success");
  }

  async function confirmFire() {
    const member = fireConfirmMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    try {
      setFiringFor(memberId);
      await apiFetch("/api/hr/fire", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      showToast("Member removed.");
      setFireConfirmMember(null);
      setModalRole(null);
      await afterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove member.", "error");
    } finally {
      setFiringFor(null);
    }
  }

  if (actorRole === "finance") {
    return <FinanceMembersView members={members} showToast={showToast} />;
  }

  return (
    <section className="rounded-xl neu-card p-5">
      <SectionHeader
        title="Company Members"
        description="Manage roles, salaries, and memberships."
        accent="indigo"
        action={
          <div className="flex items-center gap-2">
            {members.length > 0 ? (
              <motion.button
                type="button"
                onClick={exportAllToExcel}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-1.5 rounded-lg neu-card px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] hover:text-slate-800 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download size={14} />
                Export Excel
              </motion.button>
            ) : null}
            {canViewIdCodes ? (
              <motion.button
                type="button"
                onClick={openIdCodes}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-1.5 rounded-lg neu-card px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] hover:text-slate-800 dark:border-zinc-800 dark:bg-[#000000] dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Hash size={14} />
                Show ID numbers
              </motion.button>
            ) : null}
          </div>
        }
      />
      {allRegions.length > 0 ? (
        <div className="mt-4 mb-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400" htmlFor="members-region-filter">
            <MapPin size={13} className="text-slate-400 dark:text-zinc-500" />
            Region
          </label>
          {payload?.canSwitchRegion && switchableRegions.length > 0 ? (
            <div className="relative">
              <select
                id="members-region-filter"
                className="appearance-none rounded-xl border border-[var(--c-border-light)] bg-[var(--c-bg-white dark:bg-zinc-900)] py-2 pl-3 pr-8 text-sm font-medium text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 dark:text-zinc-200 dark:focus:ring-indigo-600"
                // With no explicit pick the server resolves to the viewer's own
                // region; the owner resolves to the company-wide view, which is
                // why "All offices" is the "" option for them and absent here.
                value={region || (payload?.allowGlobalRegion ? "" : payload?.region)}
                onChange={(e) => changeRegion(e.target.value)}
                disabled={membersLoading}
              >
                {payload?.allowGlobalRegion ? <option value="">All offices</option> : null}
                {switchableRegions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={14} />
              {scopedToRegion ? (
                <span className="ml-2 text-xs text-slate-400 dark:text-zinc-500">
                  Showing {payload?.regionLabel}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300">
              <MapPin size={12} className="text-slate-400 dark:text-zinc-500" />
              {scopedToRegion ? payload?.regionLabel : "All offices"}
            </span>
          )}
        </div>
      ) : null}

      {payload?.regionFallback ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No members in {payload?.regionLabel}, so this list covers the whole company.
        </p>
      ) : null}

      {payload?.regionForced && scopedToRegion ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          This list is limited to {payload?.regionLabel}.
        </p>
      ) : null}

      {/* ── Animated stats band ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Users,
            tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
            // The scoped list length, not a company-wide total, so the number
            // matches what is actually listed below it.
            label: scopedToRegion ? "Members in region" : "Total members",
            value: members.length,
          },
          {
            icon: UserPlus,
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
            label: "Joined this month",
            value: Number(payload?.joinedThisMonth ?? 0),
          },
          {
            icon: UserMinus,
            tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
            label: "Left this month",
            value: Number(payload?.leftThisMonth ?? 0),
          },
          {
            icon: Building2,
            tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400",
            label: "Offices",
            value: allRegions.length,
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-2xl border border-[var(--c-border-light)] bg-[var(--c-bg-white dark:bg-zinc-900)] p-4"
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${stat.tone}`}>
              <stat.icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500 dark:text-zinc-400">{stat.label}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-zinc-100">
                {membersLoading && !payload ? "—" : <AnimatedNumber value={stat.value} />}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Role tiles ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {roleTiles.map((tile, index) => {
          const TileIcon = tile.meta.icon;
          return (
            <motion.button
              key={tile.key}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25, ease: "easeOut" }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setModalRole(tile.key); setModalSearchQuery(""); setModalSearchInput(""); }}
              className="group rounded-2xl border border-[var(--c-border-light)] bg-[var(--c-bg-white dark:bg-zinc-900)] p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tile.meta.chip}`}>
                  <TileIcon size={16} />
                </span>
                <span className="rounded-full bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                  {tile.count}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                {tile.title}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">{tile.hint}</p>
            </motion.button>
          );
        })}
      </div>

      {members.length === 0 && !membersLoading ? (
        <div className="mt-5 grid place-items-center rounded-2xl bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)] px-3 py-8 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--c-bg-white dark:bg-zinc-900)] text-slate-400 dark:text-zinc-500">
              <Users size={22} />
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
              {scopedToRegion
                ? `No members in ${payload?.regionLabel}.`
                : "No approved company members yet."}
            </p>
          </div>
        </div>
      ) : null}

      <MemberListModal
        modalRole={modalRole}
        members={members}
        company={company}
        firingFor={firingFor}
        canEditOthersRole={canEditOthersRole}
        selfId={selfId}
        selectedOtherRole={selectedOtherRole}
        otherRoleOptions={otherRoleOptions}
        modalSearchInput={modalSearchInput}
        modalSearchQuery={modalSearchQuery}
        onClose={() => { setModalRole(null); setModalSearchQuery(""); setModalSearchInput(""); }}
        onRequestFire={requestFire}
        onOpenSalaryModal={openSalaryModal}
        onOpenPfEsicModal={openPfEsicModal}
        onOpenDocModal={openDocModal}
        onOpenRoleModal={openRoleModal}
        onOpenCustomRoleModal={openCustomRoleModal}
        onSearchInputChange={(value) => { setModalSearchInput(value); setModalSearchQuery(value.trim()); }}
        onSearch={() => setModalSearchQuery(modalSearchInput.trim())}
        onSelectedOtherRoleChange={setSelectedOtherRole}
        showToast={showToast}
        onRefresh={afterMutation}
        regionOptions={allRegions}
        onOpenRegionModal={openRegionModal}
        onOpenEmploymentModal={openEmploymentModal}
      />

      <FireModal
        member={fireConfirmMember}
        fireConfirmText={fireConfirmText}
        firingFor={firingFor}
        onTextChange={setFireConfirmText}
        onCancel={() => setFireConfirmMember(null)}
        onConfirm={confirmFire}
      />

      <SalaryModal
        member={salaryModalMember}
        salaryInput={salaryInput}
        salaryPeriodType={salaryPeriodType}
        salaryCurrency={salaryCurrency}
        saving={savingSalaryModal}
        onInputChange={setSalaryInput}
        onPeriodChange={setSalaryPeriodType}
        onCurrencyChange={setSalaryCurrency}
        onCancel={() => setSalaryModalMember(null)}
        onSave={saveSalaryModal}
      />

      <RoleModal
        member={roleModalMember}
        newRoleValue={newRoleValue}
        isSeniorSecurityChecked={isSeniorSecurityChecked}
        saving={savingRoleModal}
        onRoleChange={(val) => { setNewRoleValue(val); if (val !== "security") setIsSeniorSecurityChecked(false); }}
        onIsSeniorSecurityChange={setIsSeniorSecurityChecked}
        onCancel={() => setRoleModalMember(null)}
        onSave={saveRoleModal}
      />

      <CustomRoleModal
        member={customRoleModalMember}
        customRoleInput={customRoleInput}
        otherRoleSelectOptions={otherRoleSelectOptions}
        saving={savingCustomRoleModal}
        onInputChange={setCustomRoleInput}
        onCancel={() => setCustomRoleModalMember(null)}
        onSave={saveCustomRoleModal}
      />

      <PfEsicModal
        member={pfEsicModalMember}
        data={pfEsicInput}
        saving={savingPfEsic}
        companyPfPct={companyPfPct}
        companyEsicPct={companyEsicPct}
        companyTdsPct={companyTdsPct}
        onDataChange={setPfEsicInput}
        onCancel={() => setPfEsicModalMember(null)}
        onSave={savePfEsicModal}
      />

      <DocumentsModal
        member={docModalMember}
        loading={loadingDocModal}
        data={docModalData}
        onClose={() => { setDocModalMember(null); setDocModalData(null); }}
      />

      {/* ── Region Modal ── */}
      {regionModalMember ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-[var(--c-bg-white dark:bg-zinc-900)] p-5 shadow-xl"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                <MapPin size={15} />
              </span>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                Assign Region — {String(regionModalMember.name ?? "")}
              </h3>
            </div>
            <select
              className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
              value={regionLabelValue}
              onChange={(e) => setRegionLabelValue(e.target.value)}
            >
              <option value="">— None —</option>
              {allRegions.map((opt) => (
                <option key={opt} value={opt}>{withMainOfficeSuffix(company, opt)}</option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)]"
                onClick={() => setRegionModalMember(null)}
              >
                Cancel
              </button>
              <ActionButton
                variant="primary"
                className="px-4"
                disabled={savingRegion}
                onClick={saveRegionModal}
              >
                {savingRegion ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {/* ── Employment Type Modal ── */}
      {employmentModalMember ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-[var(--c-bg-white dark:bg-zinc-900)] p-5 shadow-xl"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                <Briefcase size={15} />
              </span>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                Employment Type — {String(employmentModalMember.name ?? "")}
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Employment Type</label>
                <select
                  className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                  value={employmentTypeValue}
                  onChange={(e) => setEmploymentTypeValue(e.target.value)}
                >
                  <option value="">— Not specified —</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Employment End Date <span className="text-slate-400 text-italic">(Optional)</span> </label>
                <input
                  type="date"
                  className="neu-inset w-full rounded-md px-3 py-1.5 text-xs"
                  value={employmentEndDateValue}
                  onChange={(e) => setEmploymentEndDateValue(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-[var(--c-bg-slate-50 dark:bg-zinc-800/60)]"
                onClick={() => setEmploymentModalMember(null)}
              >
                Cancel
              </button>
              <ActionButton
                variant="primary"
                className="px-4"
                disabled={savingEmployment}
                onClick={saveEmploymentModal}
              >
                {savingEmployment ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      <IdCodesModal
        open={showIdCodes}
        onClose={() => { setShowIdCodes(false); setIdCodesData(null); }}
        loading={idCodesLoading}
        data={idCodesData}
      />
    </section>
  );
}

/**
 * Count-up number for the stats band.
 *
 * Springs to the latest value whenever it changes (region switch, mutation
 * refresh), so the numbers visibly roll instead of snapping.
 */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const spring = useSpring(0, { stiffness: 70, damping: 18 });
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  useMotionValueEvent(spring, "change", (latest) => setDisplay(Math.round(Number(latest))));
  return <>{display.toLocaleString("en-IN")}</>;
}
