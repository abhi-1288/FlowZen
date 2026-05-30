import { FormEvent, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  Clipboard,
  Clock,
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
  AnyRecord,
  AvatarBadge,
  HistoryCard,
  Row,
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
  const [salaryRequesting, setSalaryRequesting] = useState(false);
  const [companyActionModal, setCompanyActionModal] = useState(false);
  const [companyActionType, setCompanyActionType] = useState<
    "hold" | "takedown" | null
  >(null);
  const [companyActionConfirm, setCompanyActionConfirm] = useState("");
  const [companyActionLoading, setCompanyActionLoading] = useState(false);

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
    "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";
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
  const [savingPolicy, setSavingPolicy] = useState(false);
  // WFH quota (HR)
  const [wfhDays, setWfhDays] = useState(0);
  const [wfhPeriod, setWfhPeriod] = useState<"monthly" | "yearly">("monthly");
  // WFH mode & dates (Admin)
  const [wfhMode, setWfhMode] = useState<"all-day" | "wfh-only">("all-day");
  const [wfhLoading, setWfhLoading] = useState(false);
  const [wfhDates, setWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [showWfhAssignModal, setShowWfhAssignModal] = useState(false);
  const [showManageWfhModal, setShowManageWfhModal] = useState(false);
  const [identityRequesting, setIdentityRequesting] = useState(false);
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

  async function savePolicy() {
    try {
      setSavingPolicy(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({
          noticePeriodDays,
          paidLeaveDays,
          paidLeavePeriod,
        }),
      });
      showToast("Policy updated.");
      await refresh(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Unable to update policy.",
        "error",
      );
    } finally {
      setSavingPolicy(false);
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
      await apiFetch(endpoint, { method: "POST" });
      showToast(
        companyActionType === "hold"
          ? "Hold & Freeze request submitted."
          : "TakeDown request submitted.",
      );
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
      const res = await apiFetch<{ wfhDays: number; wfhPeriod: string; wfhCheckInMode: string; wfhDates: { date: string; reason: string }[] }>(
        "/api/company/wfh",
      );
      setWfhDays(res.wfhDays ?? 0);
      setWfhPeriod(res.wfhPeriod === "yearly" ? "yearly" : "monthly");
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      setWfhDates(res.wfhDates || []);
    } catch (err) {
      // ignore
    } finally {
      setWfhLoading(false);
    }
  }

  useEffect(() => {
    void loadWfh();
  }, [company?.id]);

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

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold">Account</h3>
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 p-3">
            <AvatarBadge avatarUrl={avatarUrl} name={displayName} size="lg" />
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
            <Row
              label="Company"
              value={company?.name ? String(company.name) : undefined}
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
              label="Company Joined"
              value={
                profile?.company && profile?.companyJoined
                  ? new Date(
                      profile.companyJoined as string | Date,
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
            <Row
              label="Team status"
              value={
                profile?.teamStatus ? String(profile.teamStatus) : undefined
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
          {inApprovedCompany && role !== "admin" && !insights?.hasSalary ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">
                Salary not assigned yet?
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {role === "human-resource"
                  ? "Request admin to set up your salary record."
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
                      : "Request salary from HR"}
              </button>
            </div>
          ) : null}
        </section>

        {role === "human-resource" && profile?.companyStatus === "approved" ? (
          <section className={sectionClass}>
            <h3 className="text-lg font-semibold">Policy</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure notice period for your company.
            </p>

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
                disabled={savingPolicy}
                type="button"
                onClick={() => void savePolicy()}
              >
                {savingPolicy ? "Saving..." : "Save policy"}
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
                disabled={savingPolicy}
                type="button"
                onClick={() => void savePolicy()}
              >
                {savingPolicy ? "Saving..." : "Save paid leave"}
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
          </section>
        ) : null}

        {canUseEmptyCompanyControls ? (
          <section className={sectionClass}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Company controls</h3>
                <p className="mt-1 text-sm text-slate-500">
                  No approved members besides you remain in the company. Use
                  these controls carefully.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-lg border border-amber-200 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-200"
                onClick={() => {
                  setCompanyActionType("hold");
                  setCompanyActionModal(true);
                }}
              >
                Hold & Freeze Company
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
          </section>
        ) : null}

        {role === "admin" && company?.joinCode ? (
          <>
            <CodePanel
              title="HR Onboarding"
              code={String(company.joinCode)}
              label="HR code"
              empty="Register a company to generate an HR onboarding code."
              showToast={showToast}
            />

            <section className={sectionClass}>
              <h3 className="text-lg font-semibold">
                Work From Home (WFH) Settings
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Assign company-wide WFH dates and configure check-in behavior.
              </p>

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
          </>
        ) : null}

        {role === "project-manager" ||
        role === "qa-tester" ||
        role === "finance" ? (
          <section className="rounded-lg border overflow-y-auto max-h-[500px] border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={18} />
              <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
                Team Employee Onboarding
              </h3>
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
                                <Clipboard size={16} />
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

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold">Security</h3>
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

            <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
              Update password
            </button>
          </form>

          <button
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            onClick={() => setModal(true)}
          >
            <Trash2 size={16} />
            Delete account
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Release Notes</h3>
          <p className="mt-1 text-sm text-slate-500">
            Version, last update, and recent changes.
          </p>
          <VersionPanel />
        </section>
      </div>

      {/* Modal */}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {companyActionType === "hold"
                ? "Hold & Freeze Company?"
                : "TakeDown Company?"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This action requires typing{" "}
              <span className="font-semibold">Confirm</span> before it will
              proceed.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {companyActionType === "hold"
                ? "Freezing a company preserves its settings and prevents new activity."
                : "Taking down a company marks it for removal and locks access."}
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


    </>
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
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-semibold">Role Timeline</h3>
      <p className="mt-1 text-sm text-slate-500">
        Lifecycle events for your {role} account.
      </p>
      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const when = item.date ? new Date(item.date) : null;
          return (
            <div
              className="flex flex-col gap-3 rounded-lg border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              key={`${item.title}-${item.date}`}
            >
              <div className="flex min-w-0 gap-3">
                <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.body}</p>
                </div>
              </div>
              {when ? (
                <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-left sm:text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {when.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-500">
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
  const [cancelQuitModal, setCancelQuitModal] = useState(false);
  const [cancelQuitReason, setCancelQuitReason] = useState("");
  const [cancellingQuit, setCancellingQuit] = useState(false);
  const [cancelJoinModal, setCancelJoinModal] = useState(false);
  const [cancelJoinConfirmText, setCancelJoinConfirmText] = useState("");
  const [cancellingJoin, setCancellingJoin] = useState(false);
  const teamLimit = role === "human-resource" ? 2 : 5;
  const canCreateMoreTeams = managerTeams.length < teamLimit;
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
        `Team limit reached. ${role === "human-resource" ? "HR" : "Managers"} can create up to ${teamLimit} teams.`,
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
      {role === "admin" ? (
        <CodePanel
          title="HR Onboarding"
          code={company?.joinCode ? String(company.joinCode) : undefined}
          label="HR code"
          empty="Register a company to generate an HR onboarding code."
          showToast={showToast}
        >
          {!company ? (
            <form className="mt-4 flex gap-2" onSubmit={createCompany}>
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5"
                placeholder="Company name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
                Register
              </button>
            </form>
          ) : null}
        </CodePanel>
      ) : null}

      {role === "human-resource" ? (
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
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">HR Membership</h3>
              <p className="mt-1 text-sm text-slate-500">
                To quit, nominate another approved HR. Approval goes to admin.
              </p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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

      {["project-manager", "qa-tester", "human-resource", "finance"].includes(
        role,
      ) ? (
        profile?.companyStatus === "approved" ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">
                {role === "human-resource"
                  ? "HR Team Management"
                  : "Manager Membership"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                You are currently assigned to a company.
              </p>

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
                        ? `${managerTeams.length}/${teamLimit}`
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
                    Team limit reached ({managerTeams.length}/{teamLimit}).
                  </p>
                )}

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {role === "human-resource" ? "HR" : "Managers"} can create up
                  to {teamLimit} teams. Current: {managerTeams.length}/
                  {teamLimit}
                </p>
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
              <section className="rounded-lg border overflow-y-auto max-h-[500px] border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={18} />
                  <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-700">
                    HR Team Onboarding
                  </h3>
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
                                  <Clipboard size={16} />
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

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Manager Team History</h3>
              <p className="mt-1 text-sm text-slate-500">
                Open a team to view employees and remove members.
              </p>
              <div className="mt-4 space-y-2">
                {managerTeams.length > 0 ? (
                  managerTeams.map((t) => (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {String(teamModal.name)} employees
              </h3>
              <div className="flex items-center gap-2">
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
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
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
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
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
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Membership</h3>

              <p className="mt-1 text-sm text-slate-500">
                You are currently approved in this company.
              </p>

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
