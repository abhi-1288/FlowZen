import { FormEvent, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { CodePanel, JoinPanel } from "./admin-tabs";
import { DocumentLetterModal } from "./document-letter-modal";
import { ImageCropModal } from "./image-crop-modal";
import { useWfh } from "./hooks/use-wfh";
import { usePolicySettings } from "./hooks/use-policy-settings";
import { useSetupWizard } from "./hooks/use-setup-wizard";
import { PersonalInfoSection } from "./sections/personal-info-section";
import { CompanyTeamSection } from "./sections/company-team-section";
import { PolicyQuotasSection } from "./sections/policy-quotas-section";
import { CompensationSection } from "./sections/compensation-section";
import { PolicyConfigSection } from "./sections/policy-config-section";
import { CompanyControlsSection } from "./sections/company-controls-section";
import { TeamOnboardingCodesSection } from "./sections/team-onboarding-codes-section";
import { DocumentLettersSection } from "./sections/document-letters-section";
import { SecuritySection } from "./sections/security-section";
import { ReleaseNotesSection } from "./sections/release-notes-section";
import { MonthlyCheckBox } from "./monthly-check-box";
import { ConfirmActionModal } from "./modals/confirm-action-modal";
import { SetupModal } from "./modals/setup-modal";
import { AnyRecord, formatRoleWithCustom } from "./shared";
import { WfhAdminSection, type WfhAdminState } from "./sections/wfh-admin-section";
import { CompanyThemeSection } from "./sections/company-theme-section";
import { CompanyAddressSection } from "./sections/company-address-section";
import dynamic from "next/dynamic";

const IdCardModal = dynamic(
  () => import("./id-card-modal").then((mod) => mod.IdCardModal),
  { ssr: false },
);

export function ProfileTab({
  profile,
  insights,
  refresh,
  showToast,
}: {
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [modal, setModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarDeleteModal, setAvatarDeleteModal] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [salaryRequesting, setSalaryRequesting] = useState(false);
  const [policyInfo, setPolicyInfo] = useState<{
    foodAmount: number; travelAccommodationAmount: number;
    foodOptedOutMembers?: AnyRecord[]; travelOptedOutMembers?: AnyRecord[];
    advanceSalaryEnabled?: boolean;
    pfPercentage?: number; esicPercentage?: number; tdsPercentage?: number;
  } | null>(null);
  const [salaryCycle, setSalaryCycle] = useState<{
    salaryCycleDay: number;
    salaryCycleStartDay: number | null;
    salaryCycleEndDay: number | null;
  } | null>(null);
  const [companyActionModal, setCompanyActionModal] = useState(false);
  const [companyActionType, setCompanyActionType] = useState<"hold" | "takedown" | null>(null);
  const [companyActionConfirm, setCompanyActionConfirm] = useState("");
  const [companyActionLoading, setCompanyActionLoading] = useState(false);
  const [adminJoinCode, setAdminJoinCode] = useState("");
  const [identityRequesting, setIdentityRequesting] = useState(false);
  const [showDocLetterModal, setShowDocLetterModal] = useState(false);
  const [docLetterMode, setDocLetterMode] = useState<"request" | "send">("request");
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [idCardRequestStatus, setIdCardRequestStatus] = useState<string | null>(null);
  const [idCardSignature, setIdCardSignature] = useState<{ name: string; role: string; signedAt: string } | null>(null);
  const [idCardIssueDate, setIdCardIssueDate] = useState<string | null>(null);

  const company = typeof profile?.company === "object" && profile.company ? (profile.company as AnyRecord) : null;
  const team = typeof profile?.team === "object" && profile.team ? (profile.team as AnyRecord) : null;
  const role = profile?.role ? String(profile.role) : "";
  const sessionRole = session?.user?.role ? String(session.user.role) : "";
  const effectiveRole = role || sessionRole;
  const displayRole = formatRoleWithCustom(effectiveRole, profile?.customRole, Boolean((profile as any)?.isSeniorSecurity));
  const isJuniorSecurity = effectiveRole === "security" && !Boolean((profile as any)?.isSeniorSecurity);
  const inApprovedCompany = Boolean(profile?.company) && String(profile?.companyStatus ?? "") === "approved";
  const effectiveBaseSalary = inApprovedCompany ? Math.max(Number(insights?.baseSalary ?? 0), 0) : 0;
  const joinedBy = (insights?.joinedBy as AnyRecord | undefined) ?? null;
  const passwordResetRequired = Boolean(profile?.passwordResetRequired);
  const sectionClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const displayName = profile?.name ? String(profile.name) : session?.user?.name ? String(session.user.name) : "User";
  const managerTeams = Array.isArray((insights?.manager as AnyRecord | undefined)?.teams) ? ((insights?.manager as AnyRecord).teams as AnyRecord[]) : [];
  const companyMembers = Array.isArray((insights?.hr as AnyRecord | undefined)?.members) ? (((insights?.hr as AnyRecord).members as AnyRecord[]) ?? []) : [];
  const profileId = String(profile?._id ?? profile?.id ?? "");
  const approvedMembersBesidesAdmin = companyMembers.filter((member) => {
    const memberId = String(member?._id ?? member?.id ?? "");
    return memberId !== profileId;
  }).length;
  const canUseEmptyCompanyControls = role === "admin" && Boolean(company) && approvedMembersBesidesAdmin === 0;

  const wfh = useWfh(company, refresh, showToast);
  const policy = usePolicySettings(company, refresh, showToast);
  const setup = useSetupWizard(profile, showToast, refresh);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
    setCurrentPassword("");
    setNewPassword("");
    await refresh(true);
    showToast("Password updated.");
  }

  async function joinAsAdmin(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/company/join", { method: "POST", body: JSON.stringify({ code: adminJoinCode }) });
      showToast("Admin join request sent.");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to send join request.", "error");
    }
  }

  async function requestIdentityCode() {
    try {
      setIdentityRequesting(true);
      await apiFetch("/api/profile/identity-code/request", { method: "POST" });
      showToast("Unique identity request sent to HR.");
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request unique identity.", "error");
    } finally {
      setIdentityRequesting(false);
    }
  }

  async function requestSalary() {
    try {
      setSalaryRequesting(true);
      await apiFetch("/api/finance/salary-request", { method: "POST" });
      showToast(role === "human-resource" ? "Salary request sent to admin." : role === "admin" ? "Salary request sent to admin/HR." : "Salary request sent to HR.");
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to request salary.", "error");
    } finally {
      setSalaryRequesting(false);
    }
  }

  async function deleteAccount() {
    try {
      setDeleting(true);
      await apiFetch("/api/profile", { method: "DELETE" });
      await signOut({ callbackUrl: "/signup" });
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function uploadAvatar(blob: Blob) {
    const data = new FormData();
    data.append("avatar", blob, "avatar.png");
    setUploading(true);
    try {
      const response = await fetch("/api/profile/image", { method: "POST", body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to upload avatar.");
      showToast("Avatar updated.");
      setAvatarCropFile(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to upload avatar.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAvatar() {
    try {
      setDeletingAvatar(true);
      const response = await fetch("/api/profile/image", { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to delete avatar.");
      showToast("Avatar deleted.");
      setAvatarDeleteModal(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to delete avatar.", "error");
    } finally {
      setDeletingAvatar(false);
    }
  }

  async function executeCompanyAction() {
    if (String(companyActionConfirm ?? "").trim().toUpperCase() !== "CONFIRM") {
      showToast("Type Confirm to confirm.", "error");
      return;
    }
    if (!companyActionType) return;
    setCompanyActionLoading(true);
    try {
      const endpoint = companyActionType === "hold" ? "/api/company/hold-freeze" : "/api/company/takedown";
      const res = await apiFetch<{ status?: string }>(endpoint, { method: "POST" });
      if (companyActionType === "hold") {
        showToast(res?.status === "frozen" ? "Company has been frozen." : "Company has been un-frozen.");
      } else {
        showToast("Company has been taken down.");
      }
      setCompanyActionModal(false);
      setCompanyActionConfirm("");
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to complete company action.", "error");
    } finally {
      setCompanyActionLoading(false);
    }
  }

  useEffect(() => {
    if (!inApprovedCompany) return;
    apiFetch<{ foodAmount: number; travelAccommodationAmount: number; foodOptedOutMembers: AnyRecord[]; travelOptedOutMembers: AnyRecord[]; advanceSalaryEnabled: boolean; pfPercentage: number; esicPercentage: number; tdsPercentage: number }>("/api/finance/policy")
      .then(setPolicyInfo).catch(() => {});
    apiFetch<{ salaryCycleDay: number; salaryCycleStartDay: number | null; salaryCycleEndDay: number | null }>("/api/finance/salary-cycle")
      .then(setSalaryCycle).catch(() => {});
  }, [inApprovedCompany]);

  useEffect(() => {
    if (!inApprovedCompany) { setIdCardRequestStatus(null); setIdCardSignature(null); setIdCardIssueDate(null); return; }
    apiFetch<{ status: string | null; requestId?: string; signature?: { name: string; role: string; signedAt: string } | null; issueDate?: string }>("/api/profile/id-card/status")
      .then((data) => {
        setIdCardRequestStatus(data.status);
        setIdCardSignature(data.signature ?? null);
        setIdCardIssueDate(data.issueDate ?? null);
      }).catch(() => {});
  }, [inApprovedCompany]);

  const wfhAdminState: WfhAdminState = {
    ...wfh,
    wfhDates: wfh.wfhDates,
    setWfhDates: wfh.setWfhDates,
    showWfhAssignModal: wfh.showWfhAssignModal,
    setShowWfhAssignModal: wfh.setShowWfhAssignModal,
    showManageWfhModal: wfh.showManageWfhModal,
    setShowManageWfhModal: wfh.setShowManageWfhModal,
    loadWfh: wfh.loadWfh,
    wfhMode: wfh.wfhMode,
    setWfhMode: wfh.setWfhMode,
    updateWfhMode: wfh.updateWfhMode,
    wfhLoading: wfh.wfhLoading,
  };

  return (
    <>
      {setup.showSetupBanner ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                {setup.daysRemaining > 0 ? "Account setup required" : "Critical: Account will be deleted"}
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                {setup.daysRemaining > 0
                  ? `Your account needs OTP verification and a password to be fully set up. ${setup.daysRemaining} day${setup.daysRemaining === 1 ? "" : "s"} remaining before auto-deletion.`
                  : "Your account has not been verified within 15 days and will be automatically deleted on next sign-in."}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => setup.setSetupBannerDismissed(true)} type="button">Dismiss</button>
              <button className="rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
                onClick={setup.openSetupModal} type="button">Complete setup</button>
            </div>
          </div>
        </div>
      ) : null}

      {idCardRequestStatus === "approved" ? (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
          <div>
            <p className="text-sm font-semibold text-slate-900">ID Card</p>
            <p className="text-xs text-slate-500">View and print your company identity card</p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setShowIdCardModal(true)}
            type="button"
          >
            Show ID Card
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <PersonalInfoSection profile={profile} session={session as { user?: { name?: string; email?: string } } | null} avatarUrl={avatarUrl} displayName={displayName}
          uploading={uploading} onAvatarDelete={() => setAvatarDeleteModal(true)}
          onAvatarFileSelect={(file) => setAvatarCropFile(file)}
          effectiveRole={effectiveRole} displayRole={displayRole}
          refresh={refresh} showToast={showToast} />

        <CompanyTeamSection profile={profile} company={company} team={team} inApprovedCompany={inApprovedCompany}
          role={role} identityRequesting={identityRequesting} insights={insights} onRequestIdentity={requestIdentityCode} />

        <PolicyQuotasSection company={company} policyInfo={policyInfo} salaryCycle={salaryCycle} profile={profile} session={session} />

        <CompensationSection inApprovedCompany={inApprovedCompany} effectiveBaseSalary={effectiveBaseSalary}
          insights={insights} role={role} salaryRequesting={salaryRequesting} onRequestSalary={requestSalary} />

        {role === "human-resource" && profile?.companyStatus === "approved" ? (
          <PolicyConfigSection
            noticePeriodDays={policy.noticePeriodDays}
            onNoticePeriodChange={policy.setNoticePeriodDays}
            savingNoticePeriod={policy.savingNoticePeriod}
            onSaveNoticePeriod={policy.saveNoticePeriodOnly}
            paidLeaveDays={policy.paidLeaveDays}
            onPaidLeaveDaysChange={policy.setPaidLeaveDays}
            paidLeavePeriod={policy.paidLeavePeriod}
            onPaidLeavePeriodChange={policy.setPaidLeavePeriod}
            savingPaidLeave={policy.savingPaidLeave}
            onSavePaidLeave={policy.savePaidLeaveOnly}
            carryForwardLeaveDays={policy.carryForwardLeaveDays}
            onCarryForwardLeaveChange={policy.setCarryForwardLeaveDays}
            savingCarryForwardLeave={policy.savingCarryForwardLeave}
            onSaveCarryForwardLeave={policy.saveCarryForwardLeaveOnly}
            wfhDays={wfh.wfhDays}
            onWfhDaysChange={wfh.setWfhDays}
            wfhPeriod={wfh.wfhPeriod}
            onWfhPeriodChange={wfh.setWfhPeriod}
            wfhLoading={wfh.wfhLoading}
            onSaveWfhQuota={wfh.saveWfhQuota}
            carryForwardWfhDays={wfh.carryForwardWfhDays}
            onCarryForwardWfhChange={wfh.setCarryForwardWfhDays}
            savingCarryForwardWfh={wfh.wfhLoading}
            onSaveCarryForwardWfh={wfh.saveCarryForwardWfhOnly}
            minWorkHours={policy.minWorkHours}
            onMinWorkHoursChange={policy.setMinWorkHours}
            savingDayHour={policy.savingDayHour}
            onSaveDayHour={policy.saveDayHourOnly}
          />
        ) : null}

        {canUseEmptyCompanyControls ? (
          <CompanyControlsSection company={company}
            onHoldFreeze={() => { setCompanyActionType("hold"); setCompanyActionModal(true); }}
            onTakedown={() => { setCompanyActionType("takedown"); setCompanyActionModal(true); }} />
        ) : null}

        {role === "admin" && company?.joinCode && company?.status !== "taken-down" ? (
          <>
            {profile?.companyStatus === "approved" ? (
              <CodePanel title="Onboarding" code={company?.adminJoinCode ? String(company.adminJoinCode) : undefined}
                label="Admin code" empty="Register a company to generate onboarding codes." showToast={showToast}
                secondaryCodes={company?.joinCode ? [{ code: String(company.joinCode), label: "HR code" }] : []} />
            ) : (
              <JoinPanel title="Join company as Admin" placeholder="Admin company code" value={adminJoinCode}
                onChange={setAdminJoinCode} onSubmit={joinAsAdmin} status={String(profile?.companyStatus ?? "none")}
                onCancelRequest={async () => { await apiFetch("/api/join/cancel", { method: "POST" }); await refresh(); }} />
            )}
            <WfhAdminSection state={wfhAdminState} company={company} showToast={showToast} />
          </>
        ) : null}

        {(role === "admin" || role === "human-resource") && profile?.companyStatus === "approved" ? (
          <CompanyThemeSection company={company} showToast={showToast} />
        ) : null}

        {["project-manager", "qa-tester", "finance", "admin"].includes(role) ? (
          <TeamOnboardingCodesSection managerTeams={managerTeams} showToast={showToast} />
        ) : null}

        {inApprovedCompany ? (
          <DocumentLettersSection
            onRequestLetter={() => { setDocLetterMode("request"); setShowDocLetterModal(true); }}
            onSendResignation={() => { setDocLetterMode("send"); setShowDocLetterModal(true); }} />
        ) : null}

        <SecuritySection passwordResetRequired={passwordResetRequired} currentPassword={currentPassword}
          onCurrentPasswordChange={setCurrentPassword} newPassword={newPassword}
          onNewPasswordChange={setNewPassword} onUpdatePassword={updatePassword}
          onDeleteAccount={() => setModal(true)} />

        <ReleaseNotesSection />

        <MonthlyCheckBox sectionClass={sectionClass} showToast={showToast} />
      </div>

      {(role === "admin" || role === "human-resource") && profile?.companyStatus === "approved" ? (
        <div className="mt-5">
          <CompanyAddressSection company={company} role={role} userId={profileId} showToast={showToast} refresh={refresh} />
        </div>
      ) : null}

      {showDocLetterModal ? (
        <DocumentLetterModal mode={docLetterMode} onClose={() => setShowDocLetterModal(false)}
          onSuccess={() => { setShowDocLetterModal(false); void refresh(true); }} showToast={showToast}
          isJuniorSecurity={isJuniorSecurity} />
      ) : null}

      <ConfirmActionModal open={modal} title="Delete account?"
        description={<><p>This action cannot be undone.</p><p>Type <span className="font-semibold text-rose-600">DELETE</span> to confirm.</p></>}
        confirmWord="DELETE" inputValue={confirmText} onInputChange={setConfirmText}
        loading={deleting} onConfirm={() => void deleteAccount()}
        onCancel={() => { setModal(false); setConfirmText(""); }} />

      <ConfirmActionModal open={companyActionModal && companyActionType !== null}
        title={companyActionType === "hold" ? (company?.status === "frozen" ? "Un-freeze Company?" : "Hold & Freeze Company?") : "TakeDown Company?"}
        description={<><p>This action requires typing <span className="font-semibold">Confirm</span> before it will proceed.</p>
          <p>{companyActionType === "hold" ? (company?.status === "frozen"
            ? "Un-freezing re-activates the company so members can work, join, and process finance again."
            : "Freezing stops all joining, finance, and work activity. Use Un-freeze to restore later.")
            : "This permanently deletes the company, all teams, boards, tasks, notifications, and related data. This cannot be undone."}</p></>}
        confirmWord="CONFIRM" inputValue={companyActionConfirm} onInputChange={setCompanyActionConfirm}
        loading={companyActionLoading} onConfirm={() => void executeCompanyAction()}
        onCancel={() => { setCompanyActionModal(false); setCompanyActionConfirm(""); }}
        confirmLabel={companyActionLoading ? "Processing..." : "Confirm"} />

      <ConfirmActionModal open={avatarDeleteModal} title="Delete avatar?"
        description={<p>This will permanently remove your current profile picture. You can upload a new one afterwards.</p>}
        noInput loading={deletingAvatar} onConfirm={() => void deleteAvatar()}
        onCancel={() => setAvatarDeleteModal(false)} confirmLabel={deletingAvatar ? "Deleting..." : "Delete"} />

      {avatarCropFile ? <ImageCropModal file={avatarCropFile} aspect={1}
        onCancel={() => setAvatarCropFile(null)} onDone={(blob) => void uploadAvatar(blob)} /> : null}

      <SetupModal open={setup.setupModal} profile={profile}
        step={setup.setupStep} otpValue={setup.otpValue} onOtpChange={setup.setOtpValue}
        setupRole={setup.setupRole} onRoleChange={setup.setSetupRole}
        setupPassword={setup.setupPassword} onPasswordChange={setup.setSetupPassword}
        loading={setup.setupLoading} error={setup.setupError}
        onClose={setup.closeSetupModal} onSendOtp={setup.sendOtp}
        onVerifyOtp={setup.verifyOtp} onCompleteSetup={setup.completeSetup} />

      {showIdCardModal ? (
        <IdCardModal
          open={showIdCardModal}
          onClose={() => setShowIdCardModal(false)}
          profile={profile}
          company={company}
          avatarUrl={avatarUrl}
          displayName={displayName}
          displayRole={displayRole}
          signature={idCardSignature}
          issueDate={idCardIssueDate}
        />
      ) : null}
    </>
  );
}
