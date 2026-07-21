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

  const [identityCodeDigits, setIdentityCodeDigits] = useState<number | null>(null);
  const [identityCodeStartRange, setIdentityCodeStartRange] = useState<number | null>(null);
  const [identityCodeEndRange, setIdentityCodeEndRange] = useState<number | null>(null);
  const [identityCodeNextNumber, setIdentityCodeNextNumber] = useState<number | null>(null);
  const [identityCodeRemaining, setIdentityCodeRemaining] = useState<number | null>(null);
  const [identityCodeLoaded, setIdentityCodeLoaded] = useState(false);
  const [savingIdentityCode, setSavingIdentityCode] = useState(false);

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
      digits: number | null;
      startRange: number | null;
      endRange: number | null;
      nextNumber: number | null;
      remaining: number | null;
    }>("/api/hr/identity-code-settings")
      .then((data) => {
        setIdentityCodeDigits(data.digits);
        setIdentityCodeStartRange(data.startRange);
        setIdentityCodeEndRange(data.endRange);
        setIdentityCodeNextNumber(data.nextNumber);
        setIdentityCodeRemaining(data.remaining);
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
      if (identityCodeDigits != null) body.digits = identityCodeDigits;
      if (identityCodeStartRange != null) body.startRange = identityCodeStartRange;
      if (identityCodeEndRange != null) body.endRange = identityCodeEndRange;
      if (identityCodeNextNumber != null) body.nextNumber = identityCodeNextNumber;

      const data = await apiFetch<{
        digits: number | null;
        startRange: number | null;
        endRange: number | null;
        nextNumber: number | null;
        remaining: number | null;
      }>("/api/hr/identity-code-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setIdentityCodeDigits(data.digits);
      setIdentityCodeStartRange(data.startRange);
      setIdentityCodeEndRange(data.endRange);
      setIdentityCodeNextNumber(data.nextNumber);
      setIdentityCodeRemaining(data.remaining);
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
    identityCodeDigits, setIdentityCodeDigits,
    identityCodeStartRange, setIdentityCodeStartRange,
    identityCodeEndRange, setIdentityCodeEndRange,
    identityCodeNextNumber, setIdentityCodeNextNumber,
    identityCodeRemaining,
    identityCodeLoaded,
    savingIdentityCode,
    saveIdentityCodeSettings,
    bulkImportFile, setBulkImportFile,
    bulkPreview, setBulkPreview,
    bulkImportLoading,
    bulkApplying,
    bulkResult,
    previewBulkImport,
    applyBulkImport,
  };
}
