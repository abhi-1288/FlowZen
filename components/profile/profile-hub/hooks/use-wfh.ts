import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";

export type WeekendDate = {
  date: string;
  reason?: string;
  kind?: string;
  region?: string;
};

export type WeekendExclusion = {
  date: string;
  reason?: string;
  region?: string;
};

type WeekendPayload = {
  weekendDates?: WeekendDate[];
  weekendExclusions?: WeekendExclusion[];
};

export function useWfh(
  company: AnyRecord | null,
  refresh: (silent?: boolean) => Promise<void>,
  showToast: (text: string, type?: "success" | "error") => void,
) {
  const [wfhDays, setWfhDays] = useState(0);
  const [wfhPeriod, setWfhPeriod] = useState<"monthly" | "yearly">("monthly");
  const [wfhMode, setWfhMode] = useState<"all-day" | "wfh-only">("all-day");
  const [carryForwardWfhDays, setCarryForwardWfhDays] = useState<boolean>(
    company?.carryForwardWfhDays === true,
  );
  const [wfhLoading, setWfhLoading] = useState(false);
  const [wfhDates, setWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [weekendDates, setWeekendDates] = useState<WeekendDate[]>([]);
  const [weekendExclusions, setWeekendExclusions] = useState<WeekendExclusion[]>([]);
  const [weekendMonth, setWeekendMonth] = useState(() => new Date().toISOString().slice(0, 7));
  // Both are opt-in: Sunday is a weekend by default, so the checkbox only needs
  // to be ticked when the admin wants to assign it explicitly (e.g. to restore
  // a Sunday they previously removed).
  const [weekendDays, setWeekendDays] = useState({ saturday: false, sunday: false });
  const [showWfhAssignModal, setShowWfhAssignModal] = useState(false);
  const [showManageWfhModal, setShowManageWfhModal] = useState(false);
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [showHolidayWeekendModal, setShowHolidayWeekendModal] = useState(false);
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const [confirmDateStr, setConfirmDateStr] = useState("");
  const [confirmDateIsWeekend, setConfirmDateIsWeekend] = useState(false);
  const [confirmDateDay, setConfirmDateDay] = useState(0);

  const loadWfh = useCallback(async () => {
    if (!company) return;
    try {
      setWfhLoading(true);
      const res = await apiFetch<{
        wfhDays: number;
        wfhPeriod: string;
        wfhCheckInMode: string;
        carryForwardWfhDays: boolean;
        wfhDates: { date: string; reason: string }[];
        weekendDates?: WeekendDate[];
        weekendExclusions?: WeekendExclusion[];
      }>("/api/company/wfh");
      setWfhDays(res.wfhDays ?? 0);
      setWfhPeriod(res.wfhPeriod === "yearly" ? "yearly" : "monthly");
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      setCarryForwardWfhDays(res.carryForwardWfhDays ?? false);
      setWfhDates(res.wfhDates || []);
      setWeekendDates(res.weekendDates || []);
      setWeekendExclusions(res.weekendExclusions || []);
    } catch {
      // ignore
    } finally {
      setWfhLoading(false);
    }
  }, [company]);

  useEffect(() => {
    void loadWfh();
  }, [loadWfh]);

  const saveWfhQuota = useCallback(async (): Promise<boolean> => {
    try {
      setWfhLoading(true);
      await apiFetch("/api/company/wfh", {
        method: "POST",
        body: JSON.stringify({ wfhDays, wfhPeriod, carryForwardWfhDays }),
      });
      showToast("WFH quota updated.", "success");
      setWfhLoading(false);
      void refresh(true);
      return true;
    } catch (err) {
      setWfhLoading(false);
      showToast(
        err instanceof Error ? err.message : "Failed to update WFH quota",
        "error",
      );
      return false;
    }
  }, [wfhDays, wfhPeriod, carryForwardWfhDays, showToast, refresh]);

  const saveCarryForwardWfhOnly = useCallback(async () => {
    try {
      setWfhLoading(true);
      await apiFetch("/api/company/wfh", {
        method: "POST",
        body: JSON.stringify({ carryForwardWfhDays }),
      });
      showToast("WFH carry-forward policy updated.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update WFH carry-forward",
        "error",
      );
    } finally {
      setWfhLoading(false);
    }
  }, [carryForwardWfhDays, showToast]);

  const updateWfhMode = useCallback(async (mode: "all-day" | "wfh-only") => {
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
  }, [showToast]);

  const visibleWeekendDates = useMemo(() => {
    return [...weekendDates]
      .filter((item) => String(item.date ?? "").startsWith(weekendMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weekendDates, weekendMonth]);

  const visibleWeekendExclusions = useMemo(() => {
    return [...weekendExclusions]
      .filter((item) => String(item.date ?? "").startsWith(weekendMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [weekendExclusions, weekendMonth]);

  const applyWeekendPayload = useCallback(
    async (payload: WeekendPayload | null) => {
      if (payload?.weekendDates) setWeekendDates(payload.weekendDates);
      if (payload?.weekendExclusions) setWeekendExclusions(payload.weekendExclusions);
      // The mutation response is company-wide; reload to keep the actor's
      // region-scoped view (and the WFH quota) in sync.
      await loadWfh();
    },
    [loadWfh],
  );

  const assignWeekends = useCallback(async () => {
    const days = [
      ...(weekendDays.saturday ? [6] : []),
      ...(weekendDays.sunday ? [0] : []),
    ];
    if (!days.length) {
      showToast("Select Saturday, Sunday, or both.", "error");
      return;
    }
    try {
      setWfhLoading(true);
      const res = await apiFetch<WeekendPayload>("/api/company/weekends", {
        method: "POST",
        body: JSON.stringify({ month: weekendMonth, days }),
      });
      await applyWeekendPayload(res);
      showToast("Weekend dates assigned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign weekends", "error");
    } finally {
      setWfhLoading(false);
    }
  }, [weekendDays.saturday, weekendDays.sunday, weekendMonth, showToast, applyWeekendPayload]);

  const assignHolidayWeekend = useCallback(
    async (startDate: string, endDate: string, reason: string) => {
      if (!startDate) {
        showToast("Select a start date.", "error");
        return;
      }
      if (!reason.trim()) {
        showToast("A reason is required for a holiday weekend.", "error");
        return;
      }
      try {
        setWfhLoading(true);
        const res = await apiFetch<WeekendPayload>("/api/company/weekends", {
          method: "POST",
          body: JSON.stringify({
            startDate,
            endDate: endDate || startDate,
            reason,
            kind: "holiday",
          }),
        });
        await applyWeekendPayload(res);
        setShowHolidayWeekendModal(false);
        showToast("Holiday weekend assigned and the company was notified.", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to assign holiday weekend",
          "error",
        );
      } finally {
        setWfhLoading(false);
      }
    },
    [showToast, applyWeekendPayload],
  );

  const deleteWeekend = useCallback(async (date: string) => {
    try {
      setWfhLoading(true);
      const res = await apiFetch<WeekendPayload>("/api/company/weekends", {
        method: "DELETE",
        body: JSON.stringify({ date }),
      });
      await applyWeekendPayload(res);
      showToast("Weekend date removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove weekend", "error");
    } finally {
      setWfhLoading(false);
    }
  }, [showToast, applyWeekendPayload]);

  const assignWeekendDate = useCallback(async (dateStr: string) => {
    try {
      setWfhLoading(true);
      const res = await apiFetch<WeekendPayload>("/api/company/weekends", {
        method: "POST",
        body: JSON.stringify({ date: dateStr }),
      });
      await applyWeekendPayload(res);
      showToast("Weekend date assigned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign weekend", "error");
    } finally {
      setWfhLoading(false);
    }
  }, [showToast, applyWeekendPayload]);

  return {
    wfhDays, setWfhDays,
    wfhPeriod, setWfhPeriod,
    wfhMode, setWfhMode,
    carryForwardWfhDays, setCarryForwardWfhDays,
    wfhLoading,
    wfhDates, setWfhDates,
    weekendDates, setWeekendDates,
    weekendExclusions, setWeekendExclusions,
    weekendMonth, setWeekendMonth,
    weekendDays, setWeekendDays,
    showWfhAssignModal, setShowWfhAssignModal,
    showManageWfhModal, setShowManageWfhModal,
    showWeekendModal, setShowWeekendModal,
    showHolidayWeekendModal, setShowHolidayWeekendModal,
    showDateConfirm, setShowDateConfirm,
    confirmDateStr, setConfirmDateStr,
    confirmDateIsWeekend, setConfirmDateIsWeekend,
    confirmDateDay, setConfirmDateDay,
    loadWfh,
    saveWfhQuota,
    saveCarryForwardWfhOnly,
    updateWfhMode,
    visibleWeekendDates,
    visibleWeekendExclusions,
    assignWeekends,
    assignHolidayWeekend,
    deleteWeekend,
    assignWeekendDate,
  };
}
