import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown, Plus, ShieldCheck, Users } from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { CodePanel, JoinPanel } from "./admin-tabs";
import { AnyRecord, ActionButton, formatRole, HistoryCard, toAdminHistoryRows, toEmployeeHistoryRows, toManagerHistoryRows } from "./shared";
import { ImageCropModal } from "./image-crop-modal";
import {
  HrQuitModal, RoleQuitModal, CancelQuitModal, CancelJoinModal,
  TeamEmployeesModal, KickModal, DeleteTeamModal, CompanyIconSection, DeleteConfirmModal,
} from "./onboarding-modals";

export function OnboardingTab({
  profile,
  insights,
  role,
  refresh,
  showToast,
}: {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  role: string;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const selfId = String(session?.user?.id ?? "");
  const isSeniorSecurity = role === "security" && Boolean((session?.user as any)?.isSeniorSecurity);
  const hrSuffix = selfId
    ? `-HR${selfId.replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(-6)}`
    : "";
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamModal, setTeamModal] = useState<AnyRecord | null>(null);
  const [kickModal, setKickModal] = useState<{ teamId: string; employeeId: string; employeeName: string; teamName: string } | null>(null);
  const [kickConfirmText, setKickConfirmText] = useState("");
  const [deleteTeamModal, setDeleteTeamModal] = useState<{ teamId: string; teamName: string } | null>(null);
  const [deleteTeamConfirmText, setDeleteTeamConfirmText] = useState("");
  const company = typeof profile?.company === "object" && profile.company ? (profile.company as AnyRecord) : null;
  const team = typeof profile?.team === "object" && profile.team ? (profile.team as AnyRecord) : null;
  const managerInsight = (insights?.manager as AnyRecord | undefined) ?? null;
  const managerTeams = Array.isArray(managerInsight?.teams) ? (managerInsight.teams as AnyRecord[]) : [];
  const adminTeams = Array.isArray((insights?.admin as AnyRecord | undefined)?.teams) ? ((insights?.admin as AnyRecord).teams as AnyRecord[]) : [];
  const transferTeams = role === "admin" ? adminTeams : managerTeams;
  const companyMembers = Array.isArray(insights?.companyMembers) ? (insights.companyMembers as AnyRecord[]) : [];
  const replacementHrCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return id && id !== selfId && String(member.role ?? "") === "human-resource";
  });
  const replacementRoleCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return id && id !== selfId && String(member.role ?? "") === String(role);
  });
  const pendingQuitNotice = (insights?.pendingQuitNotice as AnyRecord | undefined) ?? null;
  const [hrQuitModal, setHrQuitModal] = useState(false);
  const [replacementHrId, setReplacementHrId] = useState("");
  const [roleQuitModal, setRoleQuitModal] = useState(false);
  const [replacementRoleUserId, setReplacementRoleUserId] = useState("");
  const [requestingHrQuit, setRequestingHrQuit] = useState(false);
  const [requestingRoleQuit, setRequestingRoleQuit] = useState(false);
  const [teamTransferTeamIds, setTeamTransferTeamIds] = useState<string[]>([]);
  const [teamTransferReplacementId, setTeamTransferReplacementId] = useState("");
  const [teamTransferSubmitting, setTeamTransferSubmitting] = useState(false);
  const [teamTransferOpen, setTeamTransferOpen] = useState(false);
  const [cancelQuitModal, setCancelQuitModal] = useState(false);
  const [cancelQuitReason, setCancelQuitReason] = useState("");
  const [cancellingQuit, setCancellingQuit] = useState(false);
  const [cancelJoinModal, setCancelJoinModal] = useState(false);
  const [cancelJoinConfirmText, setCancelJoinConfirmText] = useState("");
  const [cancellingJoin, setCancellingJoin] = useState(false);
  const [companyIconUploading, setCompanyIconUploading] = useState(false);
  const [companyIconDeleteModal, setCompanyIconDeleteModal] = useState(false);
  const [deletingCompanyIcon, setDeletingCompanyIcon] = useState(false);
  const [companyIconCropFile, setCompanyIconCropFile] = useState<File | null>(null);
  const [companyAddress, setCompanyAddress] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    if (company?.address) setCompanyAddress(String(company.address));
  }, [company?.address]);
  const createdTeamsCount = Number(managerInsight?.createdTeamsCount ?? managerTeams.length);
  const teamLimit = role === "human-resource" ? 2 : role === "admin" ? 10 : 5;
  const canCreateMoreTeams = createdTeamsCount < teamLimit;
  const companyJoinStatus = profile?.companyStatus ? String(profile.companyStatus) : "none";
  const teamJoinStatus = profile?.teamStatus ? String(profile.teamStatus) : "none";
  const pendingJoinStatus = companyJoinStatus === "pending" || teamJoinStatus === "pending" ? "pending" : teamJoinStatus !== "none" ? teamJoinStatus : companyJoinStatus;

  async function createCompany(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/company", { method: "POST", body: JSON.stringify({ name: companyName }) });
    showToast("Company registered.");
    await refresh();
  }

  async function joinCompany(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/company/join", { method: "POST", body: JSON.stringify({ code: companyCode }) });
      showToast("Join request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send join request.", "error");
    }
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMoreTeams) {
      showToast(`Team limit reached. ${role === "human-resource" ? "HR" : role === "admin" ? "Admins" : "Managers"} can create up to ${teamLimit} teams.`, "error");
      return;
    }
    await apiFetch("/api/team", { method: "POST", body: JSON.stringify({ name: teamName }) });
    setTeamName("");
    showToast("Team created.");
    await refresh();
  }

  async function uploadCompanyIcon(blob: Blob) {
    const data = new FormData();
    data.append("icon", blob, "icon.png");
    setCompanyIconUploading(true);
    try {
      const response = await fetch("/api/company/icon", { method: "POST", body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to upload icon.");
      showToast("Company icon updated.", "success");
      setCompanyIconCropFile(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to upload icon.", "error");
    } finally {
      setCompanyIconUploading(false);
    }
  }

  async function deleteCompanyIcon() {
    try {
      setDeletingCompanyIcon(true);
      const response = await fetch("/api/company/icon", { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to delete company icon.");
      showToast("Company icon deleted.");
      setCompanyIconDeleteModal(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to delete company icon.", "error");
    } finally {
      setDeletingCompanyIcon(false);
    }
  }

  async function saveCompanyAddress() {
    try {
      setAddressSaving(true);
      await apiFetch("/api/company/address", {
        method: "PATCH",
        body: JSON.stringify({ address: companyAddress }),
      });
      showToast("Company address updated.");
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to save address.", "error");
    } finally {
      setAddressSaving(false);
    }
  }

  async function requestManagerQuit() {
    await apiFetch("/api/company/quit", { method: "POST" });
    showToast("Quit request sent.");
    await refresh();
  }

  async function requestHrQuit() {
    if (!replacementHrId) { showToast("Please select a replacement HR.", "error"); return; }
    try {
      setRequestingHrQuit(true);
      await apiFetch("/api/company/quit", { method: "POST", body: JSON.stringify({ replacementHrId }) });
      setHrQuitModal(false);
      setReplacementHrId("");
      showToast("HR quit request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request quit.", "error");
    } finally {
      setRequestingHrQuit(false);
    }
  }

  async function requestRoleQuit() {
    if (!replacementRoleUserId) { showToast("Please select a replacement first.", "error"); return; }
    try {
      setRequestingRoleQuit(true);
      await apiFetch("/api/company/quit", { method: "POST", body: JSON.stringify({ replacementUserId: replacementRoleUserId }) });
      setRoleQuitModal(false);
      setReplacementRoleUserId("");
      showToast("Quit request sent to HR.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request quit.", "error");
    } finally {
      setRequestingRoleQuit(false);
    }
  }

  async function requestTeamTransfer() {
    if (!teamTransferReplacementId) { showToast("Please select a replacement first.", "error"); return; }
    if (teamTransferTeamIds.length === 0) { showToast("Please select at least one team to transfer.", "error"); return; }
    try {
      setTeamTransferSubmitting(true);
      await apiFetch("/api/company/role-transfer", { method: "POST", body: JSON.stringify({ replacementUserId: teamTransferReplacementId, teamIds: teamTransferTeamIds }) });
      setTeamTransferTeamIds([]);
      setTeamTransferReplacementId("");
      showToast("Team transfer request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request team transfer.", "error");
    } finally {
      setTeamTransferSubmitting(false);
    }
  }

  function pendingQuitText(defaultText: string): string {
    if (!insights?.pendingQuit) return defaultText;
    const remaining = Number(pendingQuitNotice?.remainingDays ?? 0);
    return `Requested to Quit${remaining > 0 ? ` (${remaining} day${remaining === 1 ? "" : "s"} left)` : " (notice completed)"}`;
  }

  async function cancelQuitRequest() {
    const reason = String(cancelQuitReason ?? "").trim();
    if (!reason) { showToast("Reason is required.", "error"); return; }
    try {
      setCancellingQuit(true);
      await apiFetch("/api/quit/cancel", { method: "POST", body: JSON.stringify({ reason }) });
      setCancelQuitModal(false);
      setCancelQuitReason("");
      showToast("Quit request cancelled.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to cancel request.", "error");
    } finally {
      setCancellingQuit(false);
    }
  }

  async function cancelJoinRequest() {
    if (String(cancelJoinConfirmText ?? "").trim().toUpperCase() !== "CANCEL") { showToast("Type CANCEL to confirm.", "error"); return; }
    try {
      setCancellingJoin(true);
      await apiFetch("/api/join/cancel", { method: "POST" });
      setCancelJoinModal(false);
      setCancelJoinConfirmText("");
      showToast("Join request cancelled.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to cancel request.", "error");
    } finally {
      setCancellingJoin(false);
    }
  }

  async function requestEmployeeQuit() {
    await apiFetch("/api/team/quit", { method: "POST" });
    showToast("Quit request sent to manager.");
    await refresh();
  }

  async function kickEmployee(teamId: string, employeeId: string) {
    await apiFetch("/api/team/kick", { method: "POST", body: JSON.stringify({ teamId, employeeId }) });
    showToast("Employee removed from team.");
    setKickModal(null);
    setKickConfirmText("");
    await refresh();
  }

  async function deleteTeamFn(teamId: string) {
    await apiFetch("/api/team/delete", { method: "POST", body: JSON.stringify({ teamId }) });
    setDeleteTeamModal(null);
    setDeleteTeamConfirmText("");
    setTeamModal(null);
    showToast("Team deleted.");
    await refresh();
  }

  async function joinTeam(event: FormEvent) {
    event.preventDefault();
    try {
      const normalizedCode = String(teamCode ?? "").trim().toUpperCase();
      if (!normalizedCode) { showToast("Enter a join code first.", "error"); return; }
      if (normalizedCode.startsWith("CO-") || normalizedCode.startsWith("SC-")) {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "admin" | "security" }>("/api/company/join", { method: "POST", body: JSON.stringify({ code: normalizedCode }) });
        const msg = data.approvalNotifier === "security" ? "Join request sent to senior security." : data.approvalNotifier === "hr" ? "Join request sent to HR." : "Join request sent to admin.";
        showToast(msg);
      } else if (normalizedCode.startsWith("TM-")) {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "manager" | "tester" }>("/api/team/join", { method: "POST", body: JSON.stringify({ code: normalizedCode }) });
        showToast(data.approvalNotifier === "hr" ? "Join request sent to HR." : data.approvalNotifier === "tester" ? "Join request sent to tester." : "Join request sent to manager.");
      } else { showToast("Invalid join code. Use a CO-, SC-, or TM- code.", "error"); return; }
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send join request.", "error");
    }
  }

  const sectionBase = "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {role === "admin" && company?.status !== "taken-down" ? (
        profile?.companyStatus === "approved" ? (
          <>
            <CodePanel title="Onboarding" code={company?.adminJoinCode ? String(company.adminJoinCode) : undefined} label="Admin code" empty="Register a company to generate onboarding codes." showToast={showToast}
              secondaryCodes={company?.joinCode ? [{ code: String(company.joinCode), label: "HR code" }] : []}
            />
            <CompanyIconSection company={company} uploading={companyIconUploading} onUpload={() => {}} onDelete={() => setCompanyIconDeleteModal(true)}
              onCropDone={(blob) => { const file = new File([blob], "icon.png"); setCompanyIconCropFile(file); return Promise.resolve(); }} onCropCancel={() => setCompanyIconCropFile(null)} cropFile={companyIconCropFile}
              address={companyAddress} onAddressChange={setCompanyAddress} onAddressSave={saveCompanyAddress} addressSaving={addressSaving}
            />
          </>
        ) : (
          <>
            {company ? null : (
              <CodePanel title="Create a company" code={undefined} label="HR code" empty="Register a company to generate onboarding codes." showToast={showToast}>
                <form className="mt-4 flex gap-2" onSubmit={createCompany}>
                  <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5" placeholder="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                  <ActionButton variant="primary">Register</ActionButton>
                </form>
              </CodePanel>
            )}
            <JoinPanel title="Join company as Admin" placeholder="Admin company code" value={companyCode} onChange={setCompanyCode} onSubmit={joinCompany}
              status={String(profile?.companyStatus ?? "none")} onCancelRequest={async () => { await apiFetch("/api/join/cancel", { method: "POST" }); await refresh(); }} />
          </>
        )
      ) : null}

      {role === "human-resource" && company?.status !== "taken-down" ? (
        profile?.companyStatus === "approved" ? (
          <>
            <CodePanel title="HR Staff Onboarding" code={undefined} label="Staff code" showToast={showToast}
              secondaryCodes={[
                company?.managerJoinCode ? { code: `${String(company.managerJoinCode)}${hrSuffix}`, label: "Manager code" } : null,
                company?.testerJoinCode ? { code: `${String(company.testerJoinCode)}${hrSuffix}`, label: "Tester code" } : null,
                company?.financeJoinCode ? { code: `${String(company.financeJoinCode)}${hrSuffix}`, label: "Finance code" } : null,
                company?.employeeJoinCode ? { code: `${String(company.employeeJoinCode)}${hrSuffix}`, label: "Employee code" } : null,
                company?.securityJoinCode ? { code: `${String(company.securityJoinCode)}${hrSuffix}`, label: "Senior Security code" } : null,
                company?.otherJoinCode ? { code: `${String(company.otherJoinCode)}${hrSuffix}`, label: "Others code" } : null,
              ].filter(Boolean) as { code: string; label: string }[]}
              empty="Generating HR staff onboarding codes. Refresh once if they do not appear."
            />
            <section className={sectionBase}>
              <div className="mb-5 border-l-4 border-teal-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">HR Membership</h3>
                <p className="mt-0.5 text-sm text-slate-500">To quit, nominate another approved HR. Approval goes to admin.</p>
              </div>
              <button className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(insights?.pendingQuit) || replacementHrCandidates.length === 0} type="button" onClick={() => setHrQuitModal(true)}>
                {pendingQuitText("Request Quit Company")}
              </button>
              {insights?.pendingQuit ? <button className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" type="button" onClick={() => setCancelQuitModal(true)}>Cancel Request</button> : null}
              {replacementHrCandidates.length === 0 ? <p className="mt-2 text-xs text-amber-700">Another approved HR is required before you can quit.</p> : null}
            </section>
          </>
        ) : (
          <JoinPanel title="Join company as HR" placeholder="HR company code" value={companyCode} onChange={setCompanyCode} onSubmit={joinCompany}
            status={profile?.companyStatus ? String(profile.companyStatus) : undefined} onCancelRequest={() => setCancelJoinModal(true)} />
        )
      ) : null}

      {role === "security" && company?.status !== "taken-down" ? (
        profile?.companyStatus === "approved" ? (
          <>
            {isSeniorSecurity ? (
              <CodePanel title="Security Onboarding" code={company?.juniorSecurityJoinCode ? String(company.juniorSecurityJoinCode) : undefined} label="Junior Security code" empty="Refresh once the code appears." showToast={showToast} />
            ) : (
              <CodePanel title="Security" code={undefined} label="Security code" empty="Ask a senior security member for a join code." showToast={showToast} />
            )}
            <section className={sectionBase}>
              <div className="mb-5 border-l-4 border-amber-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Security Membership</h3>
                <p className="mt-0.5 text-sm text-slate-500">{isSeniorSecurity ? "You are a senior security member." : "You are a junior security member."}</p>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Company</span><span className="font-medium">{company?.name ? String(company.name) : "Not assigned"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Role</span><span className="font-medium capitalize">{isSeniorSecurity ? "Senior Security" : "Junior Security"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Status</span><span className="font-medium capitalize text-emerald-600">{String(profile?.companyStatus)}</span></div>
                  {insights?.joinedBy ? (
                    <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Joined by</span><span className="font-medium capitalize">{String((insights.joinedBy as any).name ?? "")} <span className="text-xs text-slate-400">({String((insights.joinedBy as any).role ?? "")})</span></span></div>
                  ) : null}
                </div>
                <button className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)} onClick={requestManagerQuit}>
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setCancelQuitModal(true)} type="button">Cancel Request</button> : null}
              </div>
            </section>
          </>
        ) : (
          <JoinPanel title="Join company as Security" placeholder="Security code" value={companyCode} onChange={setCompanyCode} onSubmit={joinCompany}
            status={profile?.companyStatus ? String(profile.companyStatus) : undefined} onCancelRequest={() => setCancelJoinModal(true)} />
        )
      ) : null}

      <HrQuitModal open={hrQuitModal} candidates={replacementHrCandidates} selectedHrId={replacementHrId} onSelectHr={setReplacementHrId} loading={requestingHrQuit}
        onClose={() => setHrQuitModal(false)} onConfirm={requestHrQuit} />
      <RoleQuitModal open={roleQuitModal} role={role} isSeniorSecurity={isSeniorSecurity} candidates={replacementRoleCandidates} selectedUserId={replacementRoleUserId} onSelectUser={setReplacementRoleUserId}
        loading={requestingRoleQuit} onClose={() => setRoleQuitModal(false)} onConfirm={requestRoleQuit} />
      <CancelQuitModal open={cancelQuitModal} reason={cancelQuitReason} onReasonChange={setCancelQuitReason} loading={cancellingQuit}
        onClose={() => setCancelQuitModal(false)} onConfirm={cancelQuitRequest} />
      <DeleteConfirmModal open={companyIconDeleteModal} title="Delete company icon?" description="This will permanently remove your current company icon. You can upload a new one afterwards."
        loading={deletingCompanyIcon} onClose={() => setCompanyIconDeleteModal(false)} onConfirm={deleteCompanyIcon} />
      {companyIconCropFile ? <ImageCropModal file={companyIconCropFile} aspect={1} onCancel={() => setCompanyIconCropFile(null)} onDone={(blob) => void uploadCompanyIcon(blob)} /> : null}
      <CancelJoinModal open={cancelJoinModal} confirmText={cancelJoinConfirmText} onTextChange={setCancelJoinConfirmText} loading={cancellingJoin}
        onClose={() => setCancelJoinModal(false)} onConfirm={cancelJoinRequest} />

      {["project-manager", "qa-tester", "human-resource", "finance", "admin"].includes(role) ? (
        profile?.companyStatus === "approved" ? (
          <>
            <section className={sectionBase}>
              <div className="mb-5 border-l-4 border-indigo-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">{role === "human-resource" ? "HR Team Management" : role === "admin" ? "Admin Team Management" : "Manager Membership"}</h3>
                <p className="mt-0.5 text-sm text-slate-500">You are currently assigned to a company.</p>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Company</span><span className="font-medium">{company?.name ? String(company.name) : "Not assigned"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Total Team</span><span className="font-medium">{Array.isArray(managerTeams) ? `${managerTeams.length} (${createdTeamsCount} created)` : "No team created"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Status</span><span className="font-medium capitalize text-emerald-600">{String(profile?.companyStatus)}</span></div>
                </div>
                {canCreateMoreTeams ? (
                  <form className="flex gap-2" onSubmit={createTeam}>
                    <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5" placeholder="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
                    <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"><Plus size={16} /></button>
                  </form>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Team creation limit reached ({createdTeamsCount}/{teamLimit}).</p>
                )}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {role === "human-resource" ? "HR" : role === "admin" ? "Admins" : "Managers"} can create up to {teamLimit} teams. Created: {createdTeamsCount}/{teamLimit} &middot; Total managed: {managerTeams.length}
                </p>
                {managerTeams.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">My Teams</p>
                    <div className="space-y-1">
                      {managerTeams.map((t) => (
                        <div key={String(t.id)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-900">{String(t.name ?? "")}</span>
                          <span className="text-xs text-slate-500">{Number(t.employeeCount ?? 0)} employees</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)} onClick={() => setRoleQuitModal(true)} type="button">
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setCancelQuitModal(true)} type="button">Cancel Request</button> : null}
              </div>
            </section>

            {role === "human-resource" && managerTeams.length > 0 ? (
              <section className={`${sectionBase} overflow-y-auto max-h-[500px]`}>
                <div className="mb-5 border-l-4 border-teal-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900">HR Team Onboarding</h3>
                  <p className="mt-0.5 text-sm text-slate-500">Share these codes with new team members</p>
                </div>
                <div className="space-y-3">
                  {managerTeams.map((teamItem) => {
                    const code = String(teamItem.joinCode ?? "");
                    const otherCode = String(teamItem.otherJoinCode ?? "");
                    const teamName = String(teamItem.name ?? "Team");
                    return (
                      <div key={String(teamItem.id)} className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{teamName}</p>
                          <span className="text-xs text-slate-500">{Number(teamItem.employeeCount ?? 0)} employees</span>
                        </div>
                        {[
                          { code, label: "Team code" },
                          ...(otherCode ? [{ code: otherCode, label: "Others code" }] : []),
                        ].map((item) => (
                          <div className="mb-3 last:mb-0" key={item.code}>
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">{item.code}</p>
                                <button aria-label={`Copy ${teamName} ${item.label}`}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  onClick={() => { navigator.clipboard.writeText(item.code); showToast(`${teamName} ${item.label.toLowerCase()} copied.`); }} title="Copy code" type="button">
                                  <Users size={20} />
                                </button>
                              </div>
                            </div>
                            <button
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                              onClick={() => { const joinUrl = `${window.location.origin}/join?code=${item.code}`; navigator.clipboard.writeText(joinUrl); showToast(`${teamName} ${item.label.toLowerCase()} join URL copied.`); }}
                              type="button"><Users size={16} /> Copy {item.label} Join URL</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {managerTeams.length > 0 ? (
              <section className={sectionBase}>
                <button className="flex w-full items-center justify-between" onClick={() => setTeamTransferOpen((prev) => !prev)} type="button">
                  <div className="border-l-4 border-amber-500 pl-4">
                    <h3 className="text-base font-semibold text-slate-900">Team Transfer</h3>
                    <p className="mt-0.5 text-sm text-slate-500">Transfer teams to another {formatRole(role, isSeniorSecurity)}. Admin approval required.</p>
                  </div>
                  <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform duration-200 ${teamTransferOpen ? "rotate-180" : ""}`} />
                </button>
                {teamTransferOpen ? (
                  <div className="mt-5 space-y-4">
                    {managerTeams.map((t) => {
                      const tid = String(t.id ?? "");
                      const checked = teamTransferTeamIds.includes(tid);
                      return (
                        <label key={tid} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                          <input type="checkbox" className="size-4 accent-slate-900" checked={checked} onChange={() => setTeamTransferTeamIds((prev) => checked ? prev.filter((id) => id !== tid) : [...prev, tid])} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{String(t.name ?? "Team")}</p>
                            <p className="text-xs text-slate-500">{Number(t.employeeCount ?? 0)} employees &middot; Created by {String(t.createdBy ?? "Unknown")}{t.createdByRole ? ` (${String(t.createdByRole)})` : ""}</p>
                          </div>
                        </label>
                      );
                    })}
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Replacement</label>
                      <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={teamTransferReplacementId}
                        onChange={(e) => setTeamTransferReplacementId(e.target.value)}>
                        <option value="">Select replacement</option>
                        {replacementRoleCandidates.map((member) => (
                          <option key={String(member.id)} value={String(member.id)}>{String(member.name ?? "Member")} ({String(member.email ?? "")})</option>
                        ))}
                      </select>
                      {replacementRoleCandidates.length === 0 ? <p className="mt-2 text-xs text-amber-700">No approved replacement available with this role.</p> : null}
                    </div>
                    <button className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      disabled={!teamTransferReplacementId || teamTransferTeamIds.length === 0 || teamTransferSubmitting}
                      onClick={() => void requestTeamTransfer()} type="button">
                      {teamTransferSubmitting ? "Submitting..." : "Submit Team Transfer Request"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className={sectionBase}>
              <div className="mb-5 border-l-4 border-cyan-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">{role === "admin" ? "All Teams History" : "Manager Team History"}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{role === "admin" ? "View all teams in the company." : "Open a team to view employees and remove members."}</p>
              </div>
              <div className="mt-4 space-y-2">
                {(role === "admin" ? transferTeams : managerTeams).length > 0 ? (
                  (role === "admin" ? transferTeams : managerTeams).map((t) => (
                    <button key={String(t.id)} type="button" onClick={() => setTeamModal(t)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100">
                      <span>{String(t.name)}</span>
                      <span className="font-medium">{Number(t.employeeCount ?? 0)} employees</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No teams yet.</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <JoinPanel title="Join company" placeholder="Company code" value={companyCode} onChange={setCompanyCode} onSubmit={joinCompany}
              status={profile?.companyStatus ? String(profile.companyStatus) : undefined} onCancelRequest={() => setCancelJoinModal(true)} />
            <HistoryCard title="Manager Team History" rows={toManagerHistoryRows(insights)} hint="Teams created and employee joins." />
          </>
        )
      ) : null}

      <TeamEmployeesModal team={teamModal} selfId={selfId} onClose={() => setTeamModal(null)}
        onKick={(tid, eid, ename, tname) => setKickModal({ teamId: tid, employeeId: eid, employeeName: ename, teamName: tname })}
        onDeleteTeam={(tid, tname) => setDeleteTeamModal({ teamId: tid, teamName: tname })} />
      <KickModal data={kickModal} confirmText={kickConfirmText} onTextChange={setKickConfirmText}
        onClose={() => { setKickModal(null); setKickConfirmText(""); }}
        onConfirm={() => void kickEmployee(kickModal!.teamId, kickModal!.employeeId)} />
      <DeleteTeamModal data={deleteTeamModal} confirmText={deleteTeamConfirmText} onTextChange={setDeleteTeamConfirmText}
        onClose={() => { setDeleteTeamModal(null); setDeleteTeamConfirmText(""); }}
        onConfirm={() => void deleteTeamFn(deleteTeamModal!.teamId)} />

      {["employee", "others"].includes(role) ? (
        companyJoinStatus === "approved" ? (
          <>
            <section className={sectionBase}>
              <div className="mb-5 border-l-4 border-emerald-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Membership</h3>
                <p className="mt-0.5 text-sm text-slate-500">You are currently approved in this company.</p>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Company</span><span className="font-medium">{company?.name ? String(company.name) : "Not assigned"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Team</span><span className="font-medium">{team?.name ? String(team.name) : "Not assigned"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Manager Name</span><span className="font-medium">{typeof team?.manager === "object" && team?.manager ? ((team.manager as { name?: string })?.name ?? "Not assigned") : "Not assigned"}</span></div>
                  <div className="mt-3 flex justify-between gap-4"><span className="text-slate-500">Status</span><span className="font-medium capitalize text-emerald-600">Company {String(profile?.companyStatus)}</span></div>
                </div>
                {teamJoinStatus === "approved" ? (
                  <button className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(insights?.pendingQuit)} onClick={requestEmployeeQuit}>
                    {pendingQuitText("Request Team Quit")}
                  </button>
                ) : null}
                <button className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)} onClick={requestManagerQuit}>
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? <button className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setCancelQuitModal(true)} type="button">Cancel Request</button> : null}
              </div>
            </section>
            {teamJoinStatus !== "approved" ? (
              <JoinPanel title="Join team using code" placeholder="TM-... code" value={teamCode} onChange={setTeamCode} onSubmit={joinTeam}
                status={teamJoinStatus === "none" ? undefined : teamJoinStatus} onCancelRequest={() => setCancelJoinModal(true)} />
            ) : null}
            <HistoryCard title="Membership History" rows={toEmployeeHistoryRows(insights)} hint="Company/team switches and removals." />
          </>
        ) : (
          <>
            <JoinPanel title="Join using code" placeholder="CO-... or TM-... code" value={teamCode} onChange={setTeamCode} onSubmit={joinTeam}
              status={pendingJoinStatus} onCancelRequest={() => setCancelJoinModal(true)} />
            <HistoryCard title="Membership History" rows={toEmployeeHistoryRows(insights)} hint="Employee can join up to 2 teams." />
          </>
        )
      ) : null}
      {role === "admin" ? <HistoryCard title="Team Overview" rows={toAdminHistoryRows(insights)} hint="Team name, owner, and employee count." /> : null}
    </div>
  );
}
