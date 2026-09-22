import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";

export function usePolicySettings(
  company: AnyRecord | null,
  refresh: (silent?: boolean) => Promise<void>,
  showToast: (text: string, type?: "success" | "error") => void,
) {
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
  const [carryForwardLeaveDays, setCarryForwardLeaveDays] = useState<boolean>(
    company?.carryForwardLeaveDays === true,
  );
  const [minWorkHours, setMinWorkHours] = useState<number>(
    Math.max(1, Math.min(24, Number(company?.minWorkHours ?? 8))),
  );
  const [savingNoticePeriod, setSavingNoticePeriod] = useState(false);
  const [savingPaidLeave, setSavingPaidLeave] = useState(false);
  const [savingCarryForwardLeave, setSavingCarryForwardLeave] = useState(false);
  const [savingDayHour, setSavingDayHour] = useState(false);

  const [identityCodePrefix, setIdentityCodePrefix] = useState<string>("");
  const [identityCodeDigits, setIdentityCodeDigits] = useState<number | null>(null);
  const [identityCodeStartRange, setIdentityCodeStartRange] = useState<number | null>(null);
  const [identityCodeEndRange, setIdentityCodeEndRange] = useState<number | null>(null);
  const [identityCodeNextNumber, setIdentityCodeNextNumber] = useState<number | null>(null);
  const [identityCodeRemaining, setIdentityCodeRemaining] = useState<number | null>(null);
  const [identityCodeRegions, setIdentityCodeRegions] = useState<
    { region: string; startRange: number | null; endRange: number | null; nextNumber: number | null; remaining: number | null }[]
  >([]);
  const [mainOfficeLabel, setMainOfficeLabel] = useState<string>("");
  const [addressLabels, setAddressLabels] = useState<string[]>([]);
  const [canManageRegions, setCanManageRegions] = useState(false);
  const [identityCodeLoaded, setIdentityCodeLoaded] = useState(false);
  const [savingIdentityCode, setSavingIdentityCode] = useState(false);
  const [savingRegionIncrease, setSavingRegionIncrease] = useState(false);

  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<{
    preview: {
      row: number;
      userName: string;
      email: string;
      flowzenCode: string;
      originalCode: string;
      status: "ready" | "not-found" | "conflict" | "duplicate-email" | "code-taken" | "invalid-code";
      matchedUserId?: string;
      currentCode?: string;
    }[];
    summary: { total: number; ready: number; errors: number };
  } | null>(null);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ applied: number; errors: number } | null>(null);

  useEffect(() => {
    if (!company) return;
    apiFetch<{
      prefix: string;
      digits: number | null;
      startRange: number | null;
      endRange: number | null;
      nextNumber: number | null;
      remaining: number | null;
      regions: { region: string; startRange: number | null; endRange: number | null; nextNumber: number | null; remaining: number | null }[];
      mainOfficeLabel: string;
      addressLabels: string[];
      canManageRegions: boolean;
    }>("/api/hr/identity-code-settings", undefined, { toast: false })
      .then((data) => {
        setIdentityCodePrefix(data.prefix ?? "");
        setIdentityCodeDigits(data.digits);
        setIdentityCodeStartRange(data.startRange);
        setIdentityCodeEndRange(data.endRange);
        setIdentityCodeNextNumber(data.nextNumber);
        setIdentityCodeRemaining(data.remaining);
        setIdentityCodeRegions(Array.isArray(data.regions) ? data.regions : []);
        setMainOfficeLabel(data.mainOfficeLabel ?? "");
        setAddressLabels(Array.isArray(data.addressLabels) ? data.addressLabels : []);
        setCanManageRegions(data.canManageRegions === true);
        setIdentityCodeLoaded(true);
      })
      .catch(() => {
        setIdentityCodeLoaded(true);
      });
  }, [company]);

  async function previewBulkImport() {
    if (!bulkImportFile) {
      showToast("Select a file first.", "error");
      return;
    }
    try {
      setBulkImportLoading(true);
      setBulkResult(null);
      const formData = new FormData();
      formData.append("file", bulkImportFile);
      const data = await apiFetch<{
        preview: typeof bulkPreview extends infer T ? Extract<T, { preview: unknown }>["preview"] : never;
        summary: { total: number; ready: number; errors: number };
      }>("/api/hr/identity-code-bulk-update", {
        method: "POST",
        body: formData,
      });
      setBulkPreview(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to parse file.", "error");
    } finally {
      setBulkImportLoading(false);
    }
  }

  async function applyBulkImport() {
    if (!bulkImportFile) return;
    try {
      setBulkApplying(true);
      const formData = new FormData();
      formData.append("file", bulkImportFile);
      const data = await apiFetch<{ applied: number; errors: number }>("/api/hr/identity-code-bulk-update?confirm=true", {
        method: "POST",
        body: formData,
      });
      setBulkResult(data);
      setBulkPreview(null);
      setBulkImportFile(null);
      showToast(`Applied: ${data.applied} updated, ${data.errors} errors.`, data.errors > 0 ? "error" : "success");
      await refresh(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to apply updates.", "error");
    } finally {
      setBulkApplying(false);
    }
  }

  async function saveIdentityCodeSettings(): Promise<boolean> {
    try {
      setSavingIdentityCode(true);
      const body: Record<string, unknown> = {};
      body.prefix = identityCodePrefix;
      if (identityCodeDigits != null) body.digits = identityCodeDigits;
      if (identityCodeStartRange != null) body.startRange = identityCodeStartRange;
      if (identityCodeEndRange != null) body.endRange = identityCodeEndRange;
      if (identityCodeNextNumber != null) body.nextNumber = identityCodeNextNumber;
      body.regions = identityCodeRegions.map((region) => ({
        region: region.region,
        startRange: region.startRange ?? 0,
        endRange: region.endRange ?? 0,
      }));

      const data = await apiFetch<{
        prefix: string;
        digits: number | null;
        startRange: number | null;
        endRange: number | null;
        nextNumber: number | null;
        remaining: number | null;
        regions: { region: string; startRange: number | null; endRange: number | null; nextNumber: number | null; remaining: number | null }[];
        mainOfficeLabel: string;
        addressLabels: string[];
        canManageRegions: boolean;
      }>("/api/hr/identity-code-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setIdentityCodePrefix(data.prefix ?? "");
      setIdentityCodeDigits(data.digits);
      setIdentityCodeStartRange(data.startRange);
      setIdentityCodeEndRange(data.endRange);
      setIdentityCodeNextNumber(data.nextNumber);
      setIdentityCodeRemaining(data.remaining);
      setIdentityCodeRegions(Array.isArray(data.regions) ? data.regions : []);
      setMainOfficeLabel(data.mainOfficeLabel ?? "");
      setAddressLabels(Array.isArray(data.addressLabels) ? data.addressLabels : []);
      setCanManageRegions(data.canManageRegions === true);
      showToast("Identity code settings updated.", "success");
      setSavingIdentityCode(false);
      return true;
    } catch (err) {
      setSavingIdentityCode(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update identity code settings.",
        "error",
      );
      return false;
    }
  }

  async function requestRegionIncrease(
    region: string,
    newEndRange: number,
  ): Promise<boolean> {
    try {
      setSavingRegionIncrease(true);
      const data = await apiFetch<{
        requestId: string;
        approverName: string;
        status: string;
      }>("/api/hr/identity-code-range", {
        method: "POST",
        body: JSON.stringify({ region, newEndRange }),
      });
      setSavingRegionIncrease(false);
      showToast(
        data.approverName
          ? `Increase request sent to ${data.approverName} for approval.`
          : "Increase request sent for approval.",
        "success",
      );
      return true;
    } catch (err) {
      setSavingRegionIncrease(false);
      showToast(
        err instanceof Error ? err.message : "Unable to request range increase.",
        "error",
      );
      return false;
    }
  }

  async function saveNoticePeriodOnly(): Promise<boolean> {
    try {
      setSavingNoticePeriod(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ noticePeriodDays }),
      });
      showToast("Notice period updated.", "success");
      setSavingNoticePeriod(false);
      void refresh(true);
      return true;
    } catch (err) {
      setSavingNoticePeriod(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update notice period.",
        "error",
      );
      return false;
    }
  }

  async function savePaidLeaveOnly(): Promise<boolean> {
    try {
      setSavingPaidLeave(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ paidLeaveDays, paidLeavePeriod, carryForwardLeaveDays }),
      });
      showToast("Paid leave policy updated.", "success");
      setSavingPaidLeave(false);
      void refresh(true);
      return true;
    } catch (err) {
      setSavingPaidLeave(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update paid leave policy.",
        "error",
      );
      return false;
    }
  }

  async function saveDayHourOnly(): Promise<boolean> {
    try {
      setSavingDayHour(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ minWorkHours }),
      });
      showToast("Day-hour working policy updated.", "success");
      setSavingDayHour(false);
      void refresh(true);
      return true;
    } catch (err) {
      setSavingDayHour(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update day-hour policy.",
        "error",
      );
      return false;
    }
  }

  async function saveCarryForwardLeaveOnly(): Promise<boolean> {
    try {
      setSavingCarryForwardLeave(true);
      await apiFetch("/api/hr/policy", {
        method: "PATCH",
        body: JSON.stringify({ carryForwardLeaveDays }),
      });
      showToast("Leave carry-forward policy updated.", "success");
      setSavingCarryForwardLeave(false);
      void refresh(true);
      return true;
    } catch (err) {
      setSavingCarryForwardLeave(false);
      showToast(
        err instanceof Error ? err.message : "Unable to update leave carry-forward policy.",
        "error",
      );
      return false;
    }
  }

  return {
    noticePeriodDays, setNoticePeriodDays,
    paidLeaveDays, setPaidLeaveDays,
    paidLeavePeriod, setPaidLeavePeriod,
    carryForwardLeaveDays, setCarryForwardLeaveDays,
    minWorkHours, setMinWorkHours,
    savingNoticePeriod,
    savingPaidLeave,
    savingCarryForwardLeave,
    savingDayHour,
    saveNoticePeriodOnly,
    savePaidLeaveOnly,
    saveCarryForwardLeaveOnly,
    saveDayHourOnly,
    identityCodePrefix, setIdentityCodePrefix,
    identityCodeDigits, setIdentityCodeDigits,
    identityCodeStartRange, setIdentityCodeStartRange,
    identityCodeEndRange, setIdentityCodeEndRange,
    identityCodeNextNumber, setIdentityCodeNextNumber,
    identityCodeRemaining,
    identityCodeRegions, setIdentityCodeRegions,
    mainOfficeLabel,
    addressLabels,
    canManageRegions,
    identityCodeLoaded,
    savingIdentityCode,
    savingRegionIncrease,
    saveIdentityCodeSettings,
    requestRegionIncrease,
    bulkImportFile, setBulkImportFile,
    bulkPreview, setBulkPreview,
    bulkImportLoading,
    bulkApplying,
    bulkResult,
    previewBulkImport,
    applyBulkImport,
  };
}
