import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-utils";
import type { AnyRecord } from "../shared";

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

  const loadWfh = useCallback(async () => {
    if (!company) return;
    try {
      setWfhLoading(true);
      const res = await apiFetch<{ wfhDays: number; wfhPeriod: string; wfhCheckInMode: string; carryForwardWfhDays: boolean; wfhDates: { date: string; reason: string }[]; weekendDates?: { date: string; reason?: string }[] }>(
        "/api/company/wfh",
      );
      setWfhDays(res.wfhDays ?? 0);
      setWfhPeriod(res.wfhPeriod === "yearly" ? "yearly" : "monthly");
      setWfhMode(res.wfhCheckInMode === "wfh-only" ? "wfh-only" : "all-day");
      setCarryForwardWfhDays(res.carryForwardWfhDays ?? false);
      setWfhDates(res.wfhDates || []);
      setWeekendDates(res.weekendDates || []);
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

  const assignWeekends = useCallback(async () => {
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
  }, [weekendDays.saturday, weekendMonth, showToast]);

  const deleteWeekend = useCallback(async (date: string) => {
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
  }, [showToast]);

  const excludeDefaultSunday = useCallback(async (dateStr: string) => {
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
  }, [weekendMonth, showToast]);

  const assignWeekendDate = useCallback(async (dateStr: string) => {
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
  }, [showToast]);

  return {
    wfhDays, setWfhDays,
    wfhPeriod, setWfhPeriod,
    wfhMode, setWfhMode,
    carryForwardWfhDays, setCarryForwardWfhDays,
    wfhLoading,
    wfhDates, setWfhDates,
    weekendDates, setWeekendDates,
    weekendMonth, setWeekendMonth,
    weekendDays, setWeekendDays,
    showWfhAssignModal, setShowWfhAssignModal,
    showManageWfhModal, setShowManageWfhModal,
    showWeekendModal, setShowWeekendModal,
    showDateConfirm, setShowDateConfirm,
    confirmDateStr, setConfirmDateStr,
    confirmDateIsWeekend, setConfirmDateIsWeekend,
    confirmDateDay, setConfirmDateDay,
    loadWfh,
    saveWfhQuota,
    saveCarryForwardWfhOnly,
    updateWfhMode,
    visibleWeekendDates,
    assignWeekends,
    deleteWeekend,
    excludeDefaultSunday,
    assignWeekendDate,
  };
}
