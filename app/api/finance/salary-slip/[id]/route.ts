import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { CompanyPolicy } from "@/models/CompanyPolicy";
import { Attendance } from "@/models/Attendance";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Holiday } from "@/models/Holiday";

type Params = { params: Promise<{ id: string }> };

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inclusiveDaysBetween(start: Date, end: Date) {
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS) + 1;
}

function roundCurrency(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();

    const salary = await FinanceSalary.findById(id);
    if (!salary) return jsonError("Salary record not found.", 404);

    const actor = await User.findById(userId).select("role company companyStatus");
    if (!actor) return jsonError("User not found.", 404);

    const isOwner = String(salary.employee) === userId;
    const isCompanyMember =
      actor.company &&
      String(actor.company) === String(salary.company) &&
      actor.companyStatus === "approved";
    const isHrOrFinanceOrAdmin =
      isCompanyMember &&
      ["human-resource", "finance", "admin"].includes(String(actor.role));

    if (!isOwner && !isHrOrFinanceOrAdmin) {
      return jsonError("Forbidden", 403);
    }

    const [employee, companyDoc, policy] = await Promise.all([
      User.findById(salary.employee).select("name email role companyIdentityCode baseSalary companyJoined createdAt pfNumber pfDeductionAmount esicNumber esicDeductionAmount tdsDeductionAmount pfExempted esicExempted tdsExempted"),
      Company.findById(salary.company).select("name icon"),
      CompanyPolicy.findOne({ company: salary.company }),
    ]);

    if (!employee || !companyDoc) {
      return jsonError("Employee or company not found.", 404);
    }

    const monthStr = salary.month;
    const year = Number(monthStr.slice(0, 4));
    const month = Number(monthStr.slice(5, 7));
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const joinedRef = employee.companyJoined ?? employee.createdAt;
    const companyJoined = joinedRef ? startOfDay(new Date(joinedRef)) : null;
    let effectiveStart = startOfDay(periodStart);
    const today = startOfDay(new Date());
    let effectiveEnd = startOfDay(periodEnd);
    if (effectiveEnd > today) effectiveEnd = today;
    if (companyJoined && companyJoined > effectiveStart && companyJoined <= effectiveEnd) {
      effectiveStart = companyJoined;
    }

    const totalDays = inclusiveDaysBetween(effectiveStart, effectiveEnd);
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const monthlySalary = Math.max(0, Number(employee.baseSalary ?? salary.baseSalary ?? 0));
    const dailySalary = monthlySalary / totalDaysInMonth;

    const [attendanceRecords, leaveRecords, holidays] = await Promise.all([
      Attendance.find({
        user: salary.employee,
        date: { $gte: effectiveStart, $lte: endOfDay(effectiveEnd) },
      }).select("date checkIn checkOut"),
      LeaveRequest.find({
        requester: salary.employee,
        status: "approved",
        startDate: { $lte: endOfDay(effectiveEnd) },
        endDate: { $gte: effectiveStart },
      }).select("startDate endDate halfDay isPaidLeave"),
      Holiday.find({
        company: salary.company,
        startDate: { $lte: endOfDay(effectiveEnd) },
        endDate: { $gte: effectiveStart },
      }).select("startDate endDate"),
    ]);

    const presentDays = new Set<string>();
    const halfDayAttendance = new Set<string>();
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
      const leaveStart = startOfDay(new Date(leave.startDate)) < effectiveStart
        ? effectiveStart
        : startOfDay(new Date(leave.startDate));
      const leaveEnd = startOfDay(new Date(leave.endDate)) > effectiveEnd
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
      const holidayStart = startOfDay(new Date(holiday.startDate)) < effectiveStart
        ? effectiveStart
        : startOfDay(new Date(holiday.startDate));
      const holidayEnd = startOfDay(new Date(holiday.endDate)) > effectiveEnd
        ? effectiveEnd
        : startOfDay(new Date(holiday.endDate));
      const days = inclusiveDaysBetween(holidayStart, holidayEnd);
      for (let i = 0; i < days; i += 1) {
        const day = new Date(holidayStart.getTime() + i * DAY_MS);
        holidayDays.add(toDateKey(day));
      }
    }

    let absentDays = 0;
    let halfDayCount = 0;
    for (let i = 0; i < totalDays; i += 1) {
      const day = new Date(effectiveStart.getTime() + i * DAY_MS);
      const dayKey = toDateKey(day);
      const isWeekend = day.getDay() === 0;
      const isHoliday = holidayDays.has(dayKey);
      const hasPresent = presentDays.has(dayKey);
      const isHalfDay = halfDayAttendance.has(dayKey);
      const hasLeave = (paidLeaveMap.get(dayKey) ?? 0) + (unpaidLeaveMap.get(dayKey) ?? 0) > 0;
      if (!isWeekend && !isHoliday && !hasLeave) {
        if (isHalfDay) {
          halfDayCount += 1;
        } else if (!hasPresent) {
          absentDays += 1;
        }
      }
    }

    const unpaidLeaveDays = Array.from(unpaidLeaveMap.values()).reduce((sum, v) => sum + v, 0);
    const totalUnpaidDays = absentDays + unpaidLeaveDays + halfDayCount * 0.5;
    const payableDays = Math.max(0, totalDays - totalUnpaidDays);
    const leaveDeduction = roundCurrency(dailySalary * totalUnpaidDays);
    const grossSalary = roundCurrency(dailySalary * payableDays);

      let foodDeduction = 0;
      let travelDeduction = 0;
      let pfDeduction = 0;
      let esicDeduction = 0;
      let tdsDeduction = 0;
      let pfPercentage = 0;
      let esicPercentage = 0;
      let tdsPercentage = 0;
      if (policy) {
        const isFoodOptedOut = policy.foodOptedOutMembers?.some((id: any) => String(id) === String(employee._id));
        const isTravelOptedOut = policy.travelOptedOutMembers?.some((id: any) => String(id) === String(employee._id));
        if (!isFoodOptedOut) foodDeduction = Math.max(0, Number(policy.foodAmount ?? 0));
        if (!isTravelOptedOut) travelDeduction = Math.max(0, Number(policy.travelAccommodationAmount ?? 0));
        pfPercentage = Number((policy as any).pfPercentage ?? 12);
        esicPercentage = Number((policy as any).esicPercentage ?? 0.75);
        tdsPercentage = Number((policy as any).tdsPercentage ?? 0);
        const empPfAmount = Number((employee as any).pfDeductionAmount ?? 0);
        const empEsicAmount = Number((employee as any).esicDeductionAmount ?? 0);
        const empTdsAmount = Number((employee as any).tdsDeductionAmount ?? 0);
        if (!(employee as any).pfExempted) {
          pfDeduction = empPfAmount > 0 ? roundCurrency(empPfAmount) : roundCurrency(grossSalary * pfPercentage / 100);
        }
        if (!(employee as any).esicExempted) {
          esicDeduction = empEsicAmount > 0 ? roundCurrency(empEsicAmount) : roundCurrency(grossSalary * esicPercentage / 100);
        }
        if (!(employee as any).tdsExempted) {
          if (empTdsAmount > 0) {
            tdsDeduction = roundCurrency(empTdsAmount);
          } else if (tdsPercentage > 0) {
            tdsDeduction = roundCurrency(grossSalary * tdsPercentage / 100);
          }
        }
      }
    const finalSalary = Math.max(0, Number(salary.netSalary ?? 0));
    const periodAdjusted = !!(companyJoined && companyJoined > startOfDay(periodStart) && companyJoined <= startOfDay(periodEnd));

    return NextResponse.json({
      slip: {
        id: salary._id,
        month: salary.month,
        status: salary.status,
        paidAt: salary.paidAt,
        baseSalary: salary.baseSalary,
        allowances: salary.allowances,
        deductions: salary.deductions,
        netSalary: salary.netSalary,
      },
      employee: {
        name: employee.name,
        email: employee.email,
        role: employee.role,
        identityCode: employee.companyIdentityCode,
        pfNumber: (employee as any).pfNumber ?? "",
        esicNumber: (employee as any).esicNumber ?? "",
      },
      company: {
        name: companyDoc.name,
        icon: (companyDoc as any).icon ?? "",
      },
      breakdown: {
        monthlySalary,
        totalDays,
        absentDays,
        halfDayCount,
        payableDays,
        dailySalary: roundCurrency(dailySalary),
        leaveDeduction,
        grossSalary,
        foodDeduction,
        travelDeduction,
        pfDeduction,
        esicDeduction,
        tdsDeduction,
        pfPct: pfPercentage,
        esicPct: esicPercentage,
        tdsPct: tdsPercentage,
        pfExempted: Boolean((employee as any).pfExempted),
        esicExempted: Boolean((employee as any).esicExempted),
        tdsExempted: Boolean((employee as any).tdsExempted),
        finalSalary,
        periodStart: toDateKey(effectiveStart),
        periodEnd: toDateKey(effectiveEnd),
        periodAdjusted,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
