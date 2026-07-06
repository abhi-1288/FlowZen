import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Check, ChevronLeft, ChevronRight, Pen, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { ActionButton, AnyRecord } from "./shared";
import { LeaveModal, RequestsListModal } from "./attendance/modals/leave-modals";
import { HolidayModal, EditHolidayModal, AdminLeaveHistoryModal } from "./attendance/modals/holiday-modals";
import { WfhRequestModal, WfhRequestsListModal } from "./attendance/modals/wfh-modals";
import { CheckOutRequestModal, CheckOutRequestsListModal } from "./attendance/modals/checkout-modals";
import { DayDetailsModal } from "./attendance/modals/day-details-modal";
import { AskModal, RequestsModal } from "./attendance/inline-modals";
import {
  getAttendanceStatus as getAttendanceStatusFn,
  getDateForDay as getDateForDayFn, getWfhDetail as getWfhDetailFn,
  isAttendanceEnabled as checkAttendanceEnabled,
  canExportAttendance as checkCanExport,
  isCompanyWfh as isCompanyWfhFn,
  isHoliday as isHolidayFn, isOnLeave as isOnLeaveFn, isOnWfh as isOnWfhFn,
  isOwnRequest as isOwnRequestFn,
  isPastDay as isPastDayFn, isPendingLeave as isPendingLeaveFn,
  isToday as isTodayFn, normalizeDate as normalizeDateFn,
} from "./attendance/utils";
export function AttendanceTab({
  profile,
  showToast,
}: {
  profile: AnyRecord | null;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const { data: session } = useSession();
  const [viewDate, setViewDate] = useState(new Date());
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showLeaveHistoryModal, setShowLeaveHistoryModal] = useState(false);
  const [showEditHolidayModal, setShowEditHolidayModal] = useState(false);
  const [showDeleteHolidayConfirm, setShowDeleteHolidayConfirm] =
    useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<AnyRecord | null>(
    null,
  );
  const [holidayToDelete, setHolidayToDelete] = useState<AnyRecord | null>(
    null,
  );
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [holidays, setHolidays] = useState<AnyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [serverToday, setServerToday] = useState<Date | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [wfhCheckInMode, setWfhCheckInMode] = useState<string>("all-day");
  const [companyWfhDates, setCompanyWfhDates] = useState<{ date: string; reason: string }[]>([]);
  const [companyWeekendDates, setCompanyWeekendDates] = useState<{ date: string; reason?: string }[]>([]);
  const [wfhDays, setWfhDays] = useState(0);
  const [wfhPeriod, setWfhPeriod] = useState("monthly");
  const [remainingWfhDays, setRemainingWfhDays] = useState(0);
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  const [exportFrom, setExportFrom] = useState(currentMonthStart.toISOString().slice(0, 10));
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10));
  const [leavePolicy, setLeavePolicy] = useState<AnyRecord | null>(null);
  const [wfhRequests, setWfhRequests] = useState<AnyRecord[]>([]);
  const [checkOutRequests, setCheckOutRequests] = useState<AnyRecord[]>([]);
  const [showCheckOutRequestsModal, setShowCheckOutRequestsModal] = useState(false);
  const [showWfhFormModal, setShowWfhFormModal] = useState(false);
  const [showWfhRequestsModal, setShowWfhRequestsModal] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [showCheckOutRequestModal, setShowCheckOutRequestModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [wfhRejectingId, setWfhRejectingId] = useState<string | null>(null);
  const [wfhRejectionReason, setWfhRejectionReason] = useState("");
  const [minWorkHours, setMinWorkHours] = useState(8);
  const normalizeDate = (date: Date) => normalizeDateFn(date);
  const attendanceStartDate = useMemo(() => {
    const parseDate = (value: unknown) => {
      if (!value) return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : normalizeDate(date);
    };
    const companyJoined = parseDate(profile?.companyJoined);
    const teamJoined = parseDate(profile?.teamJoined);
    const createdAt = parseDate(profile?.createdAt);
    return (
      companyJoined || teamJoined || createdAt || normalizeDate(new Date(0))
    );
  }, [profile]);
  const loadData = async () => {
    const [hRes,, rRes, holRes, wfhRes, wfhReqRes, coRes] = await Promise.all([
      apiFetch<{ history: AnyRecord[]; today?: string }>(
        "/api/attendance/checkin",
      ).catch(() => ({ history: [] as AnyRecord[], today: undefined })),
      apiFetch<{ checkout: AnyRecord[] }>("/api/attendance/checkout").catch(() => ({ checkout: [] as AnyRecord[] })),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/leave").catch(
        () => ({ requests: [] as AnyRecord[] }),
      ),
      apiFetch<{ holidays: AnyRecord[] }>("/api/attendance/holidays").catch(
        () => ({ holidays: [] as AnyRecord[] }),
      ),
      apiFetch<{ wfhDays: number; wfhPeriod: string; wfhCheckInMode?: string; wfhDates?: { date: string; reason: string }[]; weekendDates?: { date: string; reason?: string }[] }>("/api/company/wfh").catch(
        () => ({ wfhDays: 0, wfhPeriod: "monthly" as string, wfhCheckInMode: "all-day", wfhDates: [], weekendDates: [] }),
      ),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/wfh").catch(
        () => ({ requests: [] as AnyRecord[] }),
      ),
      apiFetch<{ requests: AnyRecord[] }>("/api/attendance/checkout-request").catch(
        () => ({ requests: [] as AnyRecord[] }),
      ),
    ]);
    setHistory(hRes.history);
    setMinWorkHours((hRes as any).minWorkHours ?? 8);
    setRequests(rRes.requests);
    setWfhRequests(wfhReqRes?.requests ?? []);
    setCheckOutRequests(coRes?.requests ?? []);
    setLeavePolicy((rRes as { leavePolicy?: AnyRecord | null }).leavePolicy ?? null);
    setHolidays(holRes.holidays);
    setWfhCheckInMode(wfhRes.wfhCheckInMode ?? "all-day");
    setCompanyWfhDates((wfhRes as any).wfhDates ?? []);
    setCompanyWeekendDates((wfhRes as any).weekendDates ?? []);
    setWfhDays(wfhRes.wfhDays ?? 0);
    setWfhPeriod(wfhRes.wfhPeriod ?? "monthly");
    setRemainingWfhDays(Math.max(0, Number((wfhReqRes as any)?.wfhPolicy?.remainingWfhDays ?? 0)));
    if (hRes.today) {
      const today = new Date(hRes.today);
      if (!Number.isNaN(today.getTime())) {
        setServerToday(today);
      }
    }
  };
  const isAttendanceEnabled = checkAttendanceEnabled(profile);
  const canExportAttendance = checkCanExport(profile);
  const exportAttendance = () => {
    if (!exportFrom || !exportTo) {
      showToast("Select a start and end date.", "error");
      return;
    }
    window.location.href = `/api/attendance/export?from=${encodeURIComponent(exportFrom)}&to=${encodeURIComponent(exportTo)}`;
  };
  useEffect(() => {
    if (!isAttendanceEnabled) return;
    loadData();
  }, [isAttendanceEnabled]);
  useEffect(() => {
    if (serverToday) {
      setViewDate(serverToday);
    }
  }, [serverToday]);
  const handleCheckIn = async () => {
    if (todayLeave) {
      showToast(
        "You are on approved leave today. Check-in is disabled.",
        "error",
      );
      return;
    }
    setIsCheckingIn(true);
    try {
      await apiFetch("/api/attendance/checkin", { method: "POST" });
      loadData();
      showToast("Checked in successfully!");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to check in",
        "error",
      );
    } finally {
      setIsCheckingIn(false);
    }
  };
  const handleCheckOut = async () => {
    setIsCheckingIn(true);
    try {
      await apiFetch("/api/attendance/checkout", { method: "POST" });
      loadData();
      showToast("Checked out successfully!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to check out", "error");
    } finally {
      setIsCheckingIn(false);
    }
  };
  const handleApprove = async (id: string, assignedAdmin?: string) => {
    try {
      await apiFetch(`/api/attendance/leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve", ...(assignedAdmin ? { assignedAdmin } : {}) }),
      });
      loadData();
      showToast("Request approved.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to approve",
        "error",
      );
    }
  };
  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await apiFetch(`/api/attendance/leave/${rejectingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", reason: rejectionReason }),
      });
      loadData();
      showToast("Request rejected.");
      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to reject",
        "error",
      );
    }
  };
  const handleWfhApprove = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/wfh/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      loadData();
      showToast("WFH request approved.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to approve WFH",
        "error",
      );
    }
  };
  const handleWfhReject = async () => {
    if (!wfhRejectingId) return;
    try {
      await apiFetch(`/api/attendance/wfh/${wfhRejectingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", reason: wfhRejectionReason }),
      });
      loadData();
      showToast("WFH request rejected.");
      setWfhRejectingId(null);
      setWfhRejectionReason("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to reject WFH",
        "error",
      );
    }
  };
  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke" }),
      });
      loadData();
      showToast("Leave request revoked.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to revoke",
        "error",
      );
    }
  };
  const handleWfhRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/wfh/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke" }),
      });
      loadData();
      showToast("WFH request revoked.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to revoke WFH",
        "error",
      );
    }
  };
  const handleEditHoliday = async (
    holiday: AnyRecord,
    updates: {
      title?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
    },
  ) => {
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "PUT",
        body: JSON.stringify({ id: holiday._id, ...updates }),
      });
      loadData();
      showToast("Holiday updated.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update holiday",
        "error",
      );
    }
  };
  const handleDeleteHoliday = async (holiday: AnyRecord) => {
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "DELETE",
        body: JSON.stringify({ id: holiday._id }),
      });
      loadData();
      showToast("Holiday deleted.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete holiday",
        "error",
      );
    }
  };
  const requestHolidayDelete = (holiday: AnyRecord) => {
    setHolidayToDelete(holiday);
    setShowDeleteHolidayConfirm(true);
  };
  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days: any[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  const numWeeks = Math.ceil(days.length / 7);
  const serverTodayDate = useMemo(() => {
    return normalizeDate(serverToday ?? new Date());
  }, [serverToday]);
  const todayDate = serverTodayDate;
  const getDateForDay = (day: number | null) => getDateForDayFn(day, year, month);
  const isBeforeAttendanceStart = (day: number | null) => {
    const date = getDateForDayFn(day, year, month);
    if (!date) return false;
    return date.getTime() < attendanceStartDate.getTime();
  };
  const isToday = (day: number | null) => isTodayFn(day, month, year, todayDate);
  const getAttendanceStatus = (day: number | null) => getAttendanceStatusFn(day, history, minWorkHours, year, month);
  const isPastDay = (day: number | null) => isPastDayFn(day, todayDate, year, month);
  const isWeekend = (day: number | null) => {
    const date = getDateForDayFn(day, year, month);
    if (!date) return false;
    const manualWeekendsThisMonth = companyWeekendDates.filter((item) => {
      const weekendDate = normalizeDateFn(new Date(item.date));
      return weekendDate.getFullYear() === year && weekendDate.getMonth() === month;
    });
    if (manualWeekendsThisMonth.length === 0) {
      return date.getDay() === 0;
    }
    return manualWeekendsThisMonth.some((item) => {
      const weekendDate = normalizeDateFn(new Date(item.date));
      return weekendDate.getTime() === date.getTime();
    });
  };
  const currentUserId = session?.user?.id;
  const isOwnRequest = (req: any) => isOwnRequestFn(req, currentUserId);
  const isOnLeave = (day: number | null) => isOnLeaveFn(day, requests, currentUserId, year, month);
  const isOnWfh = (day: number | null) => isOnWfhFn(day, wfhRequests, currentUserId, year, month);
  const isPendingLeave = (day: number | null) => isPendingLeaveFn(day, requests, currentUserId, year, month);
  const isHoliday = (day: number | null) => isHolidayFn(day, holidays, year, month);
  const getWfhDetail = (day: number | null) => getWfhDetailFn(day, wfhRequests, year, month);
  const isCompanyWfh = (day: number | null) => isCompanyWfhFn(day, companyWfhDates, year, month);
  const todayLeave = requests.some((req: any) => {
    if (req.status !== "approved" || !isOwnRequest(req)) return false;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return todayDate >= start && todayDate <= end;
  });
  const todayAttendance = history.find((entry: any) => {
    const entryDate = normalizeDate(new Date(entry.date));
    return entryDate.getTime() === todayDate.getTime();
  }) ?? null;
  const remainingPaidLeaveDays = Math.max(0, Number(leavePolicy?.remainingPaidLeaveDays ?? 0));
  const paidLeaveDays = Math.max(0, Number(leavePolicy?.paidLeaveDays ?? 0));
  const paidLeavePeriod = String(leavePolicy?.paidLeavePeriod ?? "monthly");
  const canAskPaidLeave = String(profile?.role ?? "") !== "admin" && remainingPaidLeaveDays > 0;
  const isTodayWfh = useMemo(() => {
    const todayTime = todayDate.getTime();
    return wfhRequests.some((req: any) => {
      if (req.status !== "approved") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return todayTime >= start.getTime() && todayTime <= end.getTime();
    });
  }, [wfhRequests, todayDate]);
  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];
  if (!isAttendanceEnabled) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-4xl font-extrabold tracking-tight text-slate-900">
            {todayDate.toLocaleDateString()}
          </p>
          <p className="max-w-md text-sm text-slate-500">
            Join a company or team to access attendance, leave, and holiday
            features. Right now only the current date is shown.
          </p>
        </div>
    </section>
  );
}
  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04),_0_1px_2px_-1px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_0_rgb(0_0_0_/_0.05)]">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold">Attendance Tracker</h3>
            <p className="text-sm text-slate-500">
              Monitor your daily presence and check-in history.
            </p>
          </div>
          {canExportAttendance ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <label className="text-xs font-medium text-slate-600">
                From
                <input
                  className="mt-1 block rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                  type="date"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                To
                <input
                  className="mt-1 block rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                  type="date"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                />
              </label>
              <ActionButton
                variant="approve"
                className="px-3"
                onClick={exportAttendance}
                type="button"
              >
                Export Excel
              </ActionButton>
            </div>
          ) : null}
          <div className="flex gap-2 flex-wrap">
            <ActionButton
              variant="secondary"
              onClick={() => setShowAskModal(true)}
            >
              Ask
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() => setShowViewModal(true)}
              className="relative"
            >
              Requests
              {(() => {
                const totalPending =
                  requests.filter((r) =>
                    ["pending", "hr-approved", "manager-approved"].includes(String(r.status))
                  ).length +
                  wfhRequests.filter((r) =>
                    ["pending", "manager-approved", "hr-approved"].includes(String(r.status))
                  ).length;
                return totalPending > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                    {totalPending}
                  </span>
                ) : null;
              })()}
            </ActionButton>
            {profile?.role === "admin" && (
              <ActionButton
                variant="secondary"
                onClick={() => setShowLeaveHistoryModal(true)}
              >
                Manage Holidays
              </ActionButton>
            )}
            {(wfhCheckInMode === "all-day" || isTodayWfh) && (
              todayAttendance && !todayAttendance.checkOut ? (
                <ActionButton
                  variant="primary"
                  disabled={isCheckingIn}
                  onClick={handleCheckOut}
                  title="Check out for today"
                >
                  {isCheckingIn ? "Processing..." : "Check Out"}
                </ActionButton>
              ) : (!todayAttendance && !isHoliday(todayDate.getDate())) ? (
                <ActionButton
                  variant="approve"
                  disabled={isCheckingIn || todayLeave || isHoliday(todayDate.getDate())}
                  onClick={handleCheckIn}
                  title={
                    todayLeave
                      ? "Today is approved leave, check-in disabled."
                      : isHoliday(todayDate.getDate())
                        ? "Today is a holiday, check-in disabled."
                        : "Check in for today."
                  }
                >
                  {isCheckingIn
                    ? "Checking..."
                    : todayLeave
                      ? "On Leave"
                      : "Check In"}
                </ActionButton>
              ) : null
            )}
          </div>
        </div>
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Paid leave policy:{" "}
          <span className="font-semibold text-slate-950">
            {paidLeaveDays} day{paidLeaveDays === 1 ? "" : "s"} {paidLeavePeriod}
          </span>
          . Remaining:{" "}
          <span className="font-semibold text-slate-950">
            {remainingPaidLeaveDays} day{remainingPaidLeaveDays === 1 ? "" : "s"}
          </span>
          .
        </div>
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          WFH policy:{" "}
          <span className="font-semibold text-slate-950">
            {wfhDays} day{wfhDays === 1 ? "" : "s"} {wfhPeriod}
          </span>
          . Remaining:{" "}
          <span className="font-semibold text-slate-950">
            {remainingWfhDays} day{remainingWfhDays === 1 ? "" : "s"}
          </span>
          .
        </div>
        <AskModal
          isOpen={showAskModal}
          onClose={() => setShowAskModal(false)}
          showToast={showToast}
          canAskPaidLeave={canAskPaidLeave}
          remainingWfhDays={remainingWfhDays}
          profile={profile}
          onLeave={() => { setShowAskModal(false); setShowLeaveModal(true); }}
          onWfh={() => { setShowAskModal(false); setShowWfhFormModal(true); }}
          onCheckout={() => { setShowAskModal(false); setShowCheckOutRequestModal(true); }}
        />
        <RequestsModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          pendingLeave={requests.filter((r) =>
            ["pending", "hr-approved", "manager-approved"].includes(String(r.status)),
          ).length}
          pendingWfh={wfhRequests.filter((r) =>
            ["pending", "manager-approved", "hr-approved"].includes(String(r.status)),
          ).length}
          checkOutCount={checkOutRequests.filter((r: any) => r.status === "pending").length}
          onLeaveClick={() => { setShowViewModal(false); setShowRequestsModal(true); }}
          onWfhClick={() => { setShowViewModal(false); setShowWfhRequestsModal(true); }}
          onCheckoutClick={() => { setShowViewModal(false); setShowCheckOutRequestsModal(true); }}
        />
        {showLeaveModal && (
          <LeaveModal
            onClose={() => setShowLeaveModal(false)}
            onRefresh={loadData}
            showToast={showToast}
            leavePolicy={leavePolicy}
          />
        )}
        {showHolidayModal && (
          <HolidayModal
            onClose={() => setShowHolidayModal(false)}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
        {showLeaveHistoryModal && (
          <AdminLeaveHistoryModal
            requests={requests}
            holidays={holidays}
            onClose={() => setShowLeaveHistoryModal(false)}
            onEditHoliday={(holiday) => {
              setSelectedHoliday(holiday);
              setShowEditHolidayModal(true);
            }}
            onDeleteHoliday={requestHolidayDelete}
            onAddHoliday={() => {
              setShowLeaveHistoryModal(false);
              setShowHolidayModal(true);
            }}
          />
        )}
        {showEditHolidayModal && selectedHoliday && (
          <EditHolidayModal
            holiday={selectedHoliday}
            onClose={() => {
              setShowEditHolidayModal(false);
              setSelectedHoliday(null);
            }}
            onSave={async (updates) => {
              if (!selectedHoliday) return;
              await handleEditHoliday(selectedHoliday, updates);
            }}
            onDelete={async () => {
              if (selectedHoliday) {
                await handleDeleteHoliday(selectedHoliday);
                setShowEditHolidayModal(false);
                setSelectedHoliday(null);
              }
            }}
            showToast={showToast}
          />
        )}
        {showDeleteHolidayConfirm && holidayToDelete && (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Confirm Delete
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Delete holiday "{String(holidayToDelete.title)}"? This action
                cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <ActionButton
                  variant="secondary"
                  className="flex-1"
                  type="button"
                  onClick={() => setShowDeleteHolidayConfirm(false)}
                >
                  Cancel
                </ActionButton>
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteHoliday(holidayToDelete);
                    setShowDeleteHolidayConfirm(false);
                    setHolidayToDelete(null);
                  }}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        {showRequestsModal && (
          <RequestsListModal
            requests={requests}
            onClose={() => setShowRequestsModal(false)}
            onApprove={handleApprove}
            onReject={(id) => setRejectingId(id)}
            onRevoke={handleRevoke}
            currentUserId={session?.user?.id}
            userRole={String(profile?.role ?? "")}
            onViewDay={(dateStr) => {
              setShowRequestsModal(false);
              setShowLeaveModal(false);
              setSelectedDate(new Date(dateStr));
            }}
          />
        )}
        {rejectingId && (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-md">
            <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Reject Request
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Please provide a reason for rejection.
              </p>
              <div className="mt-6 space-y-4">
                <textarea
                  required
                  rows={4}
                  placeholder="Reason for rejection (required)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all resize-none"
                />
                <div className="flex gap-3 pt-2">
                  <ActionButton
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectionReason("");
                    }}
                  >
                    Cancel
                  </ActionButton>
                  <button
                    disabled={!rejectionReason.trim()}
                    onClick={handleReject}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
                  >
                    Reject Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showCheckOutRequestModal && (
          <CheckOutRequestModal
            history={history}
            onClose={() => setShowCheckOutRequestModal(false)}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
        {showCheckOutRequestsModal && (
          <CheckOutRequestsListModal
            requests={checkOutRequests}
            onClose={() => setShowCheckOutRequestsModal(false)}
          />
        )}
        {showWfhFormModal && (
          <WfhRequestModal
            onClose={() => setShowWfhFormModal(false)}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}
        {showWfhRequestsModal && (
          <WfhRequestsListModal
            requests={wfhRequests}
            onClose={() => setShowWfhRequestsModal(false)}
            onApprove={handleWfhApprove}
            onReject={(id) => setWfhRejectingId(id)}
            onRevoke={handleWfhRevoke}
            currentUserId={session?.user?.id}
            userRole={String(profile?.role ?? "")}
          />
        )}
        {wfhRejectingId && (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-md">
            <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Reject WFH Request
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Please provide a reason for rejection.
              </p>
              <div className="mt-6 space-y-4">
                <textarea
                  required
                  rows={4}
                  placeholder="Reason for rejection (required)..."
                  value={wfhRejectionReason}
                  onChange={(e) => setWfhRejectionReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all resize-none"
                />
                <div className="flex gap-3 pt-2">
                  <ActionButton
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setWfhRejectingId(null);
                      setWfhRejectionReason("");
                    }}
                  >
                    Cancel
                  </ActionButton>
                  <button
                    disabled={!wfhRejectionReason.trim()}
                    onClick={handleWfhReject}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
                  >
                    Reject Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mb-8 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <ActionButton onClick={prevMonth} variant="secondary" className="h-10 w-12" aria-label="Previous month">
              <ChevronLeft size={20} />
            </ActionButton>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
                {monthNames[month]}
              </div>
              <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
                {year}
              </div>
            </div>
            <ActionButton onClick={nextMonth} variant="secondary" className="h-10 w-12" aria-label="Next month">
              <ChevronRight size={20} />
            </ActionButton>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map((wd, i) => (
              <div
                key={wd}
                className={`flex flex-col gap-3 rounded-2xl p-2 pb-6 transition-all ${i === 0
                  ? "bg-rose-50/50 text-rose-600 border border-rose-100/50"
                  : "bg-emerald-50/50 text-emerald-600 border border-emerald-100/50"
                  }`}
              >
                <span className="text-center text-[10px] font-black uppercase tracking-tighter sm:text-xs">
                  {wd}
                </span>
                <div className="space-y-2">
                  {Array.from({ length: numWeeks }).map((_, rowIndex) => {
                    const dayIndex = rowIndex * 7 + i;
                    const day = days[dayIndex];
                    if (day === undefined) return null;
                    const today = isToday(day);
                    const attStatus = getAttendanceStatus(day);
                    const checkedIn = attStatus === 'present' || attStatus === 'half-day';
                    const attAbsentStatus = attStatus === 'absent';
                    const halfDayStatus = attStatus === 'half-day';
                    const leave = isOnLeave(day);
                    const wfh = isOnWfh(day);
                    const companyWfh = isCompanyWfh(day);
                    const pendingLeave = isPendingLeave(day);
                    const holiday = isHoliday(day);
                    const past = isPastDay(day);
                    const weekend = isWeekend(day);
                    const beforeStart = isBeforeAttendanceStart(day);
                    const missed =
                      past &&
                      !checkedIn &&
                      !leave &&
                      !wfh &&
                      !companyWfh &&
                      !holiday &&
                      !pendingLeave &&
                      !weekend &&
                      !beforeStart;
                    return (
                      <div
                        key={rowIndex}
                        onClick={() => {
                          const date = getDateForDay(day);
                          if (date && !isBeforeAttendanceStart(day)) {
                            // Close other modals so the day details are visible
                            setShowLeaveModal(false);
                            setShowRequestsModal(false);
                            setRejectingId(null);
                            setSelectedDate(date);
                          }
                        }}
                        role={day ? "button" : undefined}
                        tabIndex={day ? 0 : undefined}
                        className={`relative cursor-pointer grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                          ? beforeStart
                            ? "bg-slate-100 text-slate-400 border border-slate-200 shadow-sm"
                            : pendingLeave
                              ? "bg-amber-50 text-amber-900 border border-amber-200 shadow-sm"
                              : holiday
                                ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm"
                                : halfDayStatus
                                  ? "bg-amber-100 text-amber-700 border border-amber-200 shadow-sm"
                                  : attAbsentStatus
                                    ? "bg-rose-50 text-rose-600 border border-rose-200 shadow-sm"
                                    : today
                                      ? checkedIn
                                        ? "bg-sky-100 text-sky-700 border border-sky-200 shadow-inner"
                                        : "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                      : checkedIn
                                        ? "bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm"
                                        : companyWfh
                                          ? "bg-teal-100 text-teal-700 border border-teal-200 shadow-sm"
                                          : wfh
                                            ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)] border border-[var(--color-primary-bg)] shadow-sm"
                                            : leave
                                          ? "bg-pink-100 text-pink-700 border border-pink-200 shadow-sm"
                                          : weekend
                                          ? "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm"
                                          : missed
                                            ? "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                            : "bg-white shadow-sm border border-slate-100 text-slate-700"
                          : "opacity-0"
                          }`}
                      >
                        {day}
                        {(day && (getWfhDetail(day) || isOnWfh(day) || companyWfh)) && (
                          <span className="absolute left-1 top-1 rounded-full p-0.5 shadow-sm">
                            <Pen className="h-3 w-3 text-emerald-600" />
                          </span>
                        )}
                        {day &&
                          (pendingLeave ||
                            holiday ||
                            leave ||
                            halfDayStatus ||
                            attAbsentStatus ||
                            (today && !checkedIn) ||
                            (past && checkedIn) ||
                            missed) && (
                            <span className="absolute right-1 top-1 rounded-full p-0.5">
                              {pendingLeave ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ) : holiday ? (
                                <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                              ) : attAbsentStatus ? (
                                <X className="h-3.5 w-3.5 text-rose-600" />
                              ) : leave ? (
                                <Check className="h-3.5 w-3.5 text-pink-600" />
                              ) : halfDayStatus ? (
                                <Check className="h-3.5 w-3.5 text-amber-600" />
                              ) : today && !checkedIn ? (
                                <X className="h-3.5 w-3.5 text-rose-600" />
                              ) : missed ? (
                                <X className="h-3.5 w-3.5 text-rose-600" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </span>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs font-semibold text-slate-600 bg-slate-50 py-3 px-6 rounded-full w-fit mx-auto border border-slate-200">
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-emerald-100 border border-emerald-300"></span> Present</div>
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-amber-100 border border-amber-300"></span> Half-Day</div>
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-[var(--color-primary-bg)] border border-[var(--color-primary-light)]"></span> WFH</div>
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-pink-100 border border-pink-300"></span> Leave</div>
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-rose-50 border border-rose-300"></span> Absent</div>
          <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-fuchsia-100 border border-fuchsia-300"></span> Holiday</div>
        </div>
      </section>
      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          history={history}
          requests={requests}
          holidays={holidays}
          wfhRequests={wfhRequests}
          companyWfhDates={companyWfhDates}
          minWorkHours={minWorkHours}
        />
      )}
    </>
  );
}
