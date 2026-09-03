"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "./shared";
import { PolicyQuotasSection } from "./sections/policy-quotas-section";
import { PolicyConfigSection } from "./sections/policy-config-section";
import { ExitSettlementSection } from "./sections/exit-settlement-section";
import { usePolicySettings } from "./hooks/use-policy-settings";
import { useWfh } from "./hooks/use-wfh";

export function HrPolicyTab({
  company,
  profile,
  insights,
  actorRole,
  refresh,
  showToast,
}: {
  company: AnyRecord | null;
  profile: AnyRecord | null;
  insights: AnyRecord | null;
  actorRole: string;
  refresh: (silent?: boolean) => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const policy = usePolicySettings(company, refresh, showToast);
  const wfh = useWfh(company, refresh, showToast);

  const [policyInfo, setPolicyInfo] = useState<{
    foodAmount: number;
    travelAccommodationAmount: number;
    foodOptedOutMembers?: AnyRecord[];
    travelOptedOutMembers?: AnyRecord[];
    advanceSalaryEnabled?: boolean;
    pfPercentage?: number;
    esicPercentage?: number;
    tdsPercentage?: number;
  } | null>(null);
  const [salaryCycle, setSalaryCycle] = useState<{
    salaryCycleDay: number;
    salaryCycleStartDay: number | null;
    salaryCycleEndDay: number | null;
  } | null>(null);

  useEffect(() => {
    if (!company) return;
    apiFetch<{ foodAmount: number; travelAccommodationAmount: number; foodOptedOutMembers: AnyRecord[]; travelOptedOutMembers: AnyRecord[]; advanceSalaryEnabled: boolean; pfPercentage: number; esicPercentage: number; tdsPercentage: number }>("/api/finance/policy")
      .then(setPolicyInfo).catch(() => {});
    apiFetch<{ salaryCycleDay: number; salaryCycleStartDay: number | null; salaryCycleEndDay: number | null }>("/api/finance/salary-cycle")
      .then(setSalaryCycle).catch(() => {});
  }, [company]);

  const companyMembers = Array.isArray((insights?.hr as AnyRecord | undefined)?.members) ? (((insights?.hr as AnyRecord).members as AnyRecord[]) ?? []) : [];
  const profileId = String(profile?._id ?? profile?.id ?? "");
  const approvedMembersBesidesAdmin = companyMembers.filter((member) => {
    const memberId = String(member?._id ?? member?.id ?? "");
    return memberId !== profileId;
  }).length;
  const canUseEmptyCompanyControls = actorRole === "admin" && Boolean(company) && approvedMembersBesidesAdmin === 0;
  const canEdit = (actorRole === "human-resource" || canUseEmptyCompanyControls) && profile?.companyStatus === "approved";

  return (
    <div className="space-y-6">
      {canEdit ? (
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
          wfhDays={wfh.wfhDays}
          onWfhDaysChange={wfh.setWfhDays}
          wfhPeriod={wfh.wfhPeriod}
          onWfhPeriodChange={wfh.setWfhPeriod}
          wfhLoading={wfh.wfhLoading}
          onSaveWfhQuota={wfh.saveWfhQuota}
          carryForwardWfhDays={wfh.carryForwardWfhDays}
          onCarryForwardWfhChange={wfh.setCarryForwardWfhDays}
          minWorkHours={policy.minWorkHours}
          onMinWorkHoursChange={policy.setMinWorkHours}
          savingDayHour={policy.savingDayHour}
          onSaveDayHour={policy.saveDayHourOnly}
          identityCodeDigits={policy.identityCodeDigits}
          onIdentityCodeDigitsChange={policy.setIdentityCodeDigits}
          identityCodeStartRange={policy.identityCodeStartRange}
          onIdentityCodeStartRangeChange={policy.setIdentityCodeStartRange}
          identityCodeEndRange={policy.identityCodeEndRange}
          onIdentityCodeEndRangeChange={policy.setIdentityCodeEndRange}
          identityCodeNextNumber={policy.identityCodeNextNumber}
          onIdentityCodeNextNumberChange={policy.setIdentityCodeNextNumber}
          identityCodeRemaining={policy.identityCodeRemaining}
          identityCodeLoaded={policy.identityCodeLoaded}
          savingIdentityCode={policy.savingIdentityCode}
          onSaveIdentityCode={policy.saveIdentityCodeSettings}
          bulkImportFile={policy.bulkImportFile}
          onBulkImportFileChange={policy.setBulkImportFile}
          bulkPreview={policy.bulkPreview}
          onBulkPreviewClear={() => policy.setBulkPreview(null)}
          bulkImportLoading={policy.bulkImportLoading}
          bulkApplying={policy.bulkApplying}
          bulkResult={policy.bulkResult}
          onPreviewBulkImport={policy.previewBulkImport}
          onApplyBulkImport={policy.applyBulkImport}
        />
      ) : null}

      <ExitSettlementSection canEdit={canEdit} showToast={showToast} />

      <PolicyQuotasSection company={company} policyInfo={policyInfo} salaryCycle={salaryCycle} profile={profile} session={session as { user?: { id?: string } } | null} />
    </div>
  );
}
