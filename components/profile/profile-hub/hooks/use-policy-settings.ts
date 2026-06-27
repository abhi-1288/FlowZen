import { useState } from "react";
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
  const [minWorkHours, setMinWorkHours] = useState<number>(
    Math.max(1, Math.min(24, Number(company?.minWorkHours ?? 8))),
  );
  const [savingNoticePeriod, setSavingNoticePeriod] = useState(false);
  const [savingPaidLeave, setSavingPaidLeave] = useState(false);
  const [savingDayHour, setSavingDayHour] = useState(false);

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

  return {
    noticePeriodDays, setNoticePeriodDays,
    paidLeaveDays, setPaidLeaveDays,
    paidLeavePeriod, setPaidLeavePeriod,
    minWorkHours, setMinWorkHours,
    savingNoticePeriod,
    savingPaidLeave,
    savingDayHour,
    saveNoticePeriodOnly,
    savePaidLeaveOnly,
    saveDayHourOnly,
  };
}
