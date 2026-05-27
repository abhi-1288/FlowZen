import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Board } from "@/models/Board";
import { ExpenseBill } from "@/models/ExpenseBill";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { Notification } from "@/models/Notification";
import { ProjectBudget } from "@/models/ProjectBudget";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Attendance } from "@/models/Attendance";
import { Holiday } from "@/models/Holiday";

const FINANCE_ROLES = new Set(["finance", "admin"]);

function monthKey(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

async function actorWithCompany(userId: string) {
  const actor = await User.findById(userId).select("name role company companyStatus");
  if (!actor) return null;
  if (!actor.company || actor.companyStatus !== "approved") return null;
  return actor;
}

function canManageFinance(role: string) {
  return FINANCE_ROLES.has(role);
}

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

async function computeSalaryBreakdown(params: {
  actorCompany: any;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  allowances: number;
  manualDeductions: number;
}) {
  const { actorCompany, employeeId, periodStart, periodEnd, allowances, manualDeductions } = params;
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
  }).select("_id name baseSalary companyJoined createdAt");
  if (!employee) return { error: "Employee not found in this company." as const };

  const monthlySalary = Math.max(0, Number(employee.baseSalary ?? 0));
  if (monthlySalary <= 0) {
    return { error: "Employee does not have a base salary assigned yet." as const };
  }

  const joinedRef = employee.companyJoined ?? employee.createdAt;
  const companyJoined = joinedRef ? startOfDay(new Date(joinedRef)) : null;
  let effectiveStart = startOfDay(requestedStart);
  const effectiveEnd = startOfDay(requestedEnd);
  if (companyJoined && companyJoined > effectiveStart && companyJoined <= effectiveEnd) {
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
    }).select("date"),
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
  for (const record of attendanceRecords as any[]) {
    presentDays.add(toDateKey(new Date(record.date)));
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
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(effectiveStart.getTime() + i * DAY_MS);
    const dayKey = toDateKey(day);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isHoliday = holidayDays.has(dayKey);
    const hasPresent = presentDays.has(dayKey);
    const hasLeave = ((paidLeaveMap.get(dayKey) ?? 0) + (unpaidLeaveMap.get(dayKey) ?? 0)) > 0;
    if (!isWeekend && !isHoliday && !hasPresent && !hasLeave) {
      absentDays += 1;
    }
  }

  const paidLeaveDays = Array.from(paidLeaveMap.values()).reduce((sum, value) => sum + value, 0);
  const unpaidLeaveDays = Array.from(unpaidLeaveMap.values()).reduce((sum, value) => sum + value, 0);
  const totalUnpaidDays = absentDays + unpaidLeaveDays;
  const payableDays = Math.max(0, totalDays - totalUnpaidDays);
  const leaveDeduction = roundCurrency(dailySalary * totalUnpaidDays);
  const grossSalary = roundCurrency(dailySalary * payableDays);
  const totalDeductions = leaveDeduction + manualDeductions;
  const finalSalary = Math.max(0, grossSalary + allowances - manualDeductions);

  return {
    breakdown: {
      totalDays,
      absentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      payableDays,
      dailySalary: roundCurrency(dailySalary),
      leaveDeduction,
      allowances,
      manualDeductions,
      totalDeductions,
      grossSalary,
      finalSalary,
      periodStart: toDateKey(effectiveStart),
      periodEnd,
    },
    employee,
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await actorWithCompany(userId);
  if (!actor) return jsonError("Approved company access is required.", 403);
  const role = String(actor.role ?? "");
  const canManage = canManageFinance(role);
  const url = new URL(request.url);

  if (url.searchParams.get("counts") === "true") {
    const month = monthKey(url.searchParams.get("month"));
    const [pendingSalaryApproval, pendingSalaryPayment, pendingExpenseApproval, forwardedExpenseApproval, pendingExpenseAcceptance, pendingAssignedExpenses, pendingBills, pendingBudgets] = await Promise.all([
      FinanceSalary.countDocuments({ company: actor.company, month, status: "pending" }),
      FinanceSalary.countDocuments({ company: actor.company, month, status: "approved" }),
      ExpenseRequest.countDocuments({ company: actor.company, status: "pending" }),
      ExpenseRequest.countDocuments({ company: actor.company, status: "forwarded" }),
      ExpenseRequest.countDocuments({
        company: actor.company,
        status: "approved",
        $or: [{ assignedTo: null }, { assignedTo: userId }],
      }),
      ExpenseRequest.countDocuments({ company: actor.company, status: "pending", assignedTo: userId }),
      ExpenseBill.countDocuments({ company: actor.company, status: "pending" }),
      ProjectBudget.countDocuments({ company: actor.company, status: "pending" }),
    ]);
    return NextResponse.json({ pendingSalaryApproval, pendingSalaryPayment, pendingExpenseApproval, forwardedExpenseApproval, pendingExpenseAcceptance, pendingAssignedExpenses, pendingBills, pendingBudgets });
  }

  const month = monthKey(url.searchParams.get("month"));

  const [salaries, expenses, budgets, boards, members, financeMembers, bills] = await Promise.all([
    canManage
      ? FinanceSalary.find({ company: actor.company, month })
          .populate("employee", "name email role customRole companyIdentityCode")
          .sort({ updatedAt: -1 })
      : FinanceSalary.find({ company: actor.company, employee: userId, month })
          .populate("employee", "name email role customRole companyIdentityCode")
          .sort({ updatedAt: -1 }),
    canManage
      ? ExpenseRequest.find({ company: actor.company })
          .populate("requester", "name email role")
          .populate("assignedTo", "name email role")
          .populate("forwardedBy", "name email role")
          .populate("acceptedBy", "name email role")
          .sort({ createdAt: -1 })
          .limit(50)
      : ExpenseRequest.find({ company: actor.company, requester: userId })
          .populate("requester", "name email role")
          .populate("assignedTo", "name email role")
          .populate("forwardedBy", "name email role")
          .populate("acceptedBy", "name email role")
          .sort({ createdAt: -1 })
          .limit(50),
    canManage
      ? ProjectBudget.find({ company: actor.company })
          .populate("board", "title description")
          .populate("decidedBy", "name")
          .populate("assignedTo", "name")
          .sort({ updatedAt: -1 })
      : [],
    canManage
      ? Board.find({
          owner: { $in: [...new Set([userId, ...(await User.find({ company: actor.company, companyStatus: "approved" }).distinct("_id"))])].map(String) },
        })
          .populate("owner", "name")
          .populate("members.assignedTo", "name")
          .select("title description owner members")
          .sort({ createdAt: -1 })
      : [],
    canManage
      ? User.find({ company: actor.company, companyStatus: "approved" })
          .select("name email role customRole companyIdentityCode baseSalary")
          .sort({ name: 1 })
      : [],
    User.find({ company: actor.company, role: "finance", companyStatus: "approved" })
      .select("name email role customRole companyIdentityCode baseSalary")
      .sort({ name: 1 }),
    canManage
      ? ExpenseBill.find({ company: actor.company })
          .populate("budget")
          .populate("generatedBy", "name")
          .sort({ createdAt: -1 })
      : [],
  ]);

  const totalPayroll = salaries.reduce(
    (sum: number, salary: any) => sum + Number(salary.netSalary ?? 0),
    0,
  );
  const pendingSalaries = salaries.filter((salary: any) => salary.status !== "paid").length;
  const paidSalaries = salaries.filter((salary: any) => salary.status === "paid").length;

  const budgetByBoard = new Map<string, any>();
  for (const budget of budgets as any[]) {
    const boardId = String(budget.board?._id ?? budget.board ?? "");
    if (boardId && !budgetByBoard.has(boardId)) budgetByBoard.set(boardId, budget);
  }

  const serializedBoards = serializeDocs(boards as any).map((b: any) => {
    const owner = b.owner;
    const isOwner = String(owner?._id ?? owner ?? "") === String(userId);
    const memberEntry = (b.members ?? []).find(
      (m: any) => String(m.user?._id ?? m.user ?? "") === String(userId),
    );
    const boardBudget = budgetByBoard.get(String(b.id));

    let label: string;
    if (isOwner) {
      label = "Self";
    } else if (memberEntry) {
      const assigned = memberEntry.assignedTo;
      label = assigned ? `Assigned by ${String(assigned.name ?? "User")}` : "Invited";
    } else {
      label = `Created by ${String(owner?.name ?? "Unknown")}`;
    }

    if (boardBudget) {
      const budgetAssigned = boardBudget.assignedTo;
      label += budgetAssigned ? ` (Budget → ${String(budgetAssigned.name ?? "User")})` : " (Budget set)";
    }

    return { ...b, label };
  });

  return NextResponse.json({
    month,
    canManage,
    dashboard: { totalPayroll, pendingSalaries, paidSalaries },
    salaries: serializeDocs(salaries as any),
    expenses: serializeDocs(expenses as any),
    budgets: serializeDocs(budgets as any),
    bills: serializeDocs(bills as any),
    boards: serializedBoards,
    members: serializeDocs(members as any),
    financeMembers: serializeDocs(financeMembers as any),
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await actorWithCompany(userId);
  if (!actor) return jsonError("Approved company access is required.", 403);
  const role = String(actor.role ?? "");
  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "request-expense") {
    const category = String(body.category ?? "");
    const title = String(body.title ?? "").trim();
    const amount = Number(body.amount ?? 0);
    const reason = String(body.reason ?? "").trim();
    if (!title) return jsonError("Expense title is required.");
    if (!["software", "device", "travel", "office-resources"].includes(category)) {
      return jsonError("Invalid expense category.");
    }
    let assignedTo = null;
    if (role !== "finance") {
      assignedTo = String(body.assignedTo ?? "");
      if (!assignedTo) return jsonError("Please assign a finance user to handle this request.", 400);
      const financeUser = await User.findOne({ _id: assignedTo, company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
      if (!financeUser) return jsonError("Assigned finance user not found in this company.", 404);
    }
    const expense = await ExpenseRequest.create({
      company: actor.company,
      requester: userId,
      category,
      title,
      amount: Number.isFinite(amount) ? amount : 0,
      reason,
      ...(assignedTo ? { assignedTo } : {}),
    });
    const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
    const notifyIds: string[] = [];
    if (assignedTo) {
      await Notification.create({
        user: assignedTo,
        company: actor.company,
        type: "info",
        title: "Expense assigned to you",
        message: `${actor.name ?? "A member"} assigned you an expense: ${title} for ₹${Number.isFinite(amount) ? amount : 0}.`,
      });
      notifyIds.push(assignedTo);
    }
    await Notification.insertMany(
      admins.map((u) => ({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: "Expense pending approval",
        message: `${actor.name ?? "A member"} requested ${title} for ₹${Number.isFinite(amount) ? amount : 0}.`,
      }))
    );
    admins.forEach((u) => notifyIds.push(String(u._id)));
    notifyIds.forEach((id) => emitNotification(id));
    return NextResponse.json({ expense }, { status: 201 });
  }

  if (!canManageFinance(role)) return jsonError("Only finance, HR, or admins can manage finance.", 403);

  if (action === "calculate-salary") {
    const employeeId = String(body.employeeId ?? "");
    const periodStart = String(body.periodStart ?? "");
    const periodEnd = String(body.periodEnd ?? "");
    if (!periodStart || !periodEnd) return jsonError("Salary period dates are required.");
    const computed = await computeSalaryBreakdown({
      actorCompany: actor.company,
      employeeId,
      periodStart,
      periodEnd,
      allowances: 0,
      manualDeductions: 0,
    });
    if ("error" in computed) return jsonError(computed.error, computed.error.includes("not found") ? 404 : 400);
    return NextResponse.json({ breakdown: computed.breakdown });
  }

  if (action === "generate-salary") {
    const employeeId = String(body.employeeId ?? "");
    const periodStart = String(body.periodStart ?? "");
    const periodEnd = String(body.periodEnd ?? "");
    if (!periodStart || !periodEnd) return jsonError("Salary period dates are required.");
    const allowances = Math.max(0, Number(body.allowances ?? 0));
    const manualDeductions = Math.max(0, Number(body.deductions ?? 0));
    const computed = await computeSalaryBreakdown({
      actorCompany: actor.company,
      employeeId,
      periodStart,
      periodEnd,
      allowances,
      manualDeductions,
    });
    if ("error" in computed) return jsonError(computed.error, computed.error.includes("not found") ? 404 : 400);
    const { breakdown, employee } = computed;
    const month = breakdown.periodStart.slice(0, 7);

    const salary = await FinanceSalary.findOneAndUpdate(
      { company: actor.company, employee: employeeId, month },
      {
        $set: {
          baseSalary: breakdown.grossSalary,
          allowances,
          deductions: breakdown.totalDeductions,
          netSalary: breakdown.finalSalary,
        },
        $setOnInsert: { status: "pending" },
      },
      { new: true, upsert: true },
    );
    const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
    await Notification.insertMany(
      admins.map((u) => ({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: "Salary pending approval",
        message: `${actor.name ?? "Finance"} generated a salary for ${String(employee.name ?? "an employee")} (${breakdown.periodStart} to ${periodEnd}).`,
      }))
    );
    admins.forEach((u) => emitNotification(String(u._id)));
    return NextResponse.json({
      salary,
      breakdown,
    });
  }

  if (action === "set-budget") {
    const boardId = String(body.boardId ?? "");
    const board = await Board.findOne({
      _id: boardId,
      owner: { $in: (await User.find({ company: actor.company, companyStatus: "approved" }).distinct("_id")).map(String) },
    }).select("_id title");
    if (!board) return jsonError("Project not found.", 404);
    const deadline = body.deadline ? new Date(String(body.deadline)) : null;
    let assignedTo: string | null = null;
    if (role === "admin") {
      assignedTo = String(body.assignedTo ?? "");
      if (!assignedTo) return jsonError("Please assign a finance user to approve this budget.", 400);
      const financeUser = await User.findOne({ _id: assignedTo, company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
      if (!financeUser) return jsonError("Assigned finance user not found.", 404);
    }
    const budget = await ProjectBudget.findOneAndUpdate(
      { company: actor.company, board: boardId },
      {
        $set: {
          totalBudget: Math.max(0, Number(body.totalBudget ?? 0)),
          teamSpendingLimit: Math.max(0, Number(body.teamSpendingLimit ?? 0)),
          resourceBudget: Math.max(0, Number(body.resourceBudget ?? 0)),
          deadline: deadline && !isNaN(deadline.getTime()) ? deadline : null,
          status: "pending",
          ...(assignedTo ? { assignedTo } : {}),
          decidedBy: userId,
        },
      },
      { new: true, upsert: true },
    );
    const boardTitle = String((board as any).title ?? "");
    if (role === "admin") {
      const notifyUserIds = assignedTo
        ? [assignedTo]
        : (await User.find({ company: actor.company, role: "finance", companyStatus: "approved" }).distinct("_id")).map(String);
      const notifications = notifyUserIds.map((uid) => ({
        user: uid,
        company: actor.company,
        type: "approval" as const,
        title: "Budget pending review",
        message: `${actor.name ?? "Admin"} allocated a budget for "${boardTitle}" — please review and approve.`,
      }));
      if (notifications.length) await Notification.insertMany(notifications);
      notifyUserIds.forEach((uid) => emitNotification(String(uid)));
    }
    if (role === "finance") {
      const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
      await Notification.insertMany(
        admins.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "approval",
          title: "Budget pending admin approval",
          message: `${actor.name ?? "Finance"} allocated a budget for "${boardTitle}" — please review and approve.`,
        }))
      );
      admins.forEach((u) => emitNotification(String(u._id)));
    }
    return NextResponse.json({ budget });
  }

  if (action === "generate-bill") {
    const budgetId = String(body.budgetId ?? "");
    const amount = Math.max(0, Number(body.amount ?? 0));
    if (!budgetId || !amount) return jsonError("Budget and amount are required.", 400);
    const budget = await ProjectBudget.findOne({ _id: budgetId, company: actor.company, status: "approved" }).populate("board", "title");
    if (!budget) return jsonError("Approved budget not found.", 404);
    const description = String(body.description ?? "").trim();
    const bill = await ExpenseBill.create({
      company: actor.company,
      budget: budgetId,
      amount,
      description,
      status: "pending",
      generatedBy: userId,
    });
    const boardTitle = String((budget.board as any)?.title ?? "");
    const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
    await Notification.insertMany(
      admins.map((u) => ({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: "Expense bill pending approval",
        message: `${actor.name ?? "Finance"} generated an expense bill of ₹${amount} for "${boardTitle}".`,
      }))
    );
    admins.forEach((u) => emitNotification(String(u._id)));
    return NextResponse.json({ bill }, { status: 201 });
  }

  return jsonError("Unknown finance action.");
}

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await actorWithCompany(userId);
  if (!actor) return jsonError("Approved company access is required.", 403);
  if (!canManageFinance(String(actor.role ?? ""))) {
    return jsonError("Only finance, HR, or admins can approve payouts.", 403);
  }

  const body = await request.json();
  const type = String(body.type ?? "");
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");

  if (type === "salary") {
    if (!["approved", "paid"].includes(status)) return jsonError("Invalid salary status.");
    const existing = await FinanceSalary.findOne({ _id: id, company: actor.company }).select("status employee");
    if (!existing) return jsonError("Salary record not found.", 404);
    if (status === "paid" && existing.status !== "approved") return jsonError("Salary must be approved before marking as paid.", 400);

    const salary = await FinanceSalary.findOneAndUpdate(
      { _id: id, company: actor.company },
      {
        $set: {
          status,
          approvedBy: userId,
          paidAt: status === "paid" ? new Date() : null,
        },
      },
      { new: true },
    );

    if (status === "approved") {
      const financeUsers = await User.find({ company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
      await Notification.insertMany(
        financeUsers.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "info",
          title: "Salary approved",
          message: `Salary for ${salary?.month ?? ""} has been approved. You can now mark it as paid.`,
        }))
      );
      financeUsers.forEach((u) => emitNotification(String(u._id)));
    }

    if (status === "paid") {
      const employeeId = existing.employee;
      await Notification.create({
        user: employeeId,
        company: actor.company,
        type: "info",
        title: "Salary paid",
        message: `Your salary for ${salary?.month ?? ""} has been marked as paid.`,
      });
      emitNotification(String(employeeId));
    }

    return NextResponse.json({ salary });
  }

  if (type === "expense") {
    const existing = await ExpenseRequest.findOne({ _id: id, company: actor.company }).select("status requester assignedTo title");
    if (!existing) return jsonError("Expense request not found.", 404);

    const isAssigned = existing.assignedTo && String(existing.assignedTo) === userId;

    if (status === "forwarded") {
      if (String(actor.role) !== "finance") return jsonError("Only finance can forward expense requests.", 403);
      if (!isAssigned) return jsonError("This expense is not assigned to you.", 403);
      if (existing.status !== "pending") return jsonError("Expense request already processed.", 409);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status, forwardedBy: userId } },
        { new: true },
      );
      const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
      await Notification.insertMany(
        admins.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "approval",
          title: "Expense forwarded for admin approval",
          message: `${actor.name ?? "Finance"} forwarded expense "${existing.title}" for your approval.`,
        }))
      );
      admins.forEach((u) => emitNotification(String(u._id)));
      return NextResponse.json({ expense });
    }

    if (status === "rejected") {
      if (String(actor.role) === "finance") {
        if (!isAssigned) return jsonError("This expense is not assigned to you.", 403);
        if (existing.status !== "pending") return jsonError("Expense request already processed.", 409);
      } else if (String(actor.role) === "admin") {
        if (existing.status !== "pending" && existing.status !== "forwarded") return jsonError("Expense request already processed.", 409);
      } else {
        return jsonError("You are not allowed to reject expense requests.", 403);
      }
      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (!rejectionReason) return jsonError("A rejection reason is required.", 400);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "rejected", rejectionReason } },
        { new: true },
      );
      const requesterId = existing.requester;
      await Notification.create({
        user: requesterId,
        company: actor.company,
        type: "info",
        title: "Expense rejected",
        message: `Your expense request "${existing.title}" was rejected: ${rejectionReason}`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    if (status === "approved") {
      if (String(actor.role) !== "admin") return jsonError("Only admin can approve expense requests.", 403);
      if (existing.status !== "pending" && existing.status !== "forwarded") return jsonError("Expense request already processed.", 409);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status, decidedBy: userId } },
        { new: true },
      );
      const requesterId = existing.requester;
      if (status === "approved" && existing.assignedTo) {
        await Notification.create({
          user: existing.assignedTo,
          company: actor.company,
          type: "info",
          title: "Expense ready to accept",
          message: `Expense "${existing.title}" has been approved by admin. You can now accept it.`,
        });
        emitNotification(String(existing.assignedTo));
      }
      await Notification.create({
        user: requesterId,
        company: actor.company,
        type: "info",
        title: status === "approved" ? "Expense approved by admin" : "Expense rejected",
        message: `Your expense request "${existing.title}" has been ${status === "approved" ? "approved by admin" : `rejected: ${existing.status === "forwarded" ? "forwarded request was rejected" : ""}`}.`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    if (status === "accepted") {
      if (String(actor.role) !== "finance") return jsonError("Only finance can accept expense requests.", 403);
      if (existing.status !== "approved") return jsonError("Expense must be approved by admin before accepting.", 400);
      if (existing.assignedTo && !isAssigned) return jsonError("This expense is assigned to another finance user.", 403);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "accepted", acceptedBy: userId } },
        { new: true },
      );
      const requesterId = existing.requester;
      await Notification.create({
        user: requesterId,
        company: actor.company,
        type: "info",
        title: "Expense accepted and received",
        message: `Your expense request "${existing.title}" has been accepted and received by finance.`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    if (status === "disbursed") {
      if (String(actor.role) !== "finance") return jsonError("Only finance can disburse expenses.", 403);
      if (existing.status !== "accepted") return jsonError("Expense must be accepted before disbursement.", 400);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "disbursed", disbursedBy: userId, disbursedAt: new Date() } },
        { new: true },
      );
      const requesterId = existing.requester;
      await Notification.create({
        user: requesterId,
        company: actor.company,
        type: "info",
        title: "Expense disbursed",
        message: `Your expense request "${existing.title}" for ₹${existing.amount ?? 0} has been disbursed by finance.`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    return jsonError("Invalid expense status.");
  }

  if (type === "budget") {
    const existing = await ProjectBudget.findOne({ _id: id, company: actor.company }).populate("board", "title");
    if (!existing) return jsonError("Budget not found.", 404);
    const boardTitle = String((existing.board as any)?.title ?? "");

    if (status === "approved") {
      const isAssignedFinance = existing.assignedTo && String(existing.assignedTo) === userId;
      const canFinanceApprove = String(actor.role) === "finance" && existing.assignedTo && isAssignedFinance;
      const canAdminApprove = String(actor.role) === "admin" && !existing.assignedTo;
      if (!canFinanceApprove && !canAdminApprove) return jsonError("You are not authorized to approve this budget.", 403);
      if (existing.status !== "pending") return jsonError("Budget already processed.", 409);
      const budget = await ProjectBudget.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "approved" } },
        { new: true },
      );
      if (existing.decidedBy) {
        await Notification.create({
          user: existing.decidedBy,
          company: actor.company,
          type: "info",
          title: "Budget approved",
          message: `Budget for "${boardTitle}" has been approved by ${actor.name ?? "the reviewer"}.`,
        });
        emitNotification(String(existing.decidedBy));
      }
      return NextResponse.json({ budget });
    }

    if (status === "rejected") {
      const isAssignedFinance = existing.assignedTo && String(existing.assignedTo) === userId;
      const canFinanceReject = String(actor.role) === "finance" && existing.assignedTo && isAssignedFinance;
      const canAdminReject = String(actor.role) === "admin" && !existing.assignedTo;
      if (!canFinanceReject && !canAdminReject) return jsonError("You are not authorized to reject this budget.", 403);
      if (existing.status !== "pending") return jsonError("Budget already processed.", 409);
      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (!rejectionReason) return jsonError("A rejection reason is required.", 400);
      const budget = await ProjectBudget.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "rejected", rejectionReason, rejectedAt: new Date() } },
        { new: true },
      );
      const notifyIds: string[] = [];
      if (existing.decidedBy) {
        await Notification.create({
          user: existing.decidedBy,
          company: actor.company,
          type: "info",
          title: "Budget rejected",
          message: `Budget for "${boardTitle}" was rejected by ${actor.name ?? "the reviewer"}: ${rejectionReason}`,
        });
        notifyIds.push(String(existing.decidedBy));
      }
      if (String(actor.role) === "admin") {
        const financeUsers = await User.find({ company: actor.company, role: "finance", companyStatus: "approved" }).select("_id");
        await Notification.insertMany(
          financeUsers.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Budget rejected by admin",
            message: `Budget for "${boardTitle}" was rejected by admin: ${rejectionReason}`,
          }))
        );
        financeUsers.forEach((u) => notifyIds.push(String(u._id)));
      } else {
        const admins = await User.find({ company: actor.company, role: "admin", companyStatus: "approved" }).select("_id");
        await Notification.insertMany(
          admins.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Budget rejected by finance",
            message: `Budget for "${boardTitle}" was rejected by ${actor.name ?? "finance"}: ${rejectionReason}`,
          }))
        );
        admins.forEach((u) => notifyIds.push(String(u._id)));
      }
      notifyIds.forEach((id) => emitNotification(id));
      return NextResponse.json({ budget });
    }

    return jsonError("Invalid budget status.");
  }

  if (type === "bill") {
    if (String(actor.role) !== "finance") return jsonError("Only finance can manage bills.", 403);
    const existing = await ExpenseBill.findOne({ _id: id, company: actor.company }).populate({
      path: "budget",
      populate: { path: "board", select: "title" },
    });
    if (!existing) return jsonError("Bill not found.", 404);
    const boardTitle = String((existing.budget as any)?.board?.title ?? "");

    if (status === "paid") {
      if (existing.status !== "pending") return jsonError("Bill already processed.", 409);
      const bill = await ExpenseBill.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status: "paid", paidAt: new Date() } },
        { new: true },
      );
      const requesterId = existing.generatedBy;
      if (requesterId) {
        await Notification.create({
          user: requesterId,
          company: actor.company,
          type: "info",
          title: "Expense bill paid",
          message: `Expense bill for "${boardTitle}" has been marked as paid by ${actor.name ?? "finance"}.`,
        });
        emitNotification(String(requesterId));
      }
      return NextResponse.json({ bill });
    }

    return jsonError("Invalid bill status.");
  }

  return jsonError("Unknown finance update.");
}
