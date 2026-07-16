import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, formatRole, formatRoleWithCustom, SectionHeader, ActionButton } from "../shared";
import { FinanceMembersView } from "../finance-members-tab";
import { HR_MEMBER_ROLE_KEYS } from "./types";
import { FireModal } from "./modals/fire-modal";
import { SalaryModal } from "./modals/salary-modal";
import { RoleModal } from "./modals/role-modal";
import { CustomRoleModal } from "./modals/custom-role-modal";
import { PfEsicModal, type PfEsicFormData } from "./modals/pf-esic-modal";
import { DocumentsModal } from "./modals/documents-modal";
import { MemberListModal } from "./modals/member-list-modal";
import { currencySymbol } from "./helpers";

export function MembersTab({
  insights,
  actorRole,
  showToast,
  refresh,
  regionOptions = [],
}: {
  insights: AnyRecord | null;
  actorRole: string;
  showToast: (text: string, type?: "success" | "error") => void;
  refresh: (silent?: boolean) => Promise<void>;
  regionOptions?: string[];
}) {
  const { data: session } = useSession();
  const selfId = session?.user?.id ?? "";
  const hr = (insights?.hr as AnyRecord | undefined) ?? null;
  const members = Array.isArray(hr?.members) ? (hr.members as AnyRecord[]) : [];
  const companyPfPct = Number(hr?.companyPfPct ?? 12);
  const companyEsicPct = Number(hr?.companyEsicPct ?? 0.75);
  const companyTdsPct = Number(hr?.companyTdsPct ?? 0);
  const roleCounts = (hr?.roleCounts as AnyRecord | undefined) ?? {};
  const [modalRole, setModalRole] = useState<string | null>(null);
  const [firingFor, setFiringFor] = useState<string | null>(null);
  const [fireConfirmMember, setFireConfirmMember] = useState<AnyRecord | null>(null);
  const [fireConfirmText, setFireConfirmText] = useState("");
  const [selectedOtherRole, setSelectedOtherRole] = useState("all");
  const [salaryModalMember, setSalaryModalMember] = useState<AnyRecord | null>(null);
  const [salaryInput, setSalaryInput] = useState("");
  const [salaryPeriodType, setSalaryPeriodType] = useState<"monthly" | "yearly">("monthly");
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

  function openSalaryModal(member: AnyRecord) {
    setSalaryInput(String(Math.max(0, Number(member.baseSalary ?? 0)) > 0 ? Number(member.baseSalary) : ""));
    setSalaryPeriodType("monthly");
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
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update region.", "error");
    } finally {
      setSavingRegion(false);
    }
  }

  async function saveSalaryModal() {
    const member = salaryModalMember;
    const memberId = String(member?.id ?? "");
    const rawSalary = Number(salaryInput);
    if (!memberId || !(rawSalary > 0)) {
      showToast("Enter a valid base salary.", "error");
      return;
    }
    const baseSalary = salaryPeriodType === "yearly" ? Math.round(rawSalary / 12) : rawSalary;
    try {
      setSavingSalaryModal(true);
      await apiFetch(`/api/hr/member-salary/${memberId}`, {
        method: "POST",
        body: JSON.stringify({ baseSalary, currency: salaryCurrency }),
      });
      showToast("Base salary saved.");
      setSalaryModalMember(null);
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save base salary.", "error");
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
      await refresh(true);
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
      await refresh(true);
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
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save PF/ESIC details.", "error");
    } finally {
      setSavingPfEsic(false);
    }
  }

  const otherRoleOptions = useMemo(() => {
    const labels = new Set<string>();
    members.filter((member) => String(member.role ?? "") === "others").forEach((member) => {
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
        String(m.regionLabel ?? ""),
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
      await refresh(true);
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title="Company Members" description="Manage roles, salaries, and memberships." accent="indigo" />
      <div className="mb-5 flex items-center gap-2">
        <div className="rounded-xl bg-slate-50 px-5 py-3 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total members</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">{Number(hr?.totalMembers ?? members.length)}</p>
        </div>
        {members.length > 0 ? (
          <button
            type="button"
            onClick={exportAllToExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 ring-1 ring-slate-100"
          >
            <Download size={15} />
            Export Excel
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {actorIsSeniorSecurity ? null : HR_MEMBER_ROLE_KEYS.map((roleName) => {
          const count = Number(roleCounts[roleName] ?? 0);
          return (
            <button className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
          <button className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            type="button"
            onClick={() => { setModalRole("senior-security"); setModalSearchQuery(""); setModalSearchInput(""); }}
          >
            <p className="text-xs font-medium text-slate-500">Senior Security</p>
            <p className="text-lg font-semibold">{members.filter((m) => String(m.role) === "security" && Boolean((m as any).isSeniorSecurity)).length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
          </button>
        )}
        {actorRole === "human-resource" || actorRole === "admin" ? null : (
          <button className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            type="button"
            onClick={() => { setModalRole("junior-security"); setModalSearchQuery(""); setModalSearchInput(""); }}
          >
            <p className="text-xs font-medium text-slate-500">Junior Security</p>
            <p className="text-lg font-semibold">{members.filter((m) => String(m.role) === "security" && !Boolean((m as any).isSeniorSecurity)).length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No approved company members yet.</p>
      ) : null}

      <MemberListModal
        modalRole={modalRole}
        members={members}
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
        onRefresh={refresh}
        regionOptions={regionOptions}
        onOpenRegionModal={openRegionModal}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Assign Region — {String(regionModalMember.name ?? "")}
            </h3>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
              value={regionLabelValue}
              onChange={(e) => setRegionLabelValue(e.target.value)}
            >
              <option value="">— None —</option>
              {regionOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
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
    </section>
  );
}
