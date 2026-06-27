import { AnyRecord } from "../shared";

export function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getDateForDay(day: number | null, year: number, month: number) {
  if (!day) return null;
  return normalizeDate(new Date(year, month, day));
}

export function isBeforeAttendanceStart(day: number | null, attendanceStartDate: Date, year: number, month: number) {
  const date = getDateForDay(day, year, month);
  if (!date) return false;
  return date.getTime() < attendanceStartDate.getTime();
}

export function isToday(day: number | null, month: number, year: number, todayDate: Date) {
  if (!day) return false;
  return (
    day === todayDate.getDate() &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear()
  );
}

export function getAttendanceStatus(day: number | null, history: AnyRecord[], minWorkHours: number, year: number, month: number): 'present' | 'half-day' | 'absent' | null {
  if (!day) return null;
  const date = getDateForDay(day, year, month);
  if (!date) return null;
  const entry = history.find((e: any) => {
    const entryDate = normalizeDate(new Date(e.date));
    return entryDate.getTime() === date.getTime();
  });
  if (!entry) return null;
  if (!entry.checkIn || !entry.checkOut) return 'present';
  const diff = new Date(String(entry.checkOut)).getTime() - new Date(String(entry.checkIn)).getTime();
  const hrs = diff / 3600000;
  const threshold = minWorkHours / 2;
  if (hrs < threshold) return 'absent';
  if (hrs < minWorkHours) return 'half-day';
  return 'present';
}

export function isCheckedInDay(day: number | null, history: AnyRecord[], minWorkHours: number, year: number, month: number) {
  const status = getAttendanceStatus(day, history, minWorkHours, year, month);
  return status === 'present' || status === 'half-day';
}

export function isPastDay(day: number | null, todayDate: Date, year: number, month: number) {
  const date = getDateForDay(day, year, month);
  if (!date) return false;
  return date.getTime() < todayDate.getTime();
}

export function isOwnRequest(req: any, currentUserId?: string) {
  return String(req.requester?._id || req.requester) === currentUserId;
}

export function isOnLeave(day: number | null, requests: AnyRecord[], currentUserId: string | undefined, year: number, month: number) {
  if (!day) return false;
  const date = new Date(year, month, day);
  return requests.some((req: any) => {
    if (req.status !== "approved" || !isOwnRequest(req, currentUserId)) return false;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });
}

export function isOnWfh(day: number | null, wfhRequests: AnyRecord[], currentUserId: string | undefined, year: number, month: number) {
  if (!day) return false;
  const date = new Date(year, month, day);
  return wfhRequests.some((req: any) => {
    if (req.status !== "approved" || !isOwnRequest(req, currentUserId)) return false;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });
}

export function isPendingLeave(day: number | null, requests: AnyRecord[], currentUserId: string | undefined, year: number, month: number) {
  if (!day) return false;
  const date = new Date(year, month, day);
  return requests.some((req: any) => {
    if (!["pending", "hr-approved", "manager-approved"].includes(String(req.status)) || !isOwnRequest(req, currentUserId)) return false;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });
}

export function isHoliday(day: number | null, holidays: AnyRecord[], year: number, month: number) {
  if (!day) return false;
  const date = new Date(year, month, day);
  return holidays.some((holiday: any) => {
    const start = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  });
}

export function getWfhDetail(day: number | null, wfhRequests: AnyRecord[], year: number, month: number): AnyRecord | null {
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
}

export function getCompanyWfhDetail(day: number | null, companyWfhDates: { date: string; reason: string }[], year: number, month: number): { date: string; reason: string } | null {
  if (!day) return null;
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return companyWfhDates.find((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === date.getTime();
  }) || null;
}

export function isCompanyWfh(day: number | null, companyWfhDates: { date: string; reason: string }[], year: number, month: number) {
  return !!getCompanyWfhDetail(day, companyWfhDates, year, month);
}

export function currentHoliday(day: number | null, holidays: AnyRecord[], year: number, month: number): AnyRecord | null {
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
}

export function isAttendanceEnabled(profile: AnyRecord | null) {
  return Boolean(
    (profile?.companyStatus === "approved" && profile?.company) ||
    (profile?.teamStatus === "approved" && profile?.team),
  );
}

export function canExportAttendance(profile: AnyRecord | null) {
  return ["finance"].includes(String(profile?.role ?? ""));
}
