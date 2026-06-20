import { FormEvent, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-utils";
import { CodePanel, JoinPanel } from "./admin-tabs";
import {
  ActionButton,
  AnyRecord,
  AvatarBadge,
  HistoryCard,
  Row,
  SectionHeader,
  displayNested,
  formatRole,
  formatRoleWithCustom,
  toAdminHistoryRows,
  toEmployeeHistoryRows,
  toManagerHistoryRows,
} from "./shared";
import { VersionPanel } from "@/components/version/version-panel";
import { WfhAssignModal } from "./wfh-assign-modal";
import { ManageWfhDatesModal } from "./manage-wfh-dates-modal";
import { DocumentLetterModal } from "./document-letter-modal";

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
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [salaryRequesting, setSalaryRequesting] = useState(false);
  const [policyInfo, setPolicyInfo] = useState<{
    foodAmount: number;
    travelAccommodationAmount: number;
    foodOptedOutMembers?: any[];
    travelOptedOutMembers?: any[];
  } | null>(null);
  const [companyActionModal, setCompanyActionModal] = useState(false);
  const [companyActionType, setCompanyActionType] = useState<
    "hold" | "takedown" | null
  >(null);
  const [companyActionConfirm, setCompanyActionConfirm] = useState("");
  const [companyActionLoading, setCompanyActionLoading] = useState(false);
  const [adminJoinCode, setAdminJoinCode] = useState("");

  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;

  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;

  const role = profile?.role ? String(profile.role) : "";
  const sessionRole = session?.user?.role ? String(session.user.role) : "";
  const effectiveRole = role || sessionRole;
  const displayRole = formatRoleWithCustom(effectiveRole, profile?.customRole);
  const inApprovedCompany =
    Boolean(profile?.company) &&
    String(profile?.companyStatus ?? "") === "approved";
  const effectiveBaseSalary = inApprovedCompany
    ? Math.max(Number(insights?.baseSalary ?? 0), 0)
    : 0;
  const joinedBy = (insights?.joinedBy as AnyRecord | undefined) ?? null;
  const passwordResetRequired = Boolean(profile?.passwordResetRequired);
  const sectionClass =
    "rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]";
  const avatarUrl = profile?.avatarUrl ? String(profile.avatarUrl) : "";
  const displayName = profile?.name
    ? String(profile.name)
    : session?.user?.name
      ? String(session.user.name)
      : "User";
  const initialNotice = company?.noticePeriodDays
    ? Number(company.noticePeriodDays)
    : 30;
  const [noticePeriodDays, setNoticePeriodDays] =
    useState<number>(initialNotice);
  const [paidLeaveDays, setPaidLeaveDays] = useState<number>(
    Math.max(0, Number(company?.paidLeaveDays ?? 0)),
  );
  const [paidLeavePeriod, setPaidLeavePeriod] = useState<"monthly" | "yearly">(
    String(company?.paidLeavePeriod ?? "monthly") === "yearly"
      ? "yearly"
      : "monthly",
  );
  const [savingNoticePeriod, setSavingNoticePeriod] = useState(false);
  const [savingPaidLeave, setSavingPaidLeave] = useState(false);
  const [savingDayHour, setSavingDayHour] = useState(false);
  // WFH quota (HR)
  const [minWorkHours, setMinWorkHours] = useState<number>(
    Math.max(1, Math.min(24, Number(company?.minWorkHours ?? 8))),
  );
  const [wfhDays, setWfhDays] = useState(0);
  const [wfhPeriod, setWfhPeriod] = useState<"monthly" | "yearly">("monthly");
  // WFH mode & dates (Admin)
  const [wfhMode, setWfhMode] = useState<"all-day" | "wfh-only">("all-day");
  const [wfhLoading, setWfhLoading] = useState(false);
  const [wfhDates, setWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [weekendDates, setWeekendDates] = useState<{ date: string; reason?: string }[]>([]);
  const [weekendMonth, setWeekendMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [weekendDays, setWeekendDays] = useState({ saturday: false, sunday: true });
  const [showWfhAssignModal, setShowWfhAssignModal] = useState(false);
  const [showManageWfhModal, setShowManageWfhModal] = useState(false);
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const [confirmDateStr, setConfirmDateStr] = useState("");
  const [confirmDateIsWeekend, setConfirmDateIsWeekend] = useState(false);
  const [confirmDateDay, setConfirmDateDay] = useState(0);
  const [identityRequesting, setIdentityRequesting] = useState(false);
  const [showDocLetterModal, setShowDocLetterModal] = useState(false);
  const [docLetterMode, setDocLetterMode] = useState<"request" | "send">("request");
  const managerTeams = Array.isArray(
    (insights?.manager as AnyRecord | undefined)?.teams,
  )
    ? ((insights?.manager as AnyRecord).teams as AnyRecord[])
    : [];
  const companyMembers = Array.isArray(
    (insights?.hr as AnyRecord | undefined)?.members,
  )
    ? (((insights?.hr as AnyRecord).members as AnyRecord[]) ?? [])
    : [];
  const profileId = String(profile?._id ?? profile?.id ?? "");
  const approvedMembersBesidesAdmin = companyMembers.filter((member) => {
    const memberId = String(member?._id ?? member?.id ?? "");
    return memberId !== profileId;
  }).length;
  const canUseEmptyCompanyControls =
    role === "admin" && Boolean(company) && approvedMembersBesidesAdmin === 0;

  async function updatePassword(event: FormEvent) {
    event.preventDefault();

    await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setCurrentPassword("");
    setNewPassword("");
    await refresh(true);
    showToast("Password updated.");
  }

  async function joinAsAdmin(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/company/join", {
        method: "POST",
        body: JSON.stringify({ code: adminJoinCode }),
      });
      showToast("Admin join request sent.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send join request.",
        "error",
      );
    }
  }

  async function requestIdentityCode() {
    try {
      setIdentityRequesting(true);
      await apiFetch("/api/profile/identity-code/request", { method: "POST" });
      showToast("Unique identity request sent to HR.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Unable to request unique identity.",
        "error",
      );
    } finally {
      setIdentityRequesting(false);
    }
  }

  async function requestSalary() {
    try {
      setSalaryRequesting(true);
      await apiFetch("/api/finance/salary-request", { method: "POST" });
      showToast(
        role === "human-resource"
          ? "Salary request sent to admin."
          : role === "admin"
            ? "Salary request sent to admin/HR."
            : "Salary request sent to HR.",
      );
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request salary.",
        "error",
      );
    } finally {
      setSalaryRequesting(false);
    }
  }

  async function deleteAccount() {
    try {
      setDeleting(true);

      await apiFetch("/api/profile", {
        method: "DELETE",
      });

      await signOut({ callbackUrl: "/signup" });
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function uploadAvatar(file: File) {
    const data = new FormData();
    data.append("avatar", file);
    setUploading(true);
    try {
      const response = await fetch("/api/profile/image", {
        method: "POST",
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to upload avatar.");
      }
      showToast("Avatar updated.");
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function deleteAvatar() {
    try {
      setDeletingAvatar(true);
      const response = await fetch("/api/profile/image", {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete avatar.");
      }
      showToast("Avatar deleted.");
      setAvatarDeleteModal(false);
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to delete avatar.",
        "error",
      );
    } finally {
      setDeletingAvatar(false);
    }
  }

  async function saveNoticePeriodOnly() {
    try {
      setSavingNoticePeriod(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ noticePeriodDays }),
      });
      showToast("Notice period updated.", "success");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update notice period.",
        "error",
      );
    } finally {
      setSavingNoticePeriod(false);
    }
  }

  async function savePaidLeaveOnly() {
    try {
      setSavingPaidLeave(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ paidLeaveDays, paidLeavePeriod }),
      });
      showToast("Paid leave policy updated.", "success");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update paid leave policy.",
        "error",
      );
    } finally {
      setSavingPaidLeave(false);
    }
  }

  async function saveDayHourOnly() {
    try {
      setSavingDayHour(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ minWorkHours }),
      });
      showToast("Day-hour working policy updated.", "success");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update day-hour policy.",
        "error",
      );
    } finally {
      setSavingDayHour(false);
    }
  }

  async function executeCompanyAction() {
    if (
      String(companyActionConfirm ?? "")
        .trim()
        .toUpperCase() !== "CONFIRM"
    ) {
      showToast("Type Confirm to confirm.", "error");
      return;
    }

    if (!companyActionType) return;
    setCompanyActionLoading(true);
    try {
      const endpoint =
        companyActionType === "hold"
          ? "/api/company/hold-freeze"
          : "/api/company/takedown";
      const res = await apiFetch<{ status?: string }>(endpoint, { method: "POST" });
      const newStatus = res?.status;
      if (companyActionType === "hold") {
        showToast(
          newStatus === "frozen"
            ? "Company has been frozen."
            : "Company has been un-frozen.",
        );
      } else {
        showToast("Company has been taken down.");
      }
      setCompanyActionModal(false);
      setCompanyActionConfirm("");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Unable to complete company action.",
        "error",
      );
    } finally {
      setCompanyActionLoading(false);
    }
  }

  async function loadWfh() {
    if (!company) return;
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhDays: number; wfhPeriod: string; wfhCheckInMode: string; wfhDates: { date: string; reason: string }[]; weekendDates?: { date: string; reason?: string }[] }>(
        "/api/company/wfh",
      );
      setWfhDays(res.wfhDays ?? 0);
      setWfhPeriod(res.wfhPeriod === "yearly" ? "yearly" : "monthly");
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      setWfhDates(res.wfhDates || []);
      setWeekendDates(res.weekendDates || []);
    } catch (err) {
      // ignore
    } finally {
      setWfhLoading(false);
    }
  }

  useEffect(() => {
    void loadWfh();
  }, [company?.id]);

  useEffect(() => {
    if (!inApprovedCompany) return;
    apiFetch<{
      foodAmount: number;
      travelAccommodationAmount: number;
      foodOptedOutMembers: any[];
      travelOptedOutMembers: any[];
    }>("/api/finance/policy")
      .then(setPolicyInfo)
      .catch(() => { });
  }, [inApprovedCompany]);

  async function saveWfhQuota() {
    try {
      setWfhLoading(true);
      await apiFetch("/api/company/wfh", {
        method: "POST",
        body: JSON.stringify({ wfhDays, wfhPeriod }),
      });
      showToast("WFH quota updated.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update WFH quota",
        "error",
      );
    } finally {
      setWfhLoading(false);
    }
  }

  async function updateWfhMode(mode: "all-day" | "wfh-only") {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhCheckInMode: string }>(
        "/api/company/wfh",
        {
          method: "PATCH",
          body: JSON.stringify({ mode }),
        },
      );
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      showToast("WFH mode updated.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update mode",
        "error",
      );
    } finally {
      setWfhLoading(false);
    }
  }

  const visibleWeekendDates = useMemo(() => {
    return [...weekendDates]
      .filter((item) => String(item.date ?? "").startsWith(weekendMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weekendDates, weekendMonth]);

  async function assignWeekends() {
    if (!weekendDays.saturday) {
      showToast("Select Saturday.", "error");
      return;
    }

    try {
      setWfhLoading(true);
      const res = await apiFetch<{ weekendDates: { date: string; reason?: string }[] }>("/api/company/weekends", {
        method: "POST",
        body: JSON.stringify({ month: weekendMonth, days: [6] }),
      });
      setWeekendDates(res.weekendDates || []);
      showToast("Weekend dates assigned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign weekends", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  async function deleteWeekend(date: string) {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ weekendDates: { date: string; reason?: string }[] }>("/api/company/weekends", {
        method: "DELETE",
        body: JSON.stringify({ date }),
      });
      setWeekendDates(res.weekendDates || []);
      showToast("Weekend date removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove weekend", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  async function excludeDefaultSunday(dateStr: string) {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ weekendDates: { date: string; reason?: string }[] }>("/api/company/weekends", {
        method: "POST",
        body: JSON.stringify({ month: weekendMonth, days: [0] }),
      });
      setWeekendDates(res.weekendDates || []);
      const res2 = await apiFetch<{ weekendDates: { date: string; reason?: string }[] }>("/api/company/weekends", {
        method: "DELETE",
        body: JSON.stringify({ date: dateStr }),
      });
      setWeekendDates(res2.weekendDates || []);
      showToast("Weekend date removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove weekend", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  async function assignWeekendDate(dateStr: string) {
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ weekendDates: { date: string; reason?: string }[] }>("/api/company/weekends", {
        method: "POST",
        body: JSON.stringify({ date: dateStr }),
      });
      setWeekendDates(res.weekendDates || []);
      showToast("Weekend date assigned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign weekend", "error");
    } finally {
      setWfhLoading(false);
    }
  }

  const { update: updateSession } = useSession();
  const [setupModal, setSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<"send-otp" | "verify-otp" | "password" | "done">("send-otp");
  const [otpValue, setOtpValue] = useState(new Array(6).fill(""));
  const [setupRole, setSetupRole] = useState<string>("employee");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);

  const isOAuthUnverified = effectiveRole === "others" && profile?.authProvider && String(profile.authProvider) !== "credentials" && !profile?.emailVerified;
  const showSetupBanner = isOAuthUnverified && !setupBannerDismissed;

  const accountAgeDays = profile?.createdAt
    ? Math.floor((Date.now() - new Date(String(profile.createdAt)).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const daysRemaining = Math.max(0, 15 - accountAgeDays);

  function openSetupModal() {
    setSetupStep("send-otp");
    setOtpValue(new Array(6).fill(""));
    setSetupRole("employee");
    setSetupPassword("");
    setSetupError("");
    setSetupModal(true);
  }

  async function sendOtp() {
    try {
      setSetupLoading(true);
      setSetupError("");
      await apiFetch("/api/auth/oauth/send-otp", { method: "POST" });
      setSetupStep("verify-otp");
      showToast("OTP sent to your email.");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyOtp() {
    try {
      setSetupLoading(true);
      setSetupError("");
      await apiFetch("/api/auth/oauth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ otp: otpValue.join("") }),
      });
      setSetupStep("password");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Invalid OTP.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function completeSetup() {
    try {
      setSetupLoading(true);
      setSetupError("");
      const res = await apiFetch<{ ok: boolean; role: string }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ role: setupRole, newPassword: setupPassword }),
      });
      if (res?.ok) {
        setSetupStep("done");
        showToast(`Role updated to ${formatRole(setupRole)}.`);
        await refresh();
        await updateSession();
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Unable to complete setup.");
    } finally {
      setSetupLoading(false);
    }
  }

  function closeSetupModal() {
    setSetupModal(false);
    if (isOAuthUnverified) setSetupBannerDismissed(true);
  }

  return (
    <>
      {showSetupBanner ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                {daysRemaining > 0 ? "Account setup required" : "Critical: Account will be deleted"}
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                {daysRemaining > 0
                  ? `Your account needs OTP verification and a password to be fully set up. ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining before auto-deletion.`
                  : "Your account has not been verified within 15 days and will be automatically deleted on next sign-in."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                onClick={() => setSetupBannerDismissed(true)}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
                onClick={openSetupModal}
                type="button"
              >
                Complete setup
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Personal Info ── */}
        <section className={sectionClass}>
          <SectionHeader title="Personal Info" description="Basic details and identity" accent="indigo" />
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="lg" />
            {avatarUrl ? (
              <button
                aria-label="Delete avatar"
                className="inline-flex h-9 p-4 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setAvatarDeleteModal(true)}
                title="Delete avatar"
                type="button"
              >
                <Trash2 size={16} />
                <p className="text-sm font-medium ml-2 text-slate-700">Delete Profile Image</p>
              </button>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Camera size={16} />
                {uploading ? "Uploading..." : "Upload avatar"}
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                  type="file"
                />
              </label>
            )}
            <button
              aria-label="Avatar upload restrictions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              title="PNG, JPG, or WEBP only. Max size: 2MB."
              type="button"
            >
              <Info size={16} />
            </button>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Name"
              value={
                profile?.name
                  ? String(profile.name)
                  : session?.user?.name
                    ? String(session.user.name)
                    : undefined
              }
            />
            <Row
              label="Email"
              value={
                profile?.email
                  ? String(profile.email)
                  : session?.user?.email
                    ? String(session.user.email)
                    : undefined
              }
            />
            <Row
              label="Email-Verified"
              value={
                profile?.emailVerified
                  ? String(profile.emailVerified)
                  : undefined
              }
            />
            <Row label="Role" value={effectiveRole ? displayRole : undefined} />
            <Row
              label="Unique Identity"
              value={
                profile?.companyIdentityCode
                  ? String(profile.companyIdentityCode)
                  : undefined
              }
            />
          </dl>

          {Array.isArray(profile?.roleHistory) && profile.roleHistory.length > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Role History
              </p>
              <div className="space-y-2">
                {(profile.roleHistory as { oldRole: string; newRole: string; changedBy: string; changedAt: string }[]).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-900">{formatRole(entry.oldRole)}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium text-emerald-700">{formatRole(entry.newRole)}</span>
                    <span className="ml-auto whitespace-nowrap text-slate-400">
                      {new Date(entry.changedAt).toLocaleDateString()}
                    </span>
                    <span className="text-slate-400">by {entry.changedBy}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* ── Company & Team ── */}
        <section className={sectionClass}>
          <SectionHeader title="Company & Team" description="Organizational structure" accent="emerald" />
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Company"
              value={company?.name ? String(company.name) : undefined}
            />
            <Row
              label="Team"
              value={team?.name ? String(team.name) : undefined}
            />
            <Row
              label="Company status"
              value={
                profile?.companyStatus
                  ? String(profile.companyStatus)
                  : undefined
              }
            />
            <Row
              label="Team status"
              value={
                profile?.teamStatus ? String(profile.teamStatus) : undefined
              }
            />
            <Row
              label="Company Joined"
              value={
                profile?.company && profile?.companyJoined
                  ? new Date(
                    profile.companyJoined as string | Date,
                  ).toLocaleDateString()
                  : undefined
              }
            />
            <Row
              label="Team Joined"
              value={
                profile?.team && profile?.teamJoined
                  ? new Date(
                    profile.teamJoined as string | Date,
                  ).toLocaleDateString()
                  : undefined
              }
            />
            {inApprovedCompany &&
              !["human-resource", "admin"].includes(role) ? (
              <Row
                label={joinedBy?.viaHr ? "Joined By HR" : "Company approved by"}
                value={joinedBy?.name ? String(joinedBy.name) : undefined}
              />
            ) : null}
          </dl>
          {profile?.companyStatus === "approved" &&
            !profile?.companyIdentityCode ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                No unique company identity code has been issued yet.
              </p>
              <button
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  identityRequesting ||
                  Boolean(insights?.pendingIdentityCodeRequest)
                }
                onClick={requestIdentityCode}
                type="button"
              >
                {insights?.pendingIdentityCodeRequest
                  ? "Identity request pending"
                  : identityRequesting
                    ? "Requesting..."
                    : "Ask unique identity from HR"}
              </button>
            </div>
          ) : null}
        </section>

        {/* ── Policy & Quotas ── */}
        <section className={sectionClass}>
          <SectionHeader title="Policy & Quotas" description="Benefits and entitlements" accent="amber" />
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label="Food Accomodation"
              value={
                policyInfo
                  ? policyInfo.foodOptedOutMembers?.some((m) => String(m._id || m.id || m) === String(profile?.id ?? profile?._id ?? session?.user?.id))
                    ? "₹0/mo"
                    : `₹${policyInfo.foodAmount.toLocaleString("en-IN")}/mo`
                  : undefined
              }
            />
            <Row
              label="Travel Accomodation"
              value={
                policyInfo
                  ? policyInfo.travelOptedOutMembers?.some((m) => String(m._id || m.id || m) === String(profile?.id ?? profile?._id ?? session?.user?.id))
                    ? "₹0/mo"
                    : `₹${policyInfo.travelAccommodationAmount.toLocaleString("en-IN")}/mo`
                  : undefined
              }
            />
            <Row
              label="Notice Period"
              value={
                company?.noticePeriodDays
                  ? `${Number(company.noticePeriodDays)} day${Number(company.noticePeriodDays) === 1 ? "" : "s"}`
                  : undefined
              }
            />
            <Row
              label="Paid Leave"
              value={
                company
                  ? `${Math.max(0, Number(company.paidLeaveDays ?? 0))} day${Number(company.paidLeaveDays ?? 0) === 1 ? "" : "s"} ${String(company.paidLeavePeriod ?? "monthly")}`
                  : undefined
              }
            />
            <Row
              label="WFH"
              value={
                company
                  ? `${Math.max(0, Number(company.wfhDays ?? 0))} day${Number(company.wfhDays ?? 0) === 1 ? "" : "s"} ${String(company.wfhPeriod ?? "monthly")}`
                  : undefined
              }
            />
            <Row
              label="Work-Hours Policy"
              value={company
                ? `${Math.max(1, Number(company.minWorkHours ?? 8))} hrs / day`
                : "No minimum work hours"}
            />
          </dl>
        </section>

        {/* ── Compensation ── */}
        <section className={sectionClass}>
          <SectionHeader title="Compensation" description="Salary details" accent="rose" />
          <dl className="mt-4 space-y-3 text-sm">
            {inApprovedCompany ? (
              <Row
                label="Base Salary"
                value={
                  effectiveBaseSalary > 0
                    ? `₹${effectiveBaseSalary.toLocaleString("en-IN")}`
                    : undefined
                }
              />
            ) : null}
          </dl>
          {inApprovedCompany && !insights?.hasSalary ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">
                Salary not assigned yet?
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {role === "human-resource"
                  ? "Request admin to set up your salary record."
                  : role === "admin"
                    ? "Request another admin or HR to set up your salary record."
                    : "Request the HR who enrolled you to set up your salary."}
              </p>
              <button
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  salaryRequesting || Boolean(insights?.pendingSalaryRequest)
                }
                onClick={requestSalary}
                type="button"
              >
                {insights?.pendingSalaryRequest
                  ? "Salary request pending"
                  : salaryRequesting
                    ? "Requesting..."
                    : role === "human-resource"
                      ? "Request salary from admin"
                      : role === "admin"
                        ? "Request salary from admin/HR"
                        : "Request salary from HR"}
              </button>
            </div>
          ) : null}
        </section>

        {role === "human-resource" && profile?.companyStatus === "approved" ? (
          <section className={sectionClass}>
            <div className="mb-5 border-l-4 border-emerald-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900">Policy</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Configure company-wide policies
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label
                className="text-xs font-semibold uppercase text-slate-500"
                htmlFor="notice-period"
              >
                Notice period
              </label>
              <span> current notice period:{noticePeriodDays}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                id="notice-period"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(Number(e.target.value))}
              >
                <option value={5}>5 days</option>
                <option value={15}>15 days</option>
                <option value={30}>30 days</option>
                <option value={45}>45 days</option>
                <option value={60}>2 months (60 days)</option>
                <option value={90}>3 months (90 days)</option>
              </select>
              <button
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={savingNoticePeriod}
                type="button"
                onClick={() => void saveNoticePeriodOnly()}
              >
                {savingNoticePeriod ? "Saving..." : "Save policy"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label
                className="text-xs font-semibold uppercase text-slate-500"
                htmlFor="paid-leave-days"
              >
                Paid leave quota
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  id="paid-leave-days"
                  min={0}
                  max={365}
                  type="number"
                  value={paidLeaveDays}
                  onChange={(e) =>
                    setPaidLeaveDays(Math.max(0, Number(e.target.value)))
                  }
                />
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={paidLeavePeriod}
                  onChange={(e) =>
                    setPaidLeavePeriod(
                      e.target.value === "yearly" ? "yearly" : "monthly",
                    )
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Approved paid leaves remain payable in finance salary
                calculation.
              </p>
              <button
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={savingPaidLeave}
                type="button"
                onClick={() => void savePaidLeaveOnly()}
              >
                {savingPaidLeave ? "Saving..." : "Save paid leave"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                WFH Quota
              </label>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                Set the Work From Home allowance that members can request.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={wfhDays}
                  onChange={(e) => setWfhDays(Math.max(0, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-600">day(s) per</span>
                <select
                  value={wfhPeriod}
                  onChange={(e) => setWfhPeriod(e.target.value as "monthly" | "yearly")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="monthly">Month</option>
                  <option value="yearly">Year</option>
                </select>
                <button
                  onClick={saveWfhQuota}
                  disabled={wfhLoading}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  type="button"
                >
                  {wfhLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Day-Hour Working
              </label>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                Set the minimum working hours per day. Affects attendance status and salary calculation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={minWorkHours}
                  onChange={(e) => setMinWorkHours(Math.max(1, Math.min(24, Number(e.target.value))))}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-600">hours per day</span>
                <button
                  onClick={() => void saveDayHourOnly()}
                  disabled={savingDayHour}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
                  type="button"
                >
                  {savingDayHour ? "Saving..." : "Save"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Attendance rules: &lt; {Math.floor(minWorkHours / 2)} hrs = absent, &ge; {Math.floor(minWorkHours / 2)} hrs and &lt; {minWorkHours} hrs = half-day, &ge; {minWorkHours} hrs = present
              </p>
            </div>
          </section>
        ) : null}

        {canUseEmptyCompanyControls ? (
          <section className={sectionClass}>
            <div className="mb-5 border-l-4 border-rose-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900">Company controls</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {company?.status === "taken-down"
                  ? "This company has been taken down."
                  : "No approved members besides you remain in the company. Use these controls carefully."}
              </p>
            </div>
            {company?.status !== "taken-down" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={
                    "rounded-lg border px-4 py-3 text-sm font-semibold " +
                    (company?.status === "frozen"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                      : "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200")
                  }
                  onClick={() => {
                    setCompanyActionType("hold");
                    setCompanyActionModal(true);
                  }}
                >
                  {company?.status === "frozen"
                    ? "Un-freeze Company"
                    : "Hold & Freeze Company"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-200"
                  onClick={() => {
                    setCompanyActionType("takedown");
                    setCompanyActionModal(true);
                  }}
                >
                  TakeDown Company
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {role === "admin" && company?.joinCode && company?.status !== "taken-down" ? (
          <>
            {profile?.companyStatus === "approved" ? (
              <CodePanel
                title="Onboarding"
                code={company?.adminJoinCode ? String(company.adminJoinCode) : undefined}
                label="Admin code"
                empty="Register a company to generate onboarding codes."
                showToast={showToast}
                secondaryCodes={
                  company?.joinCode
                    ? [{ code: String(company.joinCode), label: "HR code" }]
                    : []
                }
              />
            ) : (
              <JoinPanel
                title="Join company as Admin"
                placeholder="Admin company code"
                value={adminJoinCode}
                onChange={setAdminJoinCode}
                onSubmit={joinAsAdmin}
                status={String(profile?.companyStatus ?? "none")}
                onCancelRequest={async () => {
                  await apiFetch("/api/join/cancel", { method: "POST" });
                  await refresh();
                }}
              />
            )}

            <section className={sectionClass}>
              <div className="mb-5 border-l-4 border-sky-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Work From Home Settings
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Assign company-wide WFH dates and configure check-in behavior.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Company WFH Dates
                  </label>
                  <p className="mt-1 mb-3 text-sm text-slate-500">
                    Assign or remove company-wide WFH days.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowWfhAssignModal(true)}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
                      type="button"
                    >
                      Assign WFH Dates
                    </button>
                    <button
                      onClick={() => { void loadWfh(); setShowManageWfhModal(true); }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                      type="button"
                    >
                      Manage WFH Dates
                      {wfhDates.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-xs text-white">
                          {wfhDates.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Manual Weekends
                  </label>
                  <p className="mt-1 text-sm text-slate-500">
                    View and manage company weekend dates.
                  </p>
                  <button
                    onClick={() => setShowWeekendModal(true)}
                    className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
                    type="button"
                  >
                    Manage Weekend
                    {weekendDates.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs text-white">
                        {weekendDates.length}
                      </span>
                    )}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Check-in behavior
                  </label>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose when the check-in button should be enabled.
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="mode-all"
                        name="wfh-mode"
                        type="radio"
                        checked={wfhMode === "all-day"}
                        onChange={() => setWfhMode("all-day")}
                      />
                      <label htmlFor="mode-all" className="text-sm">
                        Enable check-in all days
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="mode-wfh"
                        name="wfh-mode"
                        type="radio"
                        checked={wfhMode === "wfh-only"}
                        onChange={() => setWfhMode("wfh-only")}
                      />
                      <label htmlFor="mode-wfh" className="text-sm">
                        Enable check-in only on WFH days
                      </label>
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => updateWfhMode(wfhMode)}
                        disabled={wfhLoading}
                        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        type="button"
                      >
                        Save mode
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {showWfhAssignModal && (
              <WfhAssignModal
                onClose={() => setShowWfhAssignModal(false)}
                onRefresh={(dates) => {
                  setWfhDates(dates);
                  void loadWfh();
                }}
                showToast={showToast}
              />
            )}
            {showManageWfhModal && (
              <ManageWfhDatesModal
                wfhDates={wfhDates}
                onClose={() => setShowManageWfhModal(false)}
                onRefresh={() => void loadWfh()}
                showToast={showToast}
              />
            )}
            {showWeekendModal ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowWeekendModal(false);
                }}
              >
                <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div>
                      <h4 className="text-xl font-semibold">
                        Manage Weekends
                      </h4>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {weekendDates.length} weekend
                        {weekendDates.length === 1 ? "" : "s"} assigned
                      </p>
                    </div>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                      type="button"
                      onClick={() => setShowWeekendModal(false)}
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="border-b border-slate-100 px-6 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        type="month"
                        value={weekendMonth}
                        onChange={(event) => setWeekendMonth(event.target.value)}
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={weekendDays.saturday}
                          onChange={(event) =>
                            setWeekendDays((current) => ({
                              ...current,
                              saturday: event.target.checked,
                            }))
                          }
                        />
                        Saturday
                      </label>
                      <button
                        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        disabled={wfhLoading}
                        type="button"
                        onClick={() => void assignWeekends()}
                      >
                        Assign
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-4">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="text-center text-xs font-bold uppercase text-slate-500 py-1">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const [y, m] = weekendMonth.split("-");
                        const year = Number(y);
                        const month = Number(m) - 1;
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const firstDay = new Date(year, month, 1).getDay();
                        const hasManualWeekends = visibleWeekendDates.length > 0;
                        const cells: React.ReactNode[] = [];
                        for (let i = 0; i < firstDay; i++) {
                          cells.push(<div key={`e${i}`} />);
                        }
                        for (let day = 1; day <= daysInMonth; day++) {
                          const date = new Date(year, month, day);
                          const dateStr = `${weekendMonth}-${String(day).padStart(2, "0")}`;
                          const wd = visibleWeekendDates.find((item) =>
                            String(item.date).startsWith(dateStr)
                          );
                          const isDefaultSunday = !hasManualWeekends && date.getDay() === 0;
                          const isWeekend = !!(wd || isDefaultSunday);
                          cells.push(
                            <div
                              key={day}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const utcStr = `${weekendMonth}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
                                setConfirmDateStr(utcStr);
                                setConfirmDateIsWeekend(isWeekend);
                                setConfirmDateDay(day);
                                setShowDateConfirm(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  const utcStr = `${weekendMonth}-${String(day).padStart(2, "0")}T00:00:00.000Z`;
                                  setConfirmDateStr(utcStr);
                                  setConfirmDateIsWeekend(isWeekend);
                                  setConfirmDateDay(day);
                                  setShowDateConfirm(true);
                                }
                              }}
                              className={`relative min-h-[80px] cursor-pointer rounded-lg border p-1.5 transition hover:shadow-sm ${isWeekend
                                ? "border-indigo-200 bg-indigo-50"
                                : "border-slate-100 bg-white hover:border-slate-300"
                                }`}
                            >
                              <span className="text-xs font-semibold text-slate-600">{day}</span>
                              {isWeekend && (
                                <div className="mt-1 flex items-center justify-between gap-1 rounded-md bg-indigo-100 px-1.5 py-1 text-[11px] font-medium text-indigo-700">
                                  <span>Weekend</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </div>

                  {showDateConfirm && (
                    <div
                      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setShowDateConfirm(false);
                      }}
                    >
                      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <h4 className="text-lg font-semibold text-slate-900">
                          {confirmDateIsWeekend ? "Remove weekend" : "Set as weekend"}
                        </h4>
                        <p className="mt-2 text-sm text-slate-600">
                          {confirmDateIsWeekend
                            ? `Remove weekend for ${weekendMonth}-${String(confirmDateDay).padStart(2, "0")}?`
                            : `Set ${weekendMonth}-${String(confirmDateDay).padStart(2, "0")} as a weekend?`}
                        </p>
                        <div className="mt-5 flex justify-end gap-3">
                          <button
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            type="button"
                            onClick={() => setShowDateConfirm(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            type="button"
                            disabled={wfhLoading}
                            onClick={() => {
                              setShowDateConfirm(false);
                              if (confirmDateIsWeekend) {
                                const wd = visibleWeekendDates.find((item) =>
                                  String(item.date).startsWith(confirmDateStr.slice(0, 10))
                                );
                                if (wd) {
                                  void deleteWeekend(wd.date);
                                } else {
                                  void excludeDefaultSunday(confirmDateStr);
                                }
                              } else {
                                void assignWeekendDate(confirmDateStr);
                              }
                            }}
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {role === "project-manager" ||
          role === "qa-tester" ||
          role === "finance" ||
          role === "admin" ? (
          <section className="rounded-2xl border overflow-y-auto h-auto max-h-[500px] border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
            <div className="mb-5 border-l-4 border-cyan-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900">
                Team Onboarding Codes
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Share these codes with new team members
              </p>
            </div>
            {managerTeams.length === 0 ? (
              <p className="text-sm text-slate-500">
                Create a team to generate employee onboarding codes.
              </p>
            ) : (
              <div className="space-y-3">
                {managerTeams.map((teamItem) => {
                  const code = String(teamItem.joinCode ?? "");
                  const otherCode = String(teamItem.otherJoinCode ?? "");
                  const teamName = String(teamItem.name ?? "Team");
                  return (
                    <div
                      key={String(teamItem.id)}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {teamName}
                        </p>
                        <span className="text-xs text-slate-500">
                          {Number(teamItem.employeeCount ?? 0)} employees
                        </span>
                      </div>
                      {[
                        { code, label: "Team code" },
                        ...(otherCode
                          ? [{ code: otherCode, label: "Others code" }]
                          : []),
                      ].map((item) => (
                        <div className="mb-3 last:mb-0" key={item.code}>
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              {item.label}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">
                                {item.code}
                              </p>
                              <button
                                aria-label={`Copy ${teamName} ${item.label}`}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.code);
                                  showToast(
                                    `${teamName} ${item.label.toLowerCase()} copied.`,
                                  );
                                }}
                                title="Copy code"
                                type="button"
                              >
                                <Copy size={20} />
                              </button>
                            </div>
                          </div>
                          <button
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                            onClick={() => {
                              const joinUrl = `${window.location.origin}/join?code=${item.code}`;
                              navigator.clipboard.writeText(joinUrl);
                              showToast(
                                `${teamName} ${item.label.toLowerCase()} join URL copied.`,
                              );
                            }}
                            type="button"
                          >
                            <Users size={16} />
                            Copy {item.label} Join URL
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {inApprovedCompany ? (
          <section className={sectionClass}>
            <div className="mb-5 border-l-4 border-indigo-500 pl-4">
              <h3 className="text-base font-semibold text-slate-900">Document Letters</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Request official company letters or send your resignation
              </p>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Submit a request to HR for an official document letter or submit your resignation letter.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
                type="button"
                onClick={() => {
                  setDocLetterMode("request");
                  setShowDocLetterModal(true);
                }}
              >
                Request Document Letter
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setDocLetterMode("send");
                  setShowDocLetterModal(true);
                }}
              >
                Send Resignation Letter
              </button>
            </div>
          </section>
        ) : null}

        <section className={sectionClass}>
          <div className="mb-5 border-l-4 border-rose-500 pl-4">
            <h3 className="text-base font-semibold text-slate-900">Security</h3>
            <p className="mt-0.5 text-sm text-slate-500">Password &amp; account management</p>
          </div>
          {passwordResetRequired ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              You signed in with a reset link. Create a new password to finish
              securing your account.
            </p>
          ) : null}

          <form className="mt-4 space-y-3" onSubmit={updatePassword}>
            {!passwordResetRequired ? (
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
                placeholder="Current password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            ) : null}

            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
            />

            <ActionButton variant="primary">
              Update password
            </ActionButton>
          </form>

          <ActionButton
            variant="danger"
            className="mt-5"
            onClick={() => setModal(true)}
          >
            <Trash2 size={16} />
            Delete account
          </ActionButton>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
          <div className="mb-5 border-l-4 border-slate-400 pl-4">
            <h3 className="text-base font-semibold text-slate-900">Release Notes</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Version, last update, and recent changes.
            </p>
          </div>
          <VersionPanel />
        </section>

        <MonthlyCheckBox sectionClass={sectionClass} showToast={showToast} />
      </div>

      {showDocLetterModal ? (
        <DocumentLetterModal
          mode={docLetterMode}
          onClose={() => setShowDocLetterModal(false)}
          onSuccess={() => { setShowDocLetterModal(false); void refresh(true); }}
          showToast={showToast}
        />
      ) : null}

      {/* Modal */}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete account?
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
              <br />
              Type <span className="font-semibold text-rose-600">
                DELETE
              </span>{" "}
              to confirm.
            </p>

            <input
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setModal(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>

              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={deleteAccount}
              >
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {companyActionModal && companyActionType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {companyActionType === "hold"
                ? company?.status === "frozen"
                  ? "Un-freeze Company?"
                  : "Hold & Freeze Company?"
                : "TakeDown Company?"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This action requires typing{" "}
              <span className="font-semibold">Confirm</span> before it will
              proceed.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {companyActionType === "hold"
                ? company?.status === "frozen"
                  ? "Un-freezing re-activates the company so members can work, join, and process finance again."
                  : "Freezing stops all joining, finance, and work activity. Use Un-freeze to restore later."
                : "This permanently deletes the company, all teams, boards, tasks, notifications, and related data. This cannot be undone."}
            </p>

            <input
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
              placeholder="Type Confirm"
              value={companyActionConfirm}
              onChange={(e) => setCompanyActionConfirm(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setCompanyActionModal(false);
                  setCompanyActionConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  String(companyActionConfirm ?? "")
                    .trim()
                    .toUpperCase() !== "CONFIRM" || companyActionLoading
                }
                onClick={executeCompanyAction}
              >
                {companyActionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {avatarDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete avatar?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove your current profile picture. You can upload a new one afterwards.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setAvatarDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deletingAvatar}
                onClick={() => void deleteAvatar()}
              >
                {deletingAvatar ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {setupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {setupStep === "send-otp" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">
                  Verify your email
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  We'll send a 6-digit OTP to{" "}
                  <strong>{String(profile?.email ?? "")}</strong> to verify your
                  account.
                </p>
                {setupError ? (
                  <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {setupError}
                  </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                    onClick={closeSetupModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={setupLoading}
                    onClick={() => void sendOtp()}
                    type="button"
                  >
                    {setupLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </>
            ) : null}

            {setupStep === "verify-otp" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">
                  Enter OTP
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Enter the 6-digit code sent to{" "}
                  <strong>{String(profile?.email ?? "")}</strong>.
                </p>
                {setupError ? (
                  <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {setupError}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-2">
                  {otpValue.map((digit, index) => (
                    <input
                      key={index}
                      className="h-12 w-12 rounded-xl border border-slate-300 text-center text-lg font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      id={`setup-otp-${index}`}
                      maxLength={1}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!/^\d?$/.test(value)) return;
                        const newOtp = [...otpValue];
                        newOtp[index] = value;
                        setOtpValue(newOtp);
                        if (value && index < 5) {
                          const next = document.getElementById(`setup-otp-${index + 1}`);
                          next?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                          const prev = document.getElementById(`setup-otp-${index - 1}`);
                          prev?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        if (paste.length === 6) {
                          const newOtp = paste.split("");
                          setOtpValue(newOtp);
                          setTimeout(() => {
                            const last = document.getElementById("setup-otp-5");
                            last?.focus();
                          }, 0);
                        }
                        e.preventDefault();
                      }}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                    />
                  ))}
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                    onClick={closeSetupModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={setupLoading || otpValue.join("").length !== 6}
                    onClick={() => void verifyOtp()}
                    type="button"
                  >
                    {setupLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              </>
            ) : null}

            {setupStep === "password" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">
                  Set password & choose role
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Create a password and select your role to complete setup.
                </p>
                {setupError ? (
                  <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {setupError}
                  </p>
                ) : null}
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Role
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={setupRole}
                      onChange={(e) => setSetupRole(e.target.value)}
                    >
                      <option value="employee">Employee</option>
                      <option value="project-manager">Project Manager</option>
                      <option value="qa-tester">QA Tester</option>
                      <option value="human-resource">Human Resource</option>
                      <option value="finance">Finance</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Password
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      minLength={8}
                      placeholder="At least 8 characters"
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                    onClick={closeSetupModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={setupLoading || setupPassword.length < 8}
                    onClick={() => void completeSetup()}
                    type="button"
                  >
                    {setupLoading ? "Saving..." : "Complete setup"}
                  </button>
                </div>
              </>
            ) : null}

            {setupStep === "done" ? (
              <>
                <div className="flex flex-col items-center py-4">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check size={28} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    Setup complete!
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Your role has been set to{" "}
                    <strong>{formatRole(setupRole)}</strong>.
                  </p>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                    onClick={() => setSetupModal(false)}
                    type="button"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

type MonthlyCheckItem = {
  key: string;
  label: string;
  value: number;
};

type MonthlyCheckResponse = {
  month: string;
  counts: {
    activeDays: number;
    present: number;
    leave: number;
    wfh: number;
    holidays: number;
    weekends: number;
    absent: number;
  };
  items: MonthlyCheckItem[];
};

const monthlyCheckColors: Record<string, string> = {
  present: "bg-emerald-500",
  leave: "bg-amber-500",
  wfh: "bg-sky-500",
  holidays: "bg-fuchsia-500",
  weekends: "bg-slate-400",
  absent: "bg-rose-500",
};

function MonthlyCheckBox({
  sectionClass,
  showToast,
}: {
  sectionClass: string;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<MonthlyCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const maxValue = useMemo(() => {
    const values = summary?.items.map((item) => item.value) ?? [];
    return Math.max(1, ...values);
  }, [summary]);

  useEffect(() => {
    let ignore = false;

    async function loadMonthlyCheck() {
      try {
        setLoading(true);
        const result = await apiFetch<MonthlyCheckResponse>(
          `/api/profile/monthly-check?month=${encodeURIComponent(month)}`,
        );
        if (!ignore) setSummary(result);
      } catch (err) {
        if (!ignore) {
          showToast(
            err instanceof Error ? err.message : "Unable to load monthly check.",
            "error",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadMonthlyCheck();
    return () => {
      ignore = true;
    };
  }, [month, showToast]);

  return (
    <section className={sectionClass}>
      <div className="mb-5 border-l-4 border-emerald-500 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Monthly Check</h3>
        <p className="mt-0.5 text-sm text-slate-500">Compare your attendance, leave, WFH, holidays, weekends, and absences.</p>
      </div>
      <input
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
      />

      <div className="mt-5 space-y-5">
        <div className="space-y-3">
          {(summary?.items ?? []).map((item) => {
            const width = `${Math.max(4, Math.round((item.value / maxValue) * 100))}%`;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-semibold text-slate-900">
                    {item.value} day{item.value === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${monthlyCheckColors[item.key] ?? "bg-slate-500"} transition-all`}
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}

          {!summary && !loading ? (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              Select a month to view your attendance comparison.
            </p>
          ) : null}
          {loading ? (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              Loading monthly check...
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Active days
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Counted after your join date.
              </p>
            </div>
            <p className="text-3xl font-semibold text-slate-950">
              {summary?.counts.activeDays ?? 0}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {summary?.items.map((item) => (
              <div className="rounded-md bg-white px-2 py-2" key={`stat-${item.key}`}>
                <p className="text-slate-500">{item.label}</p>
                <p className="font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TimelineTab({
  items,
  role,
}: {
  items: { title: string; body: string; date?: string }[];
  role: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
      <div className="mb-5 border-l-4 border-slate-400 pl-4">
        <h3 className="text-base font-semibold text-slate-900">Role Timeline</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Lifecycle events for your {role} account.
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const when = item.date ? new Date(item.date) : null;
          return (
            <div
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              key={`${item.title}-${item.date}`}
            >
              <div className="flex min-w-0 gap-3">
                <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.body}</p>
                </div>
              </div>
              {when ? (
                <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-left ring-1 ring-slate-100 sm:text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {when.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-400">
                    {when.toLocaleTimeString()}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
  const hrSuffix = selfId
    ? `-HR${selfId
      .replace(/[^a-fA-F0-9]/g, "")
      .toUpperCase()
      .slice(-6)}`
    : "";
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamModal, setTeamModal] = useState<AnyRecord | null>(null);
  const [kickModal, setKickModal] = useState<{
    teamId: string;
    employeeId: string;
    employeeName: string;
    teamName: string;
  } | null>(null);
  const [kickConfirmText, setKickConfirmText] = useState("");
  const [deleteTeamModal, setDeleteTeamModal] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [deleteTeamConfirmText, setDeleteTeamConfirmText] = useState("");
  const company =
    typeof profile?.company === "object" && profile.company
      ? (profile.company as AnyRecord)
      : null;
  const team =
    typeof profile?.team === "object" && profile.team
      ? (profile.team as AnyRecord)
      : null;
  const managerInsight = (insights?.manager as AnyRecord | undefined) ?? null;
  const managerTeams = Array.isArray(managerInsight?.teams)
    ? (managerInsight.teams as AnyRecord[])
    : [];
  const adminTeams = Array.isArray((insights?.admin as AnyRecord | undefined)?.teams)
    ? ((insights?.admin as AnyRecord).teams as AnyRecord[])
    : [];
  const transferTeams = role === "admin" ? adminTeams : managerTeams;
  const companyMembers = Array.isArray(insights?.companyMembers)
    ? (insights.companyMembers as AnyRecord[])
    : [];
  const replacementHrCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return (
      id && id !== selfId && String(member.role ?? "") === "human-resource"
    );
  });
  const replacementRoleCandidates = companyMembers.filter((member) => {
    const id = String(member.id ?? "");
    return id && id !== selfId && String(member.role ?? "") === String(role);
  });
  const pendingQuitNotice =
    (insights?.pendingQuitNotice as AnyRecord | undefined) ?? null;
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
  const createdTeamsCount = Number(managerInsight?.createdTeamsCount ?? managerTeams.length);
  const teamLimit = role === "human-resource" ? 2 : role === "admin" ? 10 : 5;
  const canCreateMoreTeams = createdTeamsCount < teamLimit;
  const companyJoinStatus = profile?.companyStatus
    ? String(profile.companyStatus)
    : "none";
  const teamJoinStatus = profile?.teamStatus
    ? String(profile.teamStatus)
    : "none";
  const pendingJoinStatus =
    companyJoinStatus === "pending" || teamJoinStatus === "pending"
      ? "pending"
      : teamJoinStatus !== "none"
        ? teamJoinStatus
        : companyJoinStatus;

  async function createCompany(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/company", {
      method: "POST",
      body: JSON.stringify({ name: companyName }),
    });
    showToast("Company registered.");
    await refresh();
  }

  async function joinCompany(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/company/join", {
        method: "POST",
        body: JSON.stringify({ code: companyCode }),
      });
      showToast("Join request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send join request.",
        "error",
      );
    }
  }

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    if (!canCreateMoreTeams) {
      showToast(
        `Team limit reached. ${role === "human-resource" ? "HR" : role === "admin" ? "Admins" : "Managers"} can create up to ${teamLimit} teams.`,
        "error",
      );
      return;
    }
    await apiFetch("/api/team", {
      method: "POST",
      body: JSON.stringify({ name: teamName }),
    });
    setTeamName("");
    showToast("Team created.");
    await refresh();
  }

  async function requestManagerQuit() {
    await apiFetch("/api/company/quit", { method: "POST" });
    showToast("Quit request sent.");
    await refresh();
  }

  async function requestHrQuit() {
    if (!replacementHrId) {
      showToast("Please select a replacement HR.", "error");
      return;
    }
    try {
      setRequestingHrQuit(true);
      await apiFetch("/api/company/quit", {
        method: "POST",
        body: JSON.stringify({ replacementHrId }),
      });
      setHrQuitModal(false);
      setReplacementHrId("");
      showToast("HR quit request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request quit.",
        "error",
      );
    } finally {
      setRequestingHrQuit(false);
    }
  }

  async function requestRoleQuit() {
    if (!replacementRoleUserId) {
      showToast("Please select a replacement first.", "error");
      return;
    }
    try {
      setRequestingRoleQuit(true);
      await apiFetch("/api/company/quit", {
        method: "POST",
        body: JSON.stringify({ replacementUserId: replacementRoleUserId }),
      });
      setRoleQuitModal(false);
      setReplacementRoleUserId("");
      showToast("Quit request sent to HR.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request quit.",
        "error",
      );
    } finally {
      setRequestingRoleQuit(false);
    }
  }

  async function requestTeamTransfer() {
    if (!teamTransferReplacementId) {
      showToast("Please select a replacement first.", "error");
      return;
    }
    if (teamTransferTeamIds.length === 0) {
      showToast("Please select at least one team to transfer.", "error");
      return;
    }
    try {
      setTeamTransferSubmitting(true);
      await apiFetch("/api/company/role-transfer", {
        method: "POST",
        body: JSON.stringify({ replacementUserId: teamTransferReplacementId, teamIds: teamTransferTeamIds }),
      });
      setTeamTransferTeamIds([]);
      setTeamTransferReplacementId("");
      showToast("Team transfer request sent to admin.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to request team transfer.",
        "error",
      );
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
    if (!reason) {
      showToast("Reason is required.", "error");
      return;
    }
    try {
      setCancellingQuit(true);
      await apiFetch("/api/quit/cancel", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setCancelQuitModal(false);
      setCancelQuitReason("");
      showToast("Quit request cancelled.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to cancel request.",
        "error",
      );
    } finally {
      setCancellingQuit(false);
    }
  }

  async function cancelJoinRequest() {
    if (
      String(cancelJoinConfirmText ?? "")
        .trim()
        .toUpperCase() !== "CANCEL"
    ) {
      showToast("Type CANCEL to confirm.", "error");
      return;
    }
    try {
      setCancellingJoin(true);
      await apiFetch("/api/join/cancel", {
        method: "POST",
      });
      setCancelJoinModal(false);
      setCancelJoinConfirmText("");
      showToast("Join request cancelled.");
      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to cancel request.",
        "error",
      );
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
    await apiFetch("/api/team/kick", {
      method: "POST",
      body: JSON.stringify({ teamId, employeeId }),
    });
    showToast("Employee removed from team.");
    setKickModal(null);
    setKickConfirmText("");
    await refresh();
  }

  async function deleteTeam(teamId: string) {
    await apiFetch("/api/team/delete", {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
    setDeleteTeamModal(null);
    setDeleteTeamConfirmText("");
    setTeamModal(null);
    showToast("Team deleted.");
    await refresh();
  }

  async function joinTeam(event: FormEvent) {
    event.preventDefault();
    try {
      const normalizedCode = String(teamCode ?? "")
        .trim()
        .toUpperCase();
      if (!normalizedCode) {
        showToast("Enter a join code first.", "error");
        return;
      }

      if (normalizedCode.startsWith("CO-")) {
        const data = await apiFetch<{ approvalNotifier?: "hr" | "admin" }>(
          "/api/company/join",
          {
            method: "POST",
            body: JSON.stringify({ code: normalizedCode }),
          },
        );
        showToast(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR."
            : "Join request sent to admin.",
        );
      } else if (normalizedCode.startsWith("TM-")) {
        const data = await apiFetch<{
          approvalNotifier?: "hr" | "manager" | "tester";
        }>("/api/team/join", {
          method: "POST",
          body: JSON.stringify({ code: normalizedCode }),
        });
        showToast(
          data.approvalNotifier === "hr"
            ? "Join request sent to HR."
            : data.approvalNotifier === "tester"
              ? "Join request sent to tester."
              : "Join request sent to manager.",
        );
      } else {
        showToast("Invalid join code. Use a CO- or TM- code.", "error");
        return;
      }

      await refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to send join request.",
        "error",
      );
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {role === "admin" && company?.status !== "taken-down" ? (
        profile?.companyStatus === "approved" ? (
          <CodePanel
            title="Onboarding"
            code={company?.adminJoinCode ? String(company.adminJoinCode) : undefined}
            label="Admin code"
            empty="Register a company to generate onboarding codes."
            showToast={showToast}
            secondaryCodes={
              company?.joinCode
                ? [{ code: String(company.joinCode), label: "HR code" }]
                : []
            }
          />
        ) : (
          <>
            {company ? null : (
              <CodePanel
                title="Create a company"
                code={undefined}
                label="HR code"
                empty="Register a company to generate onboarding codes."
                showToast={showToast}
              >
                <form className="mt-4 flex gap-2" onSubmit={createCompany}>
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5"
                    placeholder="Company name"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                  <ActionButton variant="primary">
                    Register
                  </ActionButton>
                </form>
              </CodePanel>
            )}
            <JoinPanel
              title="Join company as Admin"
              placeholder="Admin company code"
              value={companyCode}
              onChange={setCompanyCode}
              onSubmit={joinCompany}
              status={String(profile?.companyStatus ?? "none")}
              onCancelRequest={async () => {
                await apiFetch("/api/join/cancel", { method: "POST" });
                await refresh();
              }}
            />
          </>
        )
      ) : null}

      {role === "human-resource" && company?.status !== "taken-down" ? (
        profile?.companyStatus === "approved" ? (
          <>
            <CodePanel
              title="HR Staff Onboarding"
              code={undefined}
              label="Staff code"
              showToast={showToast}
              secondaryCodes={
                [
                  company?.managerJoinCode
                    ? {
                      code: `${String(company.managerJoinCode)}${hrSuffix}`,
                      label: "Manager code",
                    }
                    : null,
                  company?.testerJoinCode
                    ? {
                      code: `${String(company.testerJoinCode)}${hrSuffix}`,
                      label: "Tester code",
                    }
                    : null,
                  company?.financeJoinCode
                    ? {
                      code: `${String(company.financeJoinCode)}${hrSuffix}`,
                      label: "Finance code",
                    }
                    : null,
                  company?.employeeJoinCode
                    ? {
                      code: `${String(company.employeeJoinCode)}${hrSuffix}`,
                      label: "Employee code",
                    }
                    : null,
                  company?.otherJoinCode
                    ? {
                      code: `${String(company.otherJoinCode)}${hrSuffix}`,
                      label: "Others code",
                    }
                    : null,
                ].filter(Boolean) as { code: string; label: string }[]
              }
              empty="Generating HR staff onboarding codes. Refresh once if they do not appear."
            />
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-teal-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">HR Membership</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  To quit, nominate another approved HR. Approval goes to admin.
                </p>
              </div>
              <button
                className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  Boolean(insights?.pendingQuit) ||
                  replacementHrCandidates.length === 0
                }
                type="button"
                onClick={() => setHrQuitModal(true)}
              >
                {pendingQuitText("Request Quit Company")}
              </button>
              {insights?.pendingQuit ? (
                <button
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setCancelQuitModal(true)}
                >
                  Cancel Request
                </button>
              ) : null}
              {replacementHrCandidates.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Another approved HR is required before you can quit.
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <JoinPanel
            title="Join company as HR"
            placeholder="HR company code"
            value={companyCode}
            onChange={setCompanyCode}
            onSubmit={joinCompany}
            status={
              profile?.companyStatus ? String(profile.companyStatus) : undefined
            }
            onCancelRequest={() => setCancelJoinModal(true)}
          />
        )
      ) : null}

      {hrQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setHrQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Quit company (HR)</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Select replacement HR before submitting quit request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setHrQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Replacement HR
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={replacementHrId}
                onChange={(e) => setReplacementHrId(e.target.value)}
              >
                <option value="">Select HR</option>
                {replacementHrCandidates.map((member) => (
                  <option key={String(member.id)} value={String(member.id)}>
                    {String(member.name ?? "HR")} ({String(member.email ?? "")})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setHrQuitModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!replacementHrId || requestingHrQuit}
                type="button"
                onClick={() => void requestHrQuit()}
              >
                {requestingHrQuit ? "Submitting..." : "Submit quit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {roleQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRoleQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">
                  Quit company ({formatRole(String(role))})
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Assign another approved {formatRole(String(role))} before
                  quitting.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setRoleQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Replacement
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={replacementRoleUserId}
                onChange={(e) => setReplacementRoleUserId(e.target.value)}
              >
                <option value="">Select replacement</option>
                {replacementRoleCandidates.map((member) => (
                  <option key={String(member.id)} value={String(member.id)}>
                    {String(member.name ?? "Member")} (
                    {String(member.email ?? "")})
                  </option>
                ))}
              </select>
              {replacementRoleCandidates.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No approved replacement available with this role.
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setRoleQuitModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!replacementRoleUserId || requestingRoleQuit}
                type="button"
                onClick={() => void requestRoleQuit()}
              >
                {requestingRoleQuit ? "Submitting..." : "Submit quit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelQuitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCancelQuitModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Cancel quit request</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Tell the approver why you are cancelling this request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setCancelQuitModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              className="mt-4 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Reason for cancelling quit request"
              value={cancelQuitReason}
              onChange={(event) => setCancelQuitReason(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setCancelQuitModal(false)}
              >
                Keep request
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  !String(cancelQuitReason ?? "").trim() || cancellingQuit
                }
                type="button"
                onClick={() => void cancelQuitRequest()}
              >
                {cancellingQuit ? "Cancelling..." : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelJoinModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCancelJoinModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold">Cancel join request</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Type CANCEL to confirm you want to remove this pending join
                  request.
                </p>
              </div>
              <button
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                type="button"
                onClick={() => setCancelJoinModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <input
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
              placeholder="Type CANCEL"
              value={cancelJoinConfirmText}
              onChange={(event) => setCancelJoinConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                type="button"
                onClick={() => setCancelJoinModal(false)}
              >
                Keep request
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  String(cancelJoinConfirmText ?? "")
                    .trim()
                    .toUpperCase() !== "CANCEL" || cancellingJoin
                }
                type="button"
                onClick={() => void cancelJoinRequest()}
              >
                {cancellingJoin ? "Cancelling..." : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {["project-manager", "qa-tester", "human-resource", "finance", "admin"].includes(
        role,
      ) ? (
        profile?.companyStatus === "approved" ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-indigo-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {role === "human-resource"
                    ? "HR Team Management"
                    : role === "admin"
                      ? "Admin Team Management"
                      : "Manager Membership"}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  You are currently assigned to a company.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  {/* Company */}
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Company</span>

                    <span className="font-medium">
                      {company?.name ? String(company.name) : "Not assigned"}
                    </span>
                  </div>

                  {/* Team */}
                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Total Team</span>

                    <span className="font-medium">
                      {Array.isArray(managerTeams)
                        ? `${managerTeams.length} (${createdTeamsCount} created)`
                        : "No team created"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Status</span>

                    <span className="font-medium capitalize text-emerald-600">
                      {String(profile?.companyStatus)}
                    </span>
                  </div>

                  {/* Employees */}
                  {/* <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Employees</span>

                    <span className="font-medium">
                      {Array.isArray(team?.employees)
                        ? team.employees.length
                        : 0}
                    </span>
                  </div> */}
                </div>

                {/* Create Team */}
                {canCreateMoreTeams ? (
                  <form className="flex gap-2" onSubmit={createTeam}>
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5"
                      placeholder="Team name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />

                    <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
                      <Plus size={16} />
                    </button>
                  </form>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Team creation limit reached ({createdTeamsCount}/{teamLimit}).
                  </p>
                )}

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {role === "human-resource" ? "HR" : role === "admin" ? "Admins" : "Managers"} can create up
                  to {teamLimit} teams. Created: {createdTeamsCount}/{teamLimit} &middot; Total managed: {managerTeams.length}
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

                <button
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={() => setRoleQuitModal(true)}
                  type="button"
                >
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? (
                  <button
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setCancelQuitModal(true)}
                    type="button"
                  >
                    Cancel Request
                  </button>
                ) : null}
              </div>
            </section>

            {role === "human-resource" && managerTeams.length > 0 ? (
              <section className="rounded-2xl border overflow-y-auto max-h-[500px] border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)]">
                <div className="mb-5 border-l-4 border-teal-500 pl-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    HR Team Onboarding
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">Share these codes with new team members</p>
                </div>
                <div className="space-y-3">
                  {managerTeams.map((teamItem) => {
                    const code = String(teamItem.joinCode ?? "");
                    const otherCode = String(teamItem.otherJoinCode ?? "");
                    const teamName = String(teamItem.name ?? "Team");
                    return (
                      <div
                        key={String(teamItem.id)}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {teamName}
                          </p>
                          <span className="text-xs text-slate-500">
                            {Number(teamItem.employeeCount ?? 0)} employees
                          </span>
                        </div>
                        {[
                          { code, label: "Team code" },
                          ...(otherCode
                            ? [{ code: otherCode, label: "Others code" }]
                            : []),
                        ].map((item) => (
                          <div className="mb-3 last:mb-0" key={item.code}>
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                {item.label}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate font-mono text-sm font-semibold text-indigo-700">
                                  {item.code}
                                </p>
                                <button
                                  aria-label={`Copy ${teamName} ${item.label}`}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.code);
                                    showToast(
                                      `${teamName} ${item.label.toLowerCase()} copied.`,
                                    );
                                  }}
                                  title="Copy code"
                                  type="button"
                                >
                                  <Copy size={20} />
                                </button>
                              </div>
                            </div>
                            <button
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-sky-200"
                              onClick={() => {
                                const joinUrl = `${window.location.origin}/join?code=${item.code}`;
                                navigator.clipboard.writeText(joinUrl);
                                showToast(
                                  `${teamName} ${item.label.toLowerCase()} join URL copied.`,
                                );
                              }}
                              type="button"
                            >
                              <Users size={16} />
                              Copy {item.label} Join URL
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {managerTeams.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
                <button
                  className="flex w-full items-center justify-between"
                  onClick={() => setTeamTransferOpen((prev) => !prev)}
                  type="button"
                >
                  <div className="border-l-4 border-amber-500 pl-4">
                    <h3 className="text-base font-semibold text-slate-900">Team Transfer</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Transfer teams to another {formatRole(String(role))}. Admin approval required.
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${teamTransferOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {teamTransferOpen ? (
                  <div className="mt-5 space-y-4">
                    {managerTeams.map((t) => {
                      const tid = String(t.id ?? "");
                      const checked = teamTransferTeamIds.includes(tid);
                      return (
                        <label key={tid} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="size-4 accent-slate-900"
                            checked={checked}
                            onChange={() => {
                              setTeamTransferTeamIds((prev) =>
                                checked ? prev.filter((id) => id !== tid) : [...prev, tid]
                              );
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{String(t.name ?? "Team")}</p>
                            <p className="text-xs text-slate-500">
                              {Number(t.employeeCount ?? 0)} employees &middot; Created by {String(t.createdBy ?? "Unknown")}{t.createdByRole ? ` (${String(t.createdByRole)})` : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Replacement
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={teamTransferReplacementId}
                        onChange={(e) => setTeamTransferReplacementId(e.target.value)}
                      >
                        <option value="">Select replacement</option>
                        {replacementRoleCandidates.map((member) => (
                          <option key={String(member.id)} value={String(member.id)}>
                            {String(member.name ?? "Member")} ({String(member.email ?? "")})
                          </option>
                        ))}
                      </select>
                      {replacementRoleCandidates.length === 0 ? (
                        <p className="mt-2 text-xs text-amber-700">
                          No approved replacement available with this role.
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      disabled={!teamTransferReplacementId || teamTransferTeamIds.length === 0 || teamTransferSubmitting}
                      onClick={() => void requestTeamTransfer()}
                      type="button"
                    >
                      {teamTransferSubmitting ? "Submitting..." : "Submit Team Transfer Request"}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-cyan-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">{role === "admin" ? "All Teams History" : "Manager Team History"}</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {role === "admin" ? "View all teams in the company." : "Open a team to view employees and remove members."}
                </p>
              </div>
              <div className="mt-4 space-y-2">
                {(role === "admin" ? transferTeams : managerTeams).length > 0 ? (
                  (role === "admin" ? transferTeams : managerTeams).map((t) => (
                    <button
                      key={String(t.id)}
                      type="button"
                      onClick={() => setTeamModal(t)}
                      className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span>{String(t.name)}</span>
                      <span className="font-medium">
                        {Number(t.employeeCount ?? 0)} employees
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No teams yet.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <JoinPanel
              title="Join company"
              placeholder="Company code"
              value={companyCode}
              onChange={setCompanyCode}
              onSubmit={joinCompany}
              status={
                profile?.companyStatus
                  ? String(profile.companyStatus)
                  : undefined
              }
              onCancelRequest={() => setCancelJoinModal(true)}
            />

            <HistoryCard
              title="Manager Team History"
              rows={toManagerHistoryRows(insights)}
              hint="Teams created and employee joins."
            />
          </>
        )
      ) : null}
      {teamModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {String(teamModal.name)} employees
              </h3>
              <div className="flex items-center gap-2">
                {String(teamModal.managerId ?? "") === selfId ? (
                  <button
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                    onClick={() =>
                      setDeleteTeamModal({
                        teamId: String(teamModal.id),
                        teamName: String(teamModal.name ?? "Team"),
                      })
                    }
                    type="button"
                  >
                    Delete Team
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  onClick={() => setTeamModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {Array.isArray(teamModal.employees) &&
                teamModal.employees.length > 0 ? (
                (teamModal.employees as AnyRecord[]).map((emp) => (
                  <div
                    key={String(emp.id)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {String(emp.name ?? "Employee")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {String(emp.email ?? "")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                      onClick={() =>
                        setKickModal({
                          teamId: String(teamModal.id),
                          employeeId: String(emp.id),
                          employeeName: String(emp.name ?? "Employee"),
                          teamName: String(teamModal.name ?? "Team"),
                        })
                      }
                    >
                      Kick
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No employees in this team.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {kickModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Kick employee {kickModal.employeeName}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone.
              <br />
              Type <span className="font-semibold text-rose-600">KICK</span> to
              confirm.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              placeholder="Type KICK"
              value={kickConfirmText}
              onChange={(event) => setKickConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setKickModal(null);
                  setKickConfirmText("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={kickConfirmText !== "KICK"}
                onClick={() =>
                  void kickEmployee(kickModal.teamId, kickModal.employeeId)
                }
                type="button"
              >
                Confirm kick
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteTeamModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Delete team {deleteTeamModal.teamName}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              All employees will be removed from this team immediately.
              <br />
              Type <span className="font-semibold text-rose-600">
                DELETE
              </span>{" "}
              to confirm.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              placeholder="Type DELETE"
              value={deleteTeamConfirmText}
              onChange={(event) => setDeleteTeamConfirmText(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setDeleteTeamModal(null);
                  setDeleteTeamConfirmText("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleteTeamConfirmText !== "DELETE"}
                onClick={() => void deleteTeam(deleteTeamModal.teamId)}
                type="button"
              >
                Delete team
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {["employee", "others"].includes(role) ? (
        companyJoinStatus === "approved" ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
              <div className="mb-5 border-l-4 border-emerald-500 pl-4">
                <h3 className="text-base font-semibold text-slate-900">Membership</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  You are currently approved in this company.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Company</span>

                    <span className="font-medium">
                      {company?.name ? String(company.name) : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Team</span>

                    <span className="font-medium">
                      {team?.name ? String(team.name) : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Manager Name</span>

                    <span className="font-medium">
                      {typeof team?.manager === "object" && team?.manager
                        ? ((team.manager as { name?: string })?.name ??
                          "Not assigned")
                        : "Not assigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-4">
                    <span className="text-slate-500">Status</span>

                    <span className="font-medium capitalize text-emerald-600">
                      Company {String(profile?.companyStatus)}
                    </span>
                  </div>
                </div>

                {teamJoinStatus === "approved" ? (
                  <button
                    className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(insights?.pendingQuit)}
                    onClick={requestEmployeeQuit}
                  >
                    {pendingQuitText("Request Team Quit")}
                  </button>
                ) : null}
                <button
                  className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(insights?.pendingQuit)}
                  onClick={requestManagerQuit}
                >
                  {pendingQuitText("Request Quit Company")}
                </button>
                {insights?.pendingQuit ? (
                  <button
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => setCancelQuitModal(true)}
                    type="button"
                  >
                    Cancel Request
                  </button>
                ) : null}
              </div>
            </section>
            {teamJoinStatus !== "approved" ? (
              <JoinPanel
                title="Join team using code"
                placeholder="TM-... code"
                value={teamCode}
                onChange={setTeamCode}
                onSubmit={joinTeam}
                status={teamJoinStatus === "none" ? undefined : teamJoinStatus}
                onCancelRequest={() => setCancelJoinModal(true)}
              />
            ) : null}
            <HistoryCard
              title="Membership History"
              rows={toEmployeeHistoryRows(insights)}
              hint="Company/team switches and removals."
            />
          </>
        ) : (
          <>
            <JoinPanel
              title="Join using code"
              placeholder="CO-... or TM-... code"
              value={teamCode}
              onChange={setTeamCode}
              onSubmit={joinTeam}
              status={pendingJoinStatus}
              onCancelRequest={() => setCancelJoinModal(true)}
            />
            <HistoryCard
              title="Membership History"
              rows={toEmployeeHistoryRows(insights)}
              hint="Employee can join up to 2 teams."
            />
          </>
        )
      ) : null}
      {role === "admin" ? (
        <HistoryCard
          title="Team Overview"
          rows={toAdminHistoryRows(insights)}
          hint="Team name, owner, and employee count."
        />
      ) : null}
    </div>
  );
}
