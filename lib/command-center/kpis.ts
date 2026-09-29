import { ATSJob } from "@/models/ATSJob";
import { Attendance } from "@/models/Attendance";
import { ClientInvoice } from "@/models/ClientInvoice";
import { Company } from "@/models/Company";
import { ExpenseBill } from "@/models/ExpenseBill";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ITJoiningCode } from "@/models/ITJoiningCode";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { ITTicket } from "@/models/ITTicket";
import { JoinRequest } from "@/models/JoinRequest";
import { LeaveRequest } from "@/models/LeaveRequest";
import { ProjectBudget } from "@/models/ProjectBudget";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { WfhRequest } from "@/models/WfhRequest";
import { CheckOutRequest } from "@/models/CheckOutRequest";
import { addDays, leaveWindow, overlapDays, startOfDay } from "./dates";
import { formatCount, formatInrCompact, formatPct, trendFrom } from "./format";
import { getColumnSets, getMyBoardIds } from "./trends";
import { buildFilters, type CommandCenterFilters } from "./filters";
import type { CommandCenterContext } from "./context";
import type { Kpi } from "./types";

const PENDING_STATUSES = ["pending", "hr-approved", "manager-approved"];
const PENDING_JOIN = ["pending", "hr-approved"];

async function countActiveMembers(
  companyId: string | null,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  return User.countDocuments({ company: companyId, companyStatus: "approved", ...filters.byUser() });
}

/**
 * `Attendance` carries no `company` column, so the tenant boundary has to be
 * the set of user ids. Without this both of these were counting every other
 * tenant's present users.
 */
async function attendanceToday(
  companyId: string | null,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const today = startOfDay(new Date());
  const members = await Attendance.distinct("user", {
    date: today,
    status: "present",
    ...filters.byVisibleMember("user"),
  });
  return members.length;
}

async function presentOn(
  companyId: string | null,
  date: Date,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const members = await Attendance.distinct("user", {
    date,
    status: "present",
    ...filters.byVisibleMember("user"),
  });
  return members.length;
}

interface BoardScoped {
  boardIds: string[];
  doneIds: string[];
  blockedIds: string[];
}

async function buildScoped(ctx: CommandCenterContext): Promise<BoardScoped> {
  const boardIds =
    ctx.variant === "personal"
      ? await getMyBoardIds(ctx.userId)
      : (ctx.boardIds ?? await getMyBoardIds(ctx.userId));
  const sets = await getColumnSets(boardIds);
  return { boardIds, doneIds: sets.doneIds, blockedIds: sets.blockedIds };
}

