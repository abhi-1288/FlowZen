import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord, formatRole, SectionHeader, ActionButton } from "../shared";
import { FinanceMembersView } from "../finance-members-tab";
import { HR_MEMBER_ROLE_KEYS, type MeetingDuration } from "./types";
import { FireModal } from "./modals/fire-modal";
import { SalaryModal } from "./modals/salary-modal";
import { RoleModal } from "./modals/role-modal";
import { CustomRoleModal } from "./modals/custom-role-modal";
import { PfEsicModal, type PfEsicFormData } from "./modals/pf-esic-modal";
import { TdsModal, type TdsFormData } from "./modals/tds-modal";
import { DocumentsModal } from "./modals/documents-modal";
import { MemberListModal } from "./modals/member-list-modal";

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
  const [modalRole, setModalRole] = useState<(typeof HR_MEMBER_ROLE_KEYS)[number] | null>(null);
  const [meetingDuration, setMeetingDuration] = useState<MeetingDuration>(30);
  const [invitingFor, setInvitingFor] = useState<string | null>(null);
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
  const [savingRoleModal, setSavingRoleModal] = useState(false);
  const [customRoleModalMember, setCustomRoleModalMember] = useState<AnyRecord | null>(null);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [savingCustomRoleModal, setSavingCustomRoleModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchInput, setModalSearchInput] = useState("");
  const [pfEsicModalMember, setPfEsicModalMember] = useState<AnyRecord | null>(null);
  const [pfEsicInput, setPfEsicInput] = useState<PfEsicFormData>({ pfNumber: "", pfDeductionAmount: "", esicNumber: "", esicDeductionAmount: "", pfExempted: false, esicExempted: false, tdsDeductionAmount: "", tdsExempted: false });
  const [savingPfEsic, setSavingPfEsic] = useState(false);
  const [tdsModalMember, setTdsModalMember] = useState<AnyRecord | null>(null);
  const [tdsInput, setTdsInput] = useState<TdsFormData>({ tdsDeductionAmount: "", tdsExempted: false });
  const [savingTds, setSavingTds] = useState(false);
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

  function openTdsModal(member: AnyRecord) {
    setTdsInput({
      tdsDeductionAmount: String(Number(member.tdsDeductionAmount ?? 0) > 0 ? Number(member.tdsDeductionAmount) : ""),
      tdsExempted: Boolean(member.tdsExempted ?? false),
    });
    setTdsModalMember(member);
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
        body: JSON.stringify({ memberId, role: newRoleValue }),
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

  async function saveTdsModal() {
    const member = tdsModalMember;
    const memberId = String(member?.id ?? "");
    if (!memberId) return;
    try {
      setSavingTds(true);
      await apiFetch(`/api/hr/member-tds/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({
          tdsDeductionAmount: tdsInput.tdsDeductionAmount ? Number(tdsInput.tdsDeductionAmount) : 0,
          tdsExempted: tdsInput.tdsExempted,
        }),
      });
      showToast("TDS details saved.");
      setTdsModalMember(null);
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save TDS details.", "error");
    } finally {
      setSavingTds(false);
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

  const canEditOthersRole = actorRole === "human-resource" || actorRole === "admin";

  async function sendMeetingInvite(memberId: string) {
    try {
      setInvitingFor(memberId);
      await apiFetch("/api/hr/meeting-invite", {
        method: "POST",
        body: JSON.stringify({ memberId, durationMinutes: meetingDuration }),
      });
      showToast("Meeting invite sent.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send invite.", "error");
    } finally {
      setInvitingFor(null);
    }
  }

  function requestFire(member: AnyRecord) {
    setFireConfirmText("");
    setFireConfirmMember(member);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <SectionHeader title="Company Members" description="Manage roles, salaries, and memberships." accent="indigo" />
      <div className="mb-5 flex items-center gap-2">
        <div className="rounded-xl bg-slate-50 px-5 py-3 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total members</p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900">{Number(hr?.totalMembers ?? members.length)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {HR_MEMBER_ROLE_KEYS.map((roleName) => {
          const count = Number(roleCounts[roleName] ?? 0);
          return (
            <button className="rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              key={roleName} type="button"
              onClick={() => { setModalRole(roleName); setMeetingDuration(30); setModalSearchQuery(""); setModalSearchInput(""); }}
            >
              <p className="text-xs font-medium text-slate-500">{formatRole(roleName)}</p>
              <p className="text-lg font-semibold">{count}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">View & invite</p>
            </button>
          );
        })}
      </div>

      {members.length === 0 ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No approved company members yet.</p>
      ) : null}

      <MemberListModal
        modalRole={modalRole}
        members={members}
        meetingDuration={meetingDuration}
        invitingFor={invitingFor}
        firingFor={firingFor}
        canEditOthersRole={canEditOthersRole}
        selfId={selfId}
        selectedOtherRole={selectedOtherRole}
        otherRoleOptions={otherRoleOptions}
        modalSearchInput={modalSearchInput}
        modalSearchQuery={modalSearchQuery}
        onClose={() => { setModalRole(null); setModalSearchQuery(""); setModalSearchInput(""); }}
        onMeetingDurationChange={setMeetingDuration}
        onSendMeetingInvite={sendMeetingInvite}
        onRequestFire={requestFire}
        onOpenSalaryModal={openSalaryModal}
        onOpenPfEsicModal={openPfEsicModal}
        onOpenTdsModal={openTdsModal}
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
        saving={savingRoleModal}
        onRoleChange={setNewRoleValue}
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

      <TdsModal
        member={tdsModalMember}
        data={tdsInput}
        saving={savingTds}
        companyTdsPct={companyTdsPct}
        onDataChange={setTdsInput}
        onCancel={() => setTdsModalMember(null)}
        onSave={saveTdsModal}
      />

      <DocumentsModal
        member={docModalMember}
        loading={loadingDocModal}
        data={docModalData}
        onClose={() => { setDocModalMember(null); setDocModalData(null); }}
      />

      {/* ── Region Modal ── */}
      {regionModalMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Assign Region — {String(regionModalMember.name ?? "")}
            </h3>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
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
