import { Attendance, Company, CompanyPolicy, FinanceSalary, Holiday, JoinRequest, LeaveRequest, Notification, User } from "@/models";
import { emitNotification } from "@/lib/realtime";

const FINANCE_ROLES = new Set(["finance", "admin"]);

export function monthKey(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function getSalaryPeriod(month: string, policy: { salaryCycleDay?: number, salaryCycleStartDay?: number | null, salaryCycleEndDay?: number | null }): { periodStart: string; periodEnd: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDayOfCurrent = new Date(y, m, 0).getDate();
  const prevMonthStr = previousMonth(month);
  const [py, pm] = prevMonthStr.split("-").map(Number);
  const lastDayOfPrev = new Date(py, pm, 0).getDate();

  if (policy.salaryCycleStartDay && policy.salaryCycleEndDay) {
    const s = Math.min(policy.salaryCycleStartDay, lastDayOfPrev);
    const e = Math.min(policy.salaryCycleEndDay, lastDayOfCurrent);
    return {
      periodStart: `${prevMonthStr}-${String(s).padStart(2, "0")}`,
      periodEnd: `${month}-${String(e).padStart(2, "0")}`,
    };
  }

  const salaryCycleDay = policy.salaryCycleDay ?? 29;
  const cycleDay = Math.min(salaryCycleDay, lastDayOfCurrent);

  if (cycleDay === 1) {
    return {
      periodStart: `${prevMonthStr}-01`,
      periodEnd: `${prevMonthStr}-${String(lastDayOfPrev).padStart(2, "0")}`,
    };
  }

  const endDay = cycleDay - 1;
  const startDay = Math.min(cycleDay, lastDayOfPrev);

  return {
    periodStart: `${prevMonthStr}-${String(startDay).padStart(2, "0")}`,
    periodEnd: `${month}-${String(endDay).padStart(2, "0")}`,
  };
}

export async function actorWithCompany(userId: string) {
  const actor = await User.findById(userId).select(
    "name role company companyStatus",
  );
  if (!actor) return null;
  if (!actor.company || actor.companyStatus !== "approved") return null;
  return actor;
}

export function canManageFinance(role: string) {
  return FINANCE_ROLES.has(role);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function inclusiveDaysBetween(start: Date, end: Date) {
  return (
    Math.floor(
      (startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS,
    ) + 1
  );
}

export function roundCurrency(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export async function computeSalaryBreakdown(params: {
  actorCompany: any;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  allowances: number;
  manualDeductions: number;
}) {
  const {
    actorCompany,
    employeeId,
    periodStart,
    periodEnd,
    allowances,
    manualDeductions,
  } = params;
  const requestedStart = new Date(`${periodStart}T00:00:00`);
  const requestedEnd = new Date(`${periodEnd}T00:00:00`);
  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime()) ||
    requestedEnd < requestedStart
  ) {
    return { error: "Invalid salary period dates." as const };
  }

  const employee = await User.findOne({
    _id: employeeId,
    company: actorCompany,
    companyStatus: "approved",
  }).select("_id name baseSalary companyJoined createdAt pfNumber pfDeductionAmount esicNumber esicDeductionAmount");
  if (!employee)
    return { error: "Employee not found in this company." as const };

  const monthlySalary = Math.max(0, Number(employee.baseSalary ?? 0));
  if (monthlySalary <= 0) {
    return {
      error: "Employee does not have a base salary assigned yet." as const,
    };
  }

  const joinedRef = employee.companyJoined ?? employee.createdAt;
  const companyJoined = joinedRef ? startOfDay(new Date(joinedRef)) : null;
  let effectiveStart = startOfDay(requestedStart);
  const today = startOfDay(new Date());
  let effectiveEnd = startOfDay(requestedEnd);
  if (effectiveEnd > today) {
    effectiveEnd = today;
  }
  if (
    companyJoined &&
    companyJoined > effectiveStart &&
    companyJoined <= effectiveEnd
  ) {
    effectiveStart = companyJoined;
  }

  const totalDays = inclusiveDaysBetween(effectiveStart, effectiveEnd);
  const totalDaysInMonth = new Date(
    effectiveStart.getFullYear(),
    effectiveStart.getMonth() + 1,
    0,
  ).getDate();
  const dailySalary = monthlySalary / totalDaysInMonth;

  const [attendanceRecords, leaveRecords, holidays] = await Promise.all([
    Attendance.find({
      user: employeeId,
      date: { $gte: effectiveStart, $lte: endOfDay(effectiveEnd) },
    }).select("date checkIn checkOut"),
    LeaveRequest.find({
      requester: employeeId,
      status: "approved",
      startDate: { $lte: endOfDay(effectiveEnd) },
      endDate: { $gte: effectiveStart },
    }).select("startDate endDate halfDay isPaidLeave"),
    Holiday.find({
      company: actorCompany,
      startDate: { $lte: endOfDay(effectiveEnd) },
      endDate: { $gte: effectiveStart },
    }).select("startDate endDate"),
  ]);

  const presentDays = new Set<string>();
  const halfDayAttendance = new Set<string>();
  const companyDoc = await Company.findById(actorCompany).select("weekendDates minWorkHours");
  const minWorkHours = Math.max(1, Number((companyDoc as any)?.minWorkHours ?? 8));
  const halfDayThreshold = minWorkHours / 2;
  for (const record of attendanceRecords as any[]) {
    const dayKey = toDateKey(new Date(record.date));
    if (record.checkIn && record.checkOut) {
      const diff = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
      const hours = diff / 3600000;
      if (hours >= minWorkHours) {
        presentDays.add(dayKey);
      } else if (hours >= halfDayThreshold) {
        halfDayAttendance.add(dayKey);
      }
    } else {
      presentDays.add(dayKey);
    }
  }

  const paidLeaveMap = new Map<string, number>();
  const unpaidLeaveMap = new Map<string, number>();
  for (const leave of leaveRecords as any[]) {
    const leaveStart =
      startOfDay(new Date(leave.startDate)) < effectiveStart
        ? effectiveStart
        : startOfDay(new Date(leave.startDate));
    const leaveEnd =
      startOfDay(new Date(leave.endDate)) > effectiveEnd
        ? effectiveEnd
        : startOfDay(new Date(leave.endDate));
    const days = inclusiveDaysBetween(leaveStart, leaveEnd);
    for (let i = 0; i < days; i += 1) {
      const day = new Date(leaveStart.getTime() + i * DAY_MS);
      const key = toDateKey(day);
      const amount = leave.halfDay ? 0.5 : 1;
      if (leave.isPaidLeave !== false) {
        paidLeaveMap.set(key, (paidLeaveMap.get(key) ?? 0) + amount);
      } else {
        unpaidLeaveMap.set(key, (unpaidLeaveMap.get(key) ?? 0) + amount);
      }
    }
  }

  const holidayDays = new Set<string>();
  for (const holiday of holidays as any[]) {
    const holidayStart =
      startOfDay(new Date(holiday.startDate)) < effectiveStart
        ? effectiveStart
        : startOfDay(new Date(holiday.startDate));
    const holidayEnd =
      startOfDay(new Date(holiday.endDate)) > effectiveEnd
        ? effectiveEnd
        : startOfDay(new Date(holiday.endDate));
    const days = inclusiveDaysBetween(holidayStart, holidayEnd);
    for (let i = 0; i < days; i += 1) {
      const day = new Date(holidayStart.getTime() + i * DAY_MS);
      holidayDays.add(toDateKey(day));
    }
  }

  const manualWeekendsKeys = new Set((companyDoc?.weekendDates ?? []).map((item: any) => toDateKey(new Date(item.date))));
  const monthsWithManualWeekends = new Set((companyDoc?.weekendDates ?? []).map((item: any) => {
    const wd = new Date(item.date);
    return `${wd.getFullYear()}-${wd.getMonth()}`;
  }));

  let absentDays = 0;
  let halfDayCount = 0;
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(effectiveStart.getTime() + i * DAY_MS);
    const dayKey = toDateKey(day);
    
    const hasManualWeekendsThisMonth = monthsWithManualWeekends.has(`${day.getFullYear()}-${day.getMonth()}`);
    const isWeekend = hasManualWeekendsThisMonth 
      ? manualWeekendsKeys.has(dayKey)
      : day.getDay() === 0;

    const isHoliday = holidayDays.has(dayKey);
    const hasPresent = presentDays.has(dayKey);
    const isHalfDay = halfDayAttendance.has(dayKey);
    const hasLeave =
      (paidLeaveMap.get(dayKey) ?? 0) + (unpaidLeaveMap.get(dayKey) ?? 0) > 0;
    if (!isWeekend && !isHoliday && !hasLeave) {
      if (isHalfDay) {
        halfDayCount += 1;
      } else if (!hasPresent) {
        absentDays += 1;
      }
    }
  }

  const paidLeaveDays = Array.from(paidLeaveMap.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const unpaidLeaveDays = Array.from(unpaidLeaveMap.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalUnpaidDays = absentDays + unpaidLeaveDays + halfDayCount * 0.5;
  const payableDays = Math.max(0, totalDays - totalUnpaidDays);
  const leaveDeduction = roundCurrency(dailySalary * totalUnpaidDays);
  const grossSalary = roundCurrency(dailySalary * payableDays);

  const policy = await CompanyPolicy.findOne({ company: actorCompany });
  let foodDeduction = 0;
  let travelDeduction = 0;
  let pfDeduction = 0;
  let esicDeduction = 0;
  let finalSalary = Math.max(0, grossSalary + allowances - manualDeductions);
  if (policy) {
    const isFoodOptedOut = policy.foodOptedOutMembers?.some(
      (id: any) => String(id) === employeeId,
    );
    const isTravelOptedOut = policy.travelOptedOutMembers?.some(
      (id: any) => String(id) === employeeId,
    );
    if (!isFoodOptedOut) {
      foodDeduction = Math.max(0, Number(policy.foodAmount ?? 0));
    }
    if (!isTravelOptedOut) {
      travelDeduction = Math.max(0, Number(policy.travelAccommodationAmount ?? 0));
    }
    finalSalary = Math.max(0, finalSalary - foodDeduction - travelDeduction);

    const pfPct = Number((policy as any).pfPercentage ?? 12);
    const esicPct = Number((policy as any).esicPercentage ?? 0.75);
    const empPfAmount = Number((employee as any).pfDeductionAmount ?? 0);
    const empEsicAmount = Number((employee as any).esicDeductionAmount ?? 0);
    if ((employee as any).pfNumber) {
      pfDeduction = empPfAmount > 0 ? roundCurrency(empPfAmount) : roundCurrency(grossSalary * pfPct / 100);
    }
    if ((employee as any).esicNumber) {
      esicDeduction = empEsicAmount > 0 ? roundCurrency(empEsicAmount) : roundCurrency(grossSalary * esicPct / 100);
    }
    finalSalary = Math.max(0, finalSalary - pfDeduction - esicDeduction);
  }
  const totalDeductions = leaveDeduction + manualDeductions + pfDeduction + esicDeduction;

  return {
    breakdown: {
      totalDays,
      absentDays,
      halfDayCount,
      paidLeaveDays,
      unpaidLeaveDays,
      payableDays,
      dailySalary: roundCurrency(dailySalary),
      leaveDeduction,
      pfDeduction,
      esicDeduction,
      allowances,
      manualDeductions,
      totalDeductions,
      foodDeduction,
      travelDeduction,
      grossSalary,
      finalSalary,
      periodStart: toDateKey(effectiveStart),
      periodEnd,
    },
    employee,
  };
}

export async function autoGenerateSalariesForMonth(params: {
  actorCompany: any;
  userId: string;
  actorName: string;
  month: string;
  policy: any;
}): Promise<boolean> {
  const { actorCompany, userId, actorName, month, policy } = params;
  const existingSalaries = await FinanceSalary.countDocuments({
    company: actorCompany,
    month,
  });
  if (existingSalaries > 0) return false;

  const approvedMembers = await User.find({
    company: actorCompany,
    companyStatus: "approved",
  }).select("_id name");

  const { periodStart, periodEnd } = getSalaryPeriod(month, policy || {});
  const generatedSalaries: any[] = [];
  for (const member of approvedMembers) {
    const computed = await computeSalaryBreakdown({
      actorCompany,
      employeeId: String(member._id),
      periodStart,
      periodEnd,
      allowances: 0,
      manualDeductions: 0,
    });
    if ("error" in computed) continue;
    const { breakdown } = computed;
    const salary = await FinanceSalary.findOneAndUpdate(
      { company: actorCompany, employee: member._id, month },
      {
        $set: {
          baseSalary: breakdown.grossSalary,
          allowances: 0,
          deductions: breakdown.totalDeductions,
          netSalary: breakdown.finalSalary,
        },
        $setOnInsert: { status: "pending", createdBy: userId },
      },
      { new: true, upsert: true },
    );
    generatedSalaries.push({ ...salary.toObject?.() ?? salary, employee: member });
  }

  if (generatedSalaries.length === 0) return false;

  const admins = await User.find({
    company: actorCompany,
    role: "admin",
    companyStatus: "approved",
  }).select("_id");

  const approvalCounts = await Promise.all(
    admins.map(async (a) => {
      const count = await JoinRequest.countDocuments({
        approver: a._id,
        company: actorCompany,
        kind: "salary",
        status: "pending",
      });
      return { id: String(a._id), count };
    }),
  );
  approvalCounts.sort((a, b) => a.count - b.count);
  const targetAdminId = approvalCounts[0]?.id;
  if (targetAdminId) {
    const targetAdmin = admins.find((a) => String(a._id) === targetAdminId);
    if (targetAdmin) {
      for (const _salary of generatedSalaries) {
        const assignedAdmin = await User.findById(targetAdminId).select("_id");
        if (assignedAdmin) {
          await JoinRequest.findOneAndUpdate(
            { company: actorCompany, kind: "salary", status: "pending", approver: targetAdminId },
            { $set: { approver: targetAdminId } },
            { upsert: false },
          );
        }
      }
      await Notification.create({
        user: targetAdminId,
        company: actorCompany,
        type: "approval",
        title: "Monthly salaries pending approval",
        message: `${generatedSalaries.length} salary record(s) were auto-generated for ${month}. Admin approval required.`,
      });
      emitNotification(targetAdminId);
    }
  }

  await Notification.create({
    user: userId,
    company: actorCompany,
    type: "info",
    title: "Salaries auto-generated",
    message: `${generatedSalaries.length} salary record(s) were auto-generated for ${month}.`,
  });
  emitNotification(userId);

  return true;
}
