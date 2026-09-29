import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, Hash } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/client-utils";
import { withMainOfficeSuffix } from "@/lib/company-regions";
import { AnyRecord, formatRole, formatRoleWithCustom, SectionHeader, ActionButton } from "../shared";
import { FinanceMembersView } from "../finance-members-tab";
import { HR_MEMBER_ROLE_KEYS } from "./types";
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
        withMainOfficeSuffix(company, String(m.regionLabel ?? "")),
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
      <SectionHeader title="Company Members" description="Manage roles, salaries, and memberships." accent="indigo" />
      {allRegions.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="members-region-filter">Region</label>
          {payload?.canSwitchRegion && switchableRegions.length > 0 ? (
            <>
              <select
                id="members-region-filter"
                className="rounded-lg border border-[var(--c-border-light)] px-3 py-1.5 text-sm"
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
              {scopedToRegion ? (
                <span className="text-xs text-slate-400">
                  Showing {payload?.regionLabel}
                </span>
              ) : null}
            </>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
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
      <div className="mb-5 flex items-center gap-2">
        <div className="rounded-xl bg-[var(--c-bg-muted)] px-5 py-3 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {scopedToRegion ? "Members in region" : "Total members"}
          </p>
          {/* The scoped list length, not a company-wide total, so the number
              matches what is actually listed below it. */}
          <p className="mt-0.5 text-2xl font-bold text-slate-900">
            {membersLoading && !payload ? "—" : members.length}
          </p>
        </div>
        {members.length > 0 ? (
          <button
            type="button"
            onClick={exportAllToExcel}
            className="inline-flex items-center gap-1.5 rounded-xl neu-card px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] hover:text-slate-800 ring-1 ring-slate-100"
          >
            <Download size={15} />
            Export Excel
          </button>
        ) : null}
        {canViewIdCodes ? (
          <button
            type="button"
            onClick={openIdCodes}
            className="inline-flex items-center gap-1.5 rounded-xl neu-card px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-[var(--c-bg-muted)] hover:text-slate-800 ring-1 ring-slate-100"
          >
            <Hash size={15} />
            Show ID numbers
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {/* Senior security has no per-role tabs — they are scoped out of the role
            grid above — so they get one unfiltered tab instead. Without it, hiding
            the outer list would leave them with no way to reach any member at all,
            which is a regression rather than a simplification. */}
        {actorIsSeniorSecurity ? (
          <button className="rounded-lg border border-transparent bg-[var(--c-bg-muted)] px-3 py-2 text-left transition hover:border-[var(--c-border-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            type="button"
            onClick={() => { setModalRole("all"); setModalSearchQuery(""); setModalSearchInput(""); }}
          >
            <p className="text-xs font-medium text-slate-500">All members</p>
            <p className="text-lg font-semibold">{members.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">View</p>
          </button>
        ) : null}
        {actorIsSeniorSecurity ? null : HR_MEMBER_ROLE_KEYS.map((roleName) => {
          const count = Number(roleCounts[roleName] ?? 0);
          return (
            <button className="rounded-lg border border-transparent bg-[var(--c-bg-muted)] px-3 py-2 text-left transition hover:border-[var(--c-border-light)] hover:bg-[var(--c-bg-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              key={roleName} type="button"
              onClick={() => { setModalRole(roleName); setModalSearchQuery(""); setModalSearchInput(""); }}
            >
              <p className="text-xs font-medium text-slate-500">{formatRole(roleName)}</p>
              <p className="text-lg font-semibold">{count}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
            </button>
          );
        })}
        {actorIsSeniorSecurity ? null : (
          <button className="rounded-lg border border-transparent bg-[var(--c-bg-muted)] px-3 py-2 text-left transition hover:border-[var(--c-border-light)] hover:bg-[var(--c-bg-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            type="button"
            onClick={() => { setModalRole("senior-security"); setModalSearchQuery(""); setModalSearchInput(""); }}
          >
            <p className="text-xs font-medium text-slate-500">Senior Security</p>
            <p className="text-lg font-semibold">{members.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity)).length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
          </button>
        )}
        {actorRole === "human-resource" || actorRole === "admin" ? null : (
          <button className="rounded-lg border border-transparent bg-[var(--c-bg-muted)] px-3 py-2 text-left transition hover:border-[var(--c-border-light)] hover:bg-[var(--c-bg-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            type="button"
            onClick={() => { setModalRole("junior-security"); setModalSearchQuery(""); setModalSearchInput(""); }}
          >
            <p className="text-xs font-medium text-slate-500">Junior Security</p>
            <p className="text-lg font-semibold">{members.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity)).length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
          </button>
        )}
      </div>

      {members.length === 0 && !membersLoading ? (
        <p className="mt-5 rounded-lg bg-[var(--c-bg-muted)] px-3 py-6 text-center text-sm text-slate-500">
          {scopedToRegion
            ? `No members in ${payload?.regionLabel}.`
            : "No approved company members yet."}
        </p>
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
        onSearchInputChange={setModalSearchInput}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3">
          <div className="w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Assign Region — {String(regionModalMember.name ?? "")}
            </h3>
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
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-[var(--c-bg-muted)]"
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
          </div>
        </div>
      ) : null}

      {/* ── Employment Type Modal ── */}
      {employmentModalMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center neu-overlay px-3">
          <div className="w-full max-w-sm rounded-xl bg-[var(--c-bg-card)] p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Employment Type — {String(employmentModalMember.name ?? "")}
            </h3>
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
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-[var(--c-bg-muted)]"
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
          </div>
        </div>
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
