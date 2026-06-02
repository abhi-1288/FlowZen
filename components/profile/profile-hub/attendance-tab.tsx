import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Info, LogOut, Pen, Plus, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/client-utils";
import { AnyRecord } from "./shared";

export function CalendarTab() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [history, setHistory] = useState<AnyRecord[]>([]);
  const [requests, setRequests] = useState<AnyRecord[]>([]);
  const [leavePolicy, setLeavePolicy] = useState<AnyRecord | null>(null);
  const [holidays, setHolidays] = useState<AnyRecord[]>([]);

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

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const getDateForDay = (day: number | null) => {
    if (!day) return null;
    return normalizeDate(new Date(year, month, day));
  };

  const isCheckedIn = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    return history.some(
      (entry) =>
        normalizeDate(new Date(String(entry.date))).getTime() ===
        date.getTime(),
    );
  };

  const isOnLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req) => {
      if (req.status !== "approved") return false;
      const start = new Date(String(req.startDate));
      const end = new Date(String(req.endDate));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isHoliday = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return holidays.some((holiday) => {
      const start = new Date(String(holiday.startDate));
      const end = new Date(String(holiday.endDate));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isPastDay = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    const today = normalizeDate(new Date());
    return date.getTime() < today.getTime();
  };

  const loadData = async () => {
    const [historyRes, requestsRes, holidaysRes] = await Promise.all([
      apiFetch<{ history: AnyRecord[] }>("/api/attendance/checkin").catch(
        () => ({ history: [] as AnyRecord[] }),
      ),
      apiFetch<{ requests: AnyRecord[]; leavePolicy?: AnyRecord }>("/api/attendance/leave").catch(
        () => ({ requests: [] as AnyRecord[], leavePolicy: null }),
      ),
      apiFetch<{ holidays: AnyRecord[] }>("/api/attendance/holidays").catch(
        () => ({ holidays: [] as AnyRecord[] }),
      ),
    ]);

    setHistory(historyRes.history ?? []);
    setRequests(requestsRes.requests ?? []);
    setHolidays(holidaysRes.holidays ?? []);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-8 flex items-center justify-center gap-4">
        <button
          onClick={prevMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
            {monthNames[month]}
          </div>
          <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
            {year}
          </div>
        </div>

        <button
          onClick={nextMonth}
          className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
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
                {/* Find days that belong to this column */}
                {Array.from({ length: numWeeks }).map((_, rowIndex) => {
                  const dayIndex = rowIndex * 7 + i;
                  const day = days[dayIndex];
                  if (day === undefined) return null;

                  const today = isToday(day);
                  const checkedIn = isCheckedIn(day);
                  const leave = isOnLeave(day);
                  const holiday = isHoliday(day);
                  const past = isPastDay(day);
                  return (
                    <div
                      key={rowIndex}
                      onClick={() => {
                        const date = getDateForDay(day);
                        if (date) {
                          setSelectedDate(date);
                        }
                      }}
                      role={day ? "button" : undefined}
                      tabIndex={day ? 0 : undefined}
                      title={
                        day
                          ? `View details for ${monthNames[month]} ${day}, ${year}`
                          : undefined
                      }
                      className={`relative cursor-pointer grid h-10 w-full place-items-center rounded-xl text-xs font-bold sm:h-14 sm:text-sm transition-all ${day
                        ? holiday
                          ? "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm hover:border-fuchsia-300 hover:bg-fuchsia-50"
                          : today
                            ? checkedIn
                              ? "bg-sky-100 text-sky-700 border border-sky-200 shadow-inner"
                              : "bg-white text-rose-600 border border-rose-200 shadow-sm hover:border-rose-300 hover:bg-rose-50"
                            : checkedIn
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                              : leave
                                ? "bg-emerald-100 text-rose-600 border border-emerald-200 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                                : past
                                  ? "bg-slate-100 text-slate-500 border border-slate-200 shadow-sm"
                                  : "bg-white shadow-sm border border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        : "opacity-0"
                        }`}
                    >
                      {day}
                      {day &&
                        (holiday ||
                          checkedIn ||
                          leave ||
                          (today && !checkedIn)) && (
                          <span className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5">
                            {holiday ? (
                              <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                            ) : checkedIn || leave ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-rose-600" />
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

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          history={history}
          requests={requests}
          holidays={holidays}
        />
      )}
    </section>
  );
}

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
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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
  const [showWfhFormModal, setShowWfhFormModal] = useState(false);
  const [showWfhRequestsModal, setShowWfhRequestsModal] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [wfhRejectingId, setWfhRejectingId] = useState<string | null>(null);
  const [wfhRejectionReason, setWfhRejectionReason] = useState("");

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const attendanceStartDate = useMemo(() => {
    const parseDate = (value: unknown) => {
      if (!value) return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : normalizeDate(date);
    };

    const companyJoined = parseDate(profile?.companyJoined);
    const teamJoined = parseDate(profile?.teamJoined);
    const createdAt = parseDate(profile?.createdAt);

    if (companyJoined && teamJoined) {
      return companyJoined.getTime() > teamJoined.getTime()
        ? companyJoined
        : teamJoined;
    }

    return (
      companyJoined || teamJoined || createdAt || normalizeDate(new Date(0))
    );
  }, [profile]);

  const loadData = async () => {
    const [hRes, cRes, rRes, holRes, wfhRes, wfhReqRes] = await Promise.all([
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
    ]);
    setHistory(hRes.history);
    setRequests(rRes.requests);
    setWfhRequests(wfhReqRes?.requests ?? []);
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

  const isAttendanceEnabled = Boolean(
    (profile?.companyStatus === "approved" && profile?.company) ||
    (profile?.teamStatus === "approved" && profile?.team),
  );
  const canExportAttendance = ["finance"].includes(String(profile?.role ?? ""));

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

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/api/attendance/leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
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

  const getDateForDay = (day: number | null) => {
    if (!day) return null;
    return normalizeDate(new Date(year, month, day));
  };

  const isBeforeAttendanceStart = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getTime() < attendanceStartDate.getTime();
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    return (
      day === todayDate.getDate() &&
      month === todayDate.getMonth() &&
      year === todayDate.getFullYear()
    );
  };

  const isCheckedIn = (day: number | null) => {
    if (!day) return false;
    const date = getDateForDay(day);
    if (!date) return false;
    return history.some((entry: any) => {
      const entryDate = normalizeDate(new Date(entry.date));
      return entryDate.getTime() === date.getTime();
    });
  };

  const isPastDay = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    return date.getTime() < todayDate.getTime();
  };

  const isWeekend = (day: number | null) => {
    const date = getDateForDay(day);
    if (!date) return false;
    
    const manualWeekendsThisMonth = companyWeekendDates.filter((item) => {
      const weekendDate = normalizeDate(new Date(item.date));
      return weekendDate.getFullYear() === year && weekendDate.getMonth() === month;
    });

    if (manualWeekendsThisMonth.length === 0) {
      return date.getDay() === 0;
    }

    return manualWeekendsThisMonth.some((item) => {
      const weekendDate = normalizeDate(new Date(item.date));
      return weekendDate.getTime() === date.getTime();
    });
  };

  const isOnLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req: any) => {
      if (req.status !== "approved") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isOnWfh = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return wfhRequests.some((req: any) => {
      if (req.status !== "approved") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isPendingLeave = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return requests.some((req: any) => {
      if (!["pending", "hr-approved", "manager-approved"].includes(String(req.status))) return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isHoliday = (day: number | null) => {
    if (!day) return false;
    const date = new Date(year, month, day);
    return holidays.some((holiday: any) => {
      const start = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const getWfhDetail = (day: number | null) => {
    if (!day) return null;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return wfhRequests.find((req: any) => {
      if (req.status !== "approved") return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }) || null;
  };

  const getCompanyWfhDetail = (day: number | null) => {
    if (!day) return null;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return companyWfhDates.find((d) => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      return dDate.getTime() === date.getTime();
    }) || null;
  };

  const isCompanyWfh = (day: number | null) => {
    return !!getCompanyWfhDetail(day);
  };

  const todayLeave = requests.some((req: any) => {
    if (req.status !== "approved") return false;
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

  const currentHoliday = (day: number | null) => {
    if (!day) return null;
    const date = new Date(year, month, day);
    return (
      holidays.find((holiday: any) => {
        const start = new Date(holiday.startDate);
        const end = new Date(holiday.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }) || null
    );
  };

  const weekDays = ["SUN.", "Mon.", "Tue.", "Wed.", "Thr.", "Fri.", "Sat."];

  if (!isAttendanceEnabled) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={exportAttendance}
                type="button"
              >
                Export Excel
              </button>
            </div>
          ) : null}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAskModal(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Ask
            </button>
            <button
              onClick={() => setShowViewModal(true)}
              className="relative rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
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
            </button>
            {profile?.role === "admin" && (
              <button
                onClick={() => setShowLeaveHistoryModal(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Manage Holidays
              </button>
            )}

            {(wfhCheckInMode === "all-day" || isTodayWfh) && (
              todayAttendance && !todayAttendance.checkOut ? (
                <button
                  disabled={isCheckingIn}
                  onClick={handleCheckOut}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
                  title="Check out for today"
                >
                  {isCheckingIn ? "Processing..." : "Check Out"}
                </button>
              ) : (!todayAttendance && !isHoliday(todayDate.getDate())) ? (
                <button
                  disabled={isCheckingIn || todayLeave || isHoliday(todayDate.getDate())}
                  onClick={handleCheckIn}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
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
                </button>
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

        {showAskModal && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Ask</h3>
                <button onClick={() => setShowAskModal(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-3">
                {profile?.role !== "admin" && (
                  <button
                    onClick={() => {
                      if (!canAskPaidLeave) {
                        showToast("Paid leave quota is used up. Missed dates will count as absent.", "error");
                        return;
                      }
                      setShowAskModal(false);
                      setShowLeaveModal(true);
                    }}
                    disabled={!canAskPaidLeave}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canAskPaidLeave ? "Paid leave quota used up." : "Request paid leave."}
                  >
                    Leave
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAskModal(false);
                    setShowWfhFormModal(true);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  WFH
                </button>
              </div>
            </div>
          </div>
        )}

        {showViewModal && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Requests</h3>
                <button onClick={() => setShowViewModal(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setShowRequestsModal(true);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Leave
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setShowWfhRequestsModal(true);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  WFH
                </button>
              </div>
            </div>
          </div>
        )}

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
                <button
                  type="button"
                  onClick={() => setShowDeleteHolidayConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
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
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectionReason("");
                    }}
                    className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
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
                  <button
                    onClick={() => {
                      setWfhRejectingId(null);
                      setWfhRejectionReason("");
                    }}
                    className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
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
            <button
              onClick={prevMonth}
              className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="border-r border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600">
                {monthNames[month]}
              </div>
              <div className="bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-900">
                {year}
              </div>
            </div>

            <button
              onClick={nextMonth}
              className="grid h-10 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
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
                    const checkedIn = isCheckedIn(day);
                    const leave = isOnLeave(day);
                    const wfh = isOnWfh(day);
                    const companyWfh = isCompanyWfh(day);
                    const pendingLeave = isPendingLeave(day);
                    const holiday = isHoliday(day);
                    const holidayDetails = currentHoliday(day);
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
                                : today
                                  ? checkedIn
                                    ? "bg-sky-100 text-sky-700 border border-sky-200 shadow-inner"
                                    : "bg-white text-rose-600 border border-rose-200 shadow-sm"
                                  : checkedIn
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm"
                                      : companyWfh
                                        ? "bg-teal-100 text-teal-700 border border-teal-200 shadow-sm"
                                        : wfh
                                          ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
                                          : leave
                                        ? "bg-amber-100 text-amber-900 border border-amber-200 shadow-sm"
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
                            (today && !checkedIn) ||
                            (past && checkedIn) ||
                            missed) && (
                            <span className="absolute right-1 top-1 rounded-full p-0.5">
                              {pendingLeave ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              ) : holiday ? (
                                <Calendar className="h-3.5 w-3.5 text-fuchsia-600" />
                              ) : leave ? (
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
        />
      )}
    </>
  );
}

function LeaveModal({
  onClose,
  onRefresh,
  showToast,
  leavePolicy,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
  leavePolicy?: AnyRecord | null;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    attachmentUrl: "",
  });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          attachmentUrl: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/leave", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("Leave request submitted!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit leave",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Ask Leave</h3>
        <p className="mt-1 text-sm text-slate-500">
          Submit a paid leave request for HR and admin approval.
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Remaining paid leave:{" "}
          <span className="font-semibold text-slate-900">
            {Math.max(0, Number(leavePolicy?.remainingPaidLeaveDays ?? 0))} day{Number(leavePolicy?.remainingPaidLeaveDays ?? 0) === 1 ? "" : "s"}
          </span>{" "}
          this {String(leavePolicy?.paidLeavePeriod ?? "monthly")} period.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Reason
            </label>
            <textarea
              required
              rows={3}
              placeholder="Why are you taking leave?"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Attachment (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                <Camera size={18} />
                <span>
                  {formData.attachmentUrl
                    ? "Image selected"
                    : "Upload medical/reason document"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {formData.attachmentUrl && (
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                  <img
                    src={formData.attachmentUrl}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, attachmentUrl: "" }))
                    }
                    className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HolidayModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/holidays", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("Holiday added successfully!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add holiday",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Add Holiday</h3>
        <p className="mt-1 text-sm text-slate-500">
          Create a future holiday for the organization.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditHolidayModal({
  holiday,
  onClose,
  onSave,
  onDelete,
  showToast,
}: {
  holiday: AnyRecord;
  onClose: () => void;
  onSave: (updates: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    title: String(holiday.title ?? ""),
    description: String(holiday.description ?? ""),
    startDate: holiday.startDate
      ? new Date(String(holiday.startDate)).toISOString().slice(0, 10)
      : "",
    endDate: holiday.endDate
      ? new Date(String(holiday.endDate)).toISOString().slice(0, 10)
      : "",
  });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update holiday",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete holiday",
        "error",
      );
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 relative">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Edit Holiday</h3>
            <p className="mt-1 text-sm text-slate-500">
              Update holiday details or remove it entirely.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Holiday Title
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Holiday name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional holiday note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                Start Date
              </label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">
                End Date
              </label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                type="submit"
                className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-500">
              Delete holiday "{String(holiday.title ?? "")}"? This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLeaveHistoryModal({
  requests,
  holidays,
  onClose,
  onEditHoliday,
  onDeleteHoliday,
  onAddHoliday,
}: {
  requests: AnyRecord[];
  holidays: AnyRecord[];
  onClose: () => void;
  onEditHoliday: (holiday: AnyRecord) => void;
  onDeleteHoliday: (holiday: AnyRecord) => void;
  onAddHoliday: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Manage Holidays
            </h3>
            <p className="text-sm text-slate-500">
              Create, update, or remove company holidays from one place.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddHoliday}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
            >
              Add Holiday
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-3 py-2 border text-left">Title</th>
                  <th className="px-3 py-2 border text-left">From</th>
                  <th className="px-3 py-2 border text-left">To</th>
                  <th className="px-3 py-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
                      No holidays available.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h: any) => (
                    <tr
                      key={h._id}
                      className="border-b bg-white hover:bg-slate-50 transition"
                    >
                      <td className="px-3 py-3 border">{h.title}</td>
                      <td className="px-3 py-3 border">
                        {h.startDate
                          ? new Date(h.startDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        {h.endDate
                          ? new Date(h.endDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 border">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => onEditHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteHoliday(h)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  currentUserId,
  onViewDay,
  userRole,
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
  userRole?: string;
}) {
  const [selectedLeave, setSelectedLeave] = useState<AnyRecord | null>(null);

  if (selectedLeave) {
    return (
      <LeaveDetailsModal
        leave={selectedLeave}
        onClose={() => setSelectedLeave(null)}
        onApprove={() => {
          onApprove(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        onReject={() => {
          onReject(String(selectedLeave._id));
          setSelectedLeave(null);
        }}
        currentUserId={currentUserId}
        onViewDay={onViewDay}
        userRole={userRole}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Leave Requests</h3>
            <p className="text-sm text-slate-500">
              Manage pending leave approvals and view status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-50 text-slate-400"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No leave requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                const isRequester =
                  req.requester?._id === currentUserId ||
                  req.requester === currentUserId;
                const step = String(req.currentStep ?? "hr");
                const canApprove =
                  !isRequester &&
                  ["pending", "hr-approved"].includes(String(req.status)) &&
                  (
                    (step === "admin" && String(userRole ?? "") === "admin") ||
                    (step === "hr" && ["human-resource", "admin"].includes(String(userRole ?? "")))
                  );

                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedLeave(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {req.requester?.name || "User"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {req.reason}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(req.startDate).toLocaleDateString()} -{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </span>
                          <span className="font-bold">{req.duration} days</span>
                        </div>
                      </div>

                      {/* Approval actions moved to the detailed modal. */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveDetailsModal({
  leave,
  onClose,
  onApprove,
  onReject,
  currentUserId,
  onViewDay,
  userRole,
}: {
  leave: AnyRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentUserId?: string;
  onViewDay?: (dateStr: string) => void;
  userRole?: string;
}) {
  const isRequester =
    (leave.requester as any)?._id === currentUserId ||
    leave.requester === currentUserId;
  const step = String(leave.currentStep ?? "hr");

  const canApprove =
    !isRequester &&
    ["pending", "hr-approved"].includes(String(leave.status)) &&
    (
      (step === "admin" && String(userRole ?? "") === "admin") ||
      (step === "hr" && ["human-resource", "admin"].includes(String(userRole ?? "")))
    );

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="relative h-32 bg-slate-900">
          <div className="absolute -bottom-8 left-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 grid place-items-center text-white">
              <Clock size={32} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <LogOut className="rotate-180" size={16} />
          </button>
        </div>

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {String((leave.requester as any)?.name || "User")}
              </h3>
              <p className="text-sm font-medium text-slate-500 capitalize">
                {String(leave.status)} Request
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${leave.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : leave.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
                }`}
            >
              {String(leave.status)}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl bg-slate-50 p-5">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Duration
              </p>
              <p className="text-sm font-bold text-slate-900">
                {Number(leave.duration)} Days
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Date Range
              </p>
              <p className="text-sm font-bold text-slate-900">
                {new Date(String(leave.startDate)).toLocaleDateString()} -{" "}
                {new Date(String(leave.endDate)).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason for Leave
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                {String(leave.reason)}
              </p>
            </div>

            {!!leave.attachmentUrl && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Attachments
                </p>
                <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={String(leave.attachmentUrl)}
                    alt="attachment"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <a
                    href={String(leave.attachmentUrl)}
                    download="attachment"
                    className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-xl">
                      View Original
                    </div>
                  </a>
                </div>
              </div>
            )}

            {leave.status === "rejected" && !!leave.rejectionReason && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-500">
                  Rejection Reason
                </p>
                <p className="mt-2 text-sm leading-relaxed text-rose-700 font-medium">
                  {String(leave.rejectionReason)}
                </p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-10 flex gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className="flex-1 rounded-2xl border border-rose-200 py-4 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-sm"
              >
                Reject
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20"
              >
                Approve
              </button>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Back to List
            </button>
          </div>
          {onViewDay && (
            <div className="mt-4">
              <button
                onClick={() => {
                  // close this modal and open day details for the start date
                  onClose();
                  try {
                    onViewDay(String(leave.startDate));
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="w-full mt-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                View Day Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayDetailsModal({
  date,
  onClose,
  history,
  requests,
  holidays,
  wfhRequests = [],
  companyWfhDates = [],
}: {
  date: Date;
  onClose: () => void;
  history: AnyRecord[];
  requests: AnyRecord[];
  holidays: AnyRecord[];
  wfhRequests?: AnyRecord[];
  companyWfhDates?: { date: string; reason: string }[];
}) {
  const attendance = history.find((h: any) => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === date.getTime();
  });

  const leave = requests.find((r: any) => {
    const start = new Date(String(r.startDate));
    const end = new Date(String(r.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const holiday = holidays.find((h: any) => {
    const start = new Date(String(h.startDate));
    const end = new Date(String(h.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const approvedWfh = wfhRequests.find((r: any) => {
    if (r.status !== "approved") return false;
    const start = new Date(String(r.startDate));
    const end = new Date(String(r.endDate));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });

  const companyWfh = companyWfhDates.find((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === date.getTime();
  });

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{date.toLocaleDateString()}</h3>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 font-medium">
            Close
          </button>
        </div>

        <div className="space-y-4">
          {approvedWfh && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-blue-800 flex items-center gap-1.5">
                  <Pen className="h-4 w-4 text-blue-600" /> Work From Home (Approved)
                </p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  Approved
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {String((approvedWfh as any).reason ?? "")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((approvedWfh as any).duration ?? "")} day(s)
              </p>
            </div>
          )}

          {!approvedWfh && companyWfh && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-teal-800 flex items-center gap-1.5">
                  <Pen className="h-4 w-4 text-teal-600" /> Company WFH Day
                </p>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">
                  Company
                </span>
              </div>
              {companyWfh.reason && (
                <p className="mt-1 text-sm text-slate-700">{companyWfh.reason}</p>
              )}
            </div>
          )}

          {attendance ? (
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-in</p>
                <p className="text-sm text-slate-600">
                  {new Date(String(attendance.checkIn)).toLocaleTimeString()}
                </p>
              </div>
              <br />
              <hr />
              <br />
              <div className="flex justify-between">
                <p className="text-sm font-bold text-slate-900">Check-out</p>
                <p className="text-sm text-slate-600">
                  {attendance.checkOut ? new Date(String(attendance.checkOut)).toLocaleTimeString() : "--"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">No attendance recorded</p>
            </div>
          )}

          {leave && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-800">Leave</p>
                {Boolean((leave as any).halfDay) && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                    Half-day
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {String((leave as any).reason ?? "")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((leave as any).duration ?? "")} day(s) •
                Status: {String((leave as any).status ?? "")}
              </p>
            </div>
          )}
          {holiday && (
            <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-fuchsia-800">Holiday</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {String((holiday as any).title ?? "Company holiday")}
                  </p>
                </div>
                <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-xs font-bold text-fuchsia-700">
                  Holiday
                </span>
              </div>
              {((holiday as any).description ?? "") && (
                <p className="mt-3 text-sm text-slate-700">
                  {String((holiday as any).description)}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Duration: {String((holiday as any).duration ?? "")} day(s)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WfhRequestModal({
  onClose,
  onRefresh,
  showToast,
}: {
  onClose: () => void;
  onRefresh: () => void;
  showToast: (text: string, type?: "success" | "error") => void;
}) {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/attendance/wfh", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      onRefresh();
      showToast("WFH request submitted!");
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit WFH request",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-slate-900">Request WFH</h3>
        <p className="mt-1 text-sm text-slate-500">
          Submit a Work From Home request for approval.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Start Date</label>
              <input
                required
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">End Date</label>
              <input
                required
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-slate-500">Reason</label>
            <textarea
              required
              rows={3}
              placeholder="Why are you requesting WFH?"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-950 focus:ring-0"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-slate-950 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WfhRequestsListModal({
  requests,
  onClose,
  onApprove,
  onReject,
  currentUserId,
  userRole,
}: {
  requests: AnyRecord[];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  currentUserId?: string;
  userRole?: string;
}) {
  const [selectedWfh, setSelectedWfh] = useState<AnyRecord | null>(null);

  if (selectedWfh) {
    return (
      <WfhDetailsModal
        wfh={selectedWfh}
        onClose={() => setSelectedWfh(null)}
        onApprove={() => {
          onApprove(String(selectedWfh._id));
          setSelectedWfh(null);
        }}
        onReject={() => {
          onReject(String(selectedWfh._id));
          setSelectedWfh(null);
        }}
        currentUserId={currentUserId}
        userRole={userRole}
      />
    );
  }

  const isManagerRole = userRole === "project-manager" || userRole === "qa-tester" || userRole === "admin";
  const isHrRole = userRole === "human-resource" || userRole === "admin";
  const isAdmin = userRole === "admin";

  const canApproveWfh = (req: AnyRecord) => {
    const reqRequester = req.requester as { _id?: string } | undefined;
    if (String(reqRequester?._id || req.requester) === currentUserId) return false;
    if (req.status === "rejected" || req.status === "approved") return false;
    const step = String(req.currentStep ?? "manager");
    if (step === "manager" && isManagerRole) return true;
    if (step === "hr" && isHrRole) return true;
    if (step === "admin" && isAdmin) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">WFH Requests</h3>
            <p className="text-sm text-slate-500">
              Manage WFH request approvals and view status.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-50 text-slate-400">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">No WFH requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req: any) => {
                const canApprove = canApproveWfh(req);

                return (
                  <div
                    key={req._id}
                    onClick={() => setSelectedWfh(req)}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-200 hover:bg-slate-100/50 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {req.requester?.name || "User"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${req.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                              }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{req.reason}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {new Date(String(req.startDate)).toLocaleDateString()} -{" "}
                            {new Date(String(req.endDate)).toLocaleDateString()}
                          </span>
                          <span className="font-bold">{Number(req.duration)} day{Number(req.duration) === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function WfhDetailsModal({
  wfh,
  onClose,
  onApprove,
  onReject,
  currentUserId,
  userRole,
}: {
  wfh: AnyRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentUserId?: string;
  userRole?: string;
}) {
  const isRequester =
    String((wfh.requester as any)?._id || wfh.requester) === currentUserId;
  const step = String(wfh.currentStep ?? "manager");
  const isManagerRole = userRole === "project-manager" || userRole === "qa-tester" || userRole === "admin";
  const isHrRole = userRole === "human-resource" || userRole === "admin";
  const isAdmin = userRole === "admin";

  const canApprove =
    !isRequester &&
    wfh.status !== "rejected" &&
    wfh.status !== "approved" &&
    (
      (step === "manager" && isManagerRole) ||
      (step === "hr" && isHrRole) ||
      (step === "admin" && isAdmin)
    );

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in zoom-in-95 fade-in duration-300 rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="relative h-32 bg-slate-900">
          <div className="absolute -bottom-8 left-6">
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20 grid place-items-center text-white">
              <Clock size={32} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <LogOut className="rotate-180" size={16} />
          </button>
        </div>

        <div className="p-8 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {String((wfh.requester as any)?.name || "User")}
              </h3>
              <p className="text-sm font-medium text-slate-500 capitalize">
                {String(wfh.status)} WFH Request
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${wfh.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : wfh.status === "rejected"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
                }`}
            >
              {String(wfh.status)}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Start Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(String(wfh.startDate)).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">End Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {new Date(String(wfh.endDate)).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Duration</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {Number(wfh.duration)} day{Number(wfh.duration) === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Reason</p>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{String(wfh.reason)}</p>
            </div>

            {String(wfh.rejectionReason || "") && (
              <div className="rounded-xl bg-rose-50 p-4 border border-rose-100">
                <p className="text-xs font-bold uppercase text-rose-600">Rejection Reason</p>
                <p className="mt-1 text-sm text-rose-700">{String(wfh.rejectionReason)}</p>
              </div>
            )}
          </div>

          {canApprove && (
            <div className="mt-8 flex gap-3">
              <button
                onClick={onReject}
                className="flex-1 rounded-xl border border-rose-200 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
              >
                Reject
              </button>
              <button
                onClick={onApprove}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