export async function buildKpis(ctx: CommandCenterContext): Promise<Kpi[]> {
  const { companyId, variant, now } = ctx;
  const filters = buildFilters(ctx);
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yesterday = addDays(today, -1);

  if (variant === "admin" || variant === "hr") {
    const [activeMembers, presentToday, yPresent, joinedThisMonth] =
      await Promise.all([
        countActiveMembers(companyId, filters),
        attendanceToday(companyId, filters),
        presentOn(companyId, yesterday, filters),
        companyId
          ? User.countDocuments({
              company: companyId,
              companyStatus: "approved",
              companyJoined: { $gte: monthStart },
              ...filters.byUser(),
            })
          : Promise.resolve(0),
      ]);
    const todayPct = activeMembers > 0 ? (presentToday / activeMembers) * 100 : 0;
    const yPct = activeMembers > 0 ? (yPresent / activeMembers) * 100 : 0;

    const common = [
      {
        key: "employees",
        label: "Employees",
        value: formatCount(activeMembers),
        trend: trendFrom(joinedThisMonth, 0, (v) => `+${v}`),
        icon: "users",
        href: "/profile/members",
      },
      {
        key: "attendance",
        label: "Attendance",
        value: formatPct(todayPct),
        trend: trendFrom(todayPct, yPct, (v) => `${v}%`),
        icon: "calendar",
        href: "/profile/attendance",
      },
    ];

    if (variant === "admin") {
      // `ctx.boardIds` is already resolved by the orchestrator, so the second
      // company->members->boards walk this used to do is gone.
      const boards = ctx.boardIds ?? [];
      const [openTickets, openJobs, monthSpend, prevSpend] = await Promise.all([
        companyId
          ? ITTicket.countDocuments({
              company: companyId,
              status: { $nin: ["RESOLVED", "CANCELLED"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ATSJob.countDocuments({ company: companyId, status: "open", ...filters.byRegionLabel() })
          : Promise.resolve(0),
        companyId ? sumMonthSpend(companyId, monthStart, nextMonthPercent(now), filters) : Promise.resolve(0),
        companyId ? sumMonthSpend(companyId, lastMonthStart(now), monthStart, filters) : Promise.resolve(0),
      ]);
      return [
        ...common,
        {
          key: "projects",
          label: "Active Projects",
          value: formatCount(boards.length),
          trend: { direction: "flat", label: `${boards.length} running` },
          icon: "briefcase",
          href: "/board",
        },
        {
          key: "finance",
          label: "Monthly Spend",
          value: formatInrCompact(monthSpend),
          trend: trendFrom(monthSpend, prevSpend, (v) => formatInrCompact(v)),
          icon: "wallet",
          href: "/profile/finance",
        },
        {
          key: "open-jobs",
          label: "Open Positions",
          value: formatCount(openJobs),
          trend: undefined,
          icon: "target",
          href: "/recruitment/jobs",
        },
        {
          key: "open-it",
          label: "Open IT Tickets",
          value: formatCount(openTickets),
          trend: undefined,
          icon: "wrench",
          href: "/it/board",
        },
      ];
    }

    const [openPositions, contractsEnding, onLeaveToday] = await Promise.all([
      companyId
        ? ATSJob.countDocuments({ company: companyId, status: "open", ...filters.byRegionLabel() })
        : Promise.resolve(0),
      companyId
        ? User.countDocuments({
            company: companyId,
            companyStatus: "approved",
            employmentEndDate: { $gte: monthStart, $lte: addDays(now, 30) },
            ...filters.byUser(),
          })
        : Promise.resolve(0),
      companyId
        ? LeaveRequest.countDocuments({
            company: companyId,
            status: "approved",
            startDate: { $lte: today },
            endDate: { $gte: today },
            ...filters.byMember("requester"),
          })
        : Promise.resolve(0),
    ]);

    return [
      ...common,
      {
        key: "open-positions",
        label: "Open Positions",
        value: formatCount(openPositions),
        trend: undefined,
        icon: "target",
        href: "/recruitment/jobs",
      },
      {
        key: "on-leave",
        label: "On Leave Today",
        value: formatCount(onLeaveToday),
        trend: undefined,
        icon: "clock",
        href: "/profile/attendance",
      },
      {
        key: "contracts",
        label: "Contracts Ending",
        value: formatCount(contractsEnding),
        trend: undefined,
        icon: "file",
        href: "/profile/members",
      },
    ];
  }

  if (variant === "finance") {
    const [revenue, prevRevenue, expenses, payroll, receivables, payables, pendingSalary, pendingExpenses, pendingBills, pendingBudgets] =
      await Promise.all([
        sumPaidInvoices(companyId, monthStart, nextMonthPercent(now), filters),
        sumPaidInvoices(companyId, lastMonthStart(now), monthStart, filters),
        sumMonthExpensesPaid(companyId, monthStart, nextMonthPercent(now), filters),
        sumPaidSalaries(companyId, monthStart, nextMonthPercent(now), filters),
        sumPendingInvoices(companyId, filters),
        sumPendingPayables(companyId, filters),
        companyId
          ? FinanceSalary.countDocuments({
              company: companyId,
              status: { $in: ["pending", "approved"] },
              ...filters.byMember("employee"),
            })
          : Promise.resolve(0),
        companyId
          ? ExpenseRequest.countDocuments({
              company: companyId,
              status: { $in: ["pending", "forwarded", "approved"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ExpenseBill.countDocuments({
              company: companyId,
              status: "pending",
              ...(await filters.bill()),
            })
          : Promise.resolve(0),
        companyId
          ? ProjectBudget.countDocuments({ company: companyId, status: "pending", ...filters.byBoard() })
          : Promise.resolve(0),
      ]);
    const pendingCount = Number(pendingSalary) + Number(pendingExpenses) + Number(pendingBills) + Number(pendingBudgets);
    return [
      {
        key: "revenue",
        label: "Revenue",
        value: formatInrCompact(revenue),
        trend: trendFrom(revenue, prevRevenue, (v) => formatInrCompact(v)),
        icon: "banknote",
        href: "/profile/finance",
      },
      {
        key: "expenses",
        label: "Expenses",
        value: formatInrCompact(expenses),
        trend: undefined,
        icon: "wallet",
        href: "/profile/finance",
      },
      {
        key: "payroll",
        label: "Payroll",
        value: formatInrCompact(payroll),
        trend: undefined,
        icon: "users",
        href: "/profile/finance",
      },
      {
        key: "receivables",
        label: "Receivables",
        value: formatInrCompact(receivables),
        trend: undefined,
        icon: "arrow-down",
        href: "/profile/finance",
      },
      {
        key: "payables",
        label: "Payables",
        value: formatInrCompact(payables),
        trend: undefined,
        icon: "arrow-up",
        href: "/profile/finance",
      },
      {
        key: "pending-approvals",
        label: "Pending Approvals",
        value: formatCount(pendingCount),
        trend: undefined,
        icon: "check",
        href: "/profile/finance",
      },
    ];
  }

  if (variant === "projects") {
    const scoped = await buildScoped(ctx);
    const [projectTasks, budgetsPending] = await Promise.all([
      scoped.boardIds.length > 0
        ? Task.aggregate([
            { $match: { board: { $in: scoped.boardIds } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                done: { $sum: { $cond: [{ $in: ["$column", scoped.doneIds] }, 1, 0] } },
                overdue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $not: [{ $in: ["$column", scoped.doneIds] }] },
                          { $lt: ["$dueDate", now] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                blocked: { $sum: { $cond: [{ $in: ["$column", scoped.blockedIds] }, 1, 0] } },
              },
            },
          ])
        : Promise.resolve([]),
      companyId
        ? ProjectBudget.countDocuments({ company: companyId, status: "pending", ...filters.byBoard() })
        : Promise.resolve(0),
    ]);
    const stats = projectTasks[0] ?? { total: 0, done: 0, overdue: 0, blocked: 0 };
    const atRisk = stats.overdue + stats.blocked;
    const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
    return [
      {
        key: "active-projects",
        label: "Active Projects",
        value: formatCount(scoped.boardIds.length),
        trend: undefined,
        icon: "briefcase",
        href: "/board",
      },
      {
        key: "on-track",
        label: "On Track",
        value: formatCount(Math.max(0, scoped.boardIds.length - atRisk)),
        trend: undefined,
        icon: "check",
        href: "/board",
      },
      {
        key: "at-risk",
        label: "At Risk",
        value: formatCount(atRisk),
        trend: undefined,
        icon: "alert",
        href: "/board",
      },
      {
        key: "progress",
        label: "Task Completion",
        value: formatPct(pct),
        trend: undefined,
        icon: "target",
        href: "/board",
      },
      {
        key: "overdue",
        label: "Overdue Tasks",
        value: formatCount(stats.overdue),
        trend: undefined,
        icon: "clock",
        href: "/board",
      },
      {
        key: "budgets",
        label: "Budgets Pending",
        value: formatCount(budgetsPending),
        trend: undefined,
        icon: "wallet",
        href: "/profile/finance",
      },
    ];
  }

  if (variant === "it") {
    const [openTickets, criticalTickets, resolvedMonth, pendingProvisioning, activeCodes] =
      await Promise.all([
        companyId
          ? ITTicket.countDocuments({
              company: companyId,
              status: { $nin: ["RESOLVED", "CANCELLED"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ITTicket.countDocuments({
              company: companyId,
              priority: { $in: ["HIGH", "URGENT"] },
              status: { $nin: ["RESOLVED", "CANCELLED"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ITTicket.countDocuments({
              company: companyId,
              status: "RESOLVED",
              resolvedAt: { $gte: monthStart },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ITProvisioningRequest.countDocuments({
              company: companyId,
              status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED", "ACCOUNT_CREATED"] },
              ...filters.byMember("employee"),
            })
          : Promise.resolve(0),
        companyId
          ? ITJoiningCode.countDocuments({
              company: companyId,
              status: "active",
              ...filters.byMember("user"),
            })
          : Promise.resolve(0),
      ]);
    return [
      { key: "open-tickets", label: "Open Tickets", value: formatCount(openTickets), trend: undefined, icon: "wrench", href: "/it/board" },
      { key: "critical-tickets", label: "Critical", value: formatCount(criticalTickets), trend: undefined, icon: "alert", href: "/it/board" },
      { key: "resolved-month", label: "Resolved This Month", value: formatCount(resolvedMonth), trend: undefined, icon: "check", href: "/it/board" },
      { key: "provisioning", label: "Pending Provisioning", value: formatCount(pendingProvisioning), trend: undefined, icon: "users", href: "/it/board" },
      { key: "join-codes", label: "Active Join Codes", value: formatCount(activeCodes), trend: undefined, icon: "key", href: "/it/board" },
    ];
  }

  if (variant === "security") {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsers, pendingAccess, inactiveAccounts, pendingApprovals, openTickets] =
      await Promise.all([
        countActiveMembers(companyId, filters),
        companyId
          ? ITProvisioningRequest.countDocuments({
              company: companyId,
              status: { $in: ["PENDING", "UNDER_REVIEW"] },
              ...filters.byMember("employee"),
            })
          : Promise.resolve(0),
        companyId
          ? User.countDocuments({
              company: companyId,
              companyStatus: "approved",
              ...filters.byUser(),
              $or: [{ lastOnline: null }, { lastOnline: { $lt: cutoff } }],
            })
          : Promise.resolve(0),
        companyId
          ? JoinRequest.countDocuments({
              company: companyId,
              status: { $in: PENDING_JOIN },
              kind: { $in: ["identity-code", "role-transfer", "region-address", "employment-type", "id-card", "document-letter"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
        companyId
          ? ITTicket.countDocuments({
              company: companyId,
              status: { $nin: ["RESOLVED", "CANCELLED"] },
              priority: { $in: ["HIGH", "URGENT"] },
              ...filters.byMember("requester"),
            })
          : Promise.resolve(0),
      ]);
    return [
      { key: "active-users", label: "Active Users", value: formatCount(activeUsers), trend: undefined, icon: "users", href: "/profile/members" },
      { key: "access-requests", label: "Access Requests", value: formatCount(pendingAccess), trend: undefined, icon: "key", href: "/profile/security" },
      { key: "inactive", label: "Inactive Accounts", value: formatCount(inactiveAccounts), trend: undefined, icon: "clock", href: "/profile/security" },
      { key: "pend-approvals", label: "Pending Approvals", value: formatCount(pendingApprovals), trend: undefined, icon: "check", href: "/profile/approvals" },
      { key: "esc-tickets", label: "Escalations", value: formatCount(openTickets), trend: undefined, icon: "alert", href: "/it/board" },
    ];
  }

  const scoped = await buildScoped(ctx);
  const [openTasks, overdueTasks, presentToday, leaveStatus] = await Promise.all([
    scoped.boardIds.length > 0
      ? Task.countDocuments({
          board: { $in: scoped.boardIds },
          assignees: ctx.userId,
          column: { $nin: scoped.doneIds },
        })
      : Promise.resolve(0),
    scoped.boardIds.length > 0
      ? Task.countDocuments({
          board: { $in: scoped.boardIds },
          assignees: ctx.userId,
          column: { $nin: scoped.doneIds },
          dueDate: { $lt: now },
        })
      : Promise.resolve(0),
    companyId
      ? Attendance.countDocuments({
          // `user` is enough on its own for a personal view, and spreading
          // `byVisibleMember` over it would clobber this with `{ $in: [] }` —
          // personal views carry no visible-member list, so the spread only
          // applies once a region or company-wide scope is in play.
          user: ctx.userId,
          date: today,
          status: "present",
          ...(ctx.memberIds ? filters.byVisibleMember("user") : {}),
        })
      : Promise.resolve(0),
    computeLeaveBalance(ctx),
  ]);

  let myPending = 0;
  if (companyId) {
    const counts = await Promise.all([
      LeaveRequest.countDocuments({ requester: ctx.userId, status: { $in: PENDING_STATUSES } }),
      WfhRequest.countDocuments({ requester: ctx.userId, status: { $in: PENDING_STATUSES } }),
      CheckOutRequest.countDocuments({ requester: ctx.userId, status: "pending" }),
      ExpenseRequest.countDocuments({ requester: ctx.userId, status: { $in: ["pending", "forwarded"] } }),
    ]);
    myPending = counts.reduce((a, b) => a + b, 0);
  }
  const myProjects = scoped.boardIds.length;

  return [
    {
      key: "my-tasks",
      label: "My Tasks",
      value: formatCount(openTasks),
      trend: undefined,
      icon: "check",
      href: "/board",
    },
    {
      key: "my-overdue",
      label: "Overdue",
      value: formatCount(overdueTasks),
      trend: undefined,
      icon: "alert",
      href: "/board",
    },
    {
      key: "my-attendance",
      label: "Today",
      value: presentToday > 0 ? "Present" : "Absent",
      trend: undefined,
      icon: "calendar",
      href: "/profile/attendance",
    },
    {
      key: "my-leave",
      label: "Leave Balance",
      value: leaveStatus,
      trend: undefined,
      icon: "clock",
      href: "/profile/attendance",
    },
    {
      key: "my-projects",
      label: "My Projects",
      value: formatCount(myProjects),
      trend: undefined,
      icon: "briefcase",
      href: "/board",
    },
    {
      key: "my-requests",
      label: "Pending Requests",
      value: formatCount(myPending),
      trend: undefined,
      icon: "inbox",
      href: "/profile/approvals",
    },
  ];
}

async function computeLeaveBalance(ctx: CommandCenterContext): Promise<string> {
  const { companyId, userId, now } = ctx;
  if (!companyId) return "—";
  const company = (await Company.findById(companyId)
    .select("paidLeaveDays paidLeavePeriod carryForwardLeaveDays")
    .lean()) as { paidLeaveDays?: number; paidLeavePeriod?: string; carryForwardLeaveDays?: number } | null;
  if (!company) return "—";
  const paidLeaveDays = Number(company.paidLeaveDays ?? 0);
  const period: "monthly" | "yearly" = company.paidLeavePeriod === "yearly" ? "yearly" : "monthly";
  if (paidLeaveDays <= 0) return "—";

  const quota = leaveWindow(now, period);
  const usedLeaves = await LeaveRequest.find({
    requester: userId,
    company: companyId,
    isPaidLeave: { $ne: false },
    status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
    startDate: { $lte: quota.end },
    endDate: { $gte: quota.start },
  })
    .select("startDate endDate")
    .lean();
  const used = usedLeaves.reduce(
    (sum, leave) => sum + overlapDays(leave.startDate, leave.endDate, quota.start, quota.end),
    0,
  );
  let carry = 0;
  if (company.carryForwardLeaveDays) {
    const prevQuota = leaveWindow(new Date(quota.start.getTime() - 1), period);
    const prevLeaves = await LeaveRequest.find({
      requester: userId,
      company: companyId,
      isPaidLeave: { $ne: false },
      status: { $in: ["pending", "hr-approved", "manager-approved", "approved"] },
      startDate: { $lte: prevQuota.end },
      endDate: { $gte: prevQuota.start },
    })
      .select("startDate endDate")
      .lean();
    const usedPrev = prevLeaves.reduce(
      (sum, leave) => sum + overlapDays(leave.startDate, leave.endDate, prevQuota.start, prevQuota.end),
      0,
    );
    carry = Math.max(0, paidLeaveDays - usedPrev);
  }
  const remaining = Math.max(0, paidLeaveDays + carry - used);
  const display = Number.isInteger(remaining) ? String(remaining) : remaining.toFixed(1);
  return `${display} days`;
}

function nextMonthPercent(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function lastMonthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

async function sumPaidInvoices(
  companyId: string | null,
  start: Date,
  end: Date,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const rows = await ClientInvoice.aggregate([
    {
      $match: {
        company: companyId,
        status: "paid",
        paidAt: { $gte: start, $lt: end },
        ...filters.invoice(),
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total ?? 0;
}

async function sumPendingInvoices(
  companyId: string | null,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const rows = await ClientInvoice.aggregate([
    { $match: { company: companyId, status: "pending", ...filters.invoice() } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total ?? 0;
}

async function sumPaidSalaries(
  companyId: string | null,
  start: Date,
  end: Date,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const rows = await FinanceSalary.aggregate([
    {
      $match: {
        company: companyId,
        status: "paid",
        paidAt: { $gte: start, $lt: end },
        ...filters.byMember("employee"),
      },
    },
    { $group: { _id: null, total: { $sum: "$netSalary" } } },
  ]);
  return rows[0]?.total ?? 0;
}

async function sumMonthExpensesPaid(
  companyId: string | null,
  start: Date,
  end: Date,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const [requests, bills] = await Promise.all([
    ExpenseRequest.aggregate([
      {
        $match: {
          company: companyId,
          status: "disbursed",
          disbursedAt: { $gte: start, $lt: end },
          ...filters.byMember("requester"),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ExpenseBill.aggregate([
      {
        $match: {
          company: companyId,
          status: "paid",
          paidAt: { $gte: start, $lt: end },
          ...(await filters.bill()),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  return (requests[0]?.total ?? 0) + (bills[0]?.total ?? 0);
}

async function sumMonthSpend(
  companyId: string,
  start: Date,
  end: Date,
  filters: CommandCenterFilters,
): Promise<number> {
  const [expenses, payroll] = await Promise.all([
    sumMonthExpensesPaid(companyId, start, end, filters),
    sumPaidSalaries(companyId, start, end, filters),
  ]);
  return expenses + payroll;
}

async function sumPendingPayables(
  companyId: string | null,
  filters: CommandCenterFilters,
): Promise<number> {
  if (!companyId) return 0;
  const [expenses, bills] = await Promise.all([
    ExpenseRequest.aggregate([
      {
        $match: {
          company: companyId,
          status: { $in: ["approved", "accepted"] },
          ...filters.byMember("requester"),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ExpenseBill.aggregate([
      { $match: { company: companyId, status: "pending", ...(await filters.bill()) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  return (expenses[0]?.total ?? 0) + (bills[0]?.total ?? 0);
}