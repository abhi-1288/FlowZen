import { ATSJob } from "@/models/ATSJob";
import { ATSOffer } from "@/models/ATSOffer";
import { Attendance } from "@/models/Attendance";
import { Board } from "@/models/Board";
import { ClientInvoice } from "@/models/ClientInvoice";
import { ExpenseBill } from "@/models/ExpenseBill";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { ITTicket } from "@/models/ITTicket";
import { JoinRequest } from "@/models/JoinRequest";
import { LeaveRequest } from "@/models/LeaveRequest";
import { ProjectBudget } from "@/models/ProjectBudget";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { WfhRequest } from "@/models/WfhRequest";
import { CheckOutRequest } from "@/models/CheckOutRequest";
import { addDays, startOfDay } from "./dates";
import { startOfUtcDayMs } from "@/lib/date-utils";
import { getColumnSets, getCompanyBoardIds, getMyBoardIds } from "./trends";
import type { CommandCenterContext } from "./context";
import type { AttentionItem } from "./types";

const PENDING_STATUSES = ["pending", "hr-approved", "manager-approved"];

export async function buildAttention(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const producers: Array<() => Promise<AttentionItem[]>> = [];

  const push = (fn: () => Promise<AttentionItem[]>) => producers.push(fn);

  // ── Overdue tasks ────────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "projects") {
    push(() => overdueTasksCompany(ctx));
  } else if (ctx.variant === "personal") {
    push(() => overdueTasksPersonal(ctx));
  }

  // ── Blocked tasks ────────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "projects") {
    push(() => blockedTasks(ctx));
  }

  // ── Pending approvals ────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "hr") {
    push(() => pendingHrApprovals(ctx));
  }
  if (ctx.variant === "admin" || ctx.variant === "finance") {
    push(() => pendingFinanceApprovals(ctx));
  }
  if (ctx.variant === "security") {
    push(() => pendingIdentityApprovals(ctx));
  }
  if (ctx.variant === "personal") {
    push(() => pendingPersonalRequests(ctx));
  }

  // ── IT ───────────────────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "it") {
    push(() => criticalTickets(ctx));
    push(() => provisioningPending(ctx));
  }

  // ── HR ───────────────────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "hr") {
    push(() => contractsEnding(ctx));
    push(() => missingAttendance(ctx));
    push(() => offersAwaiting(ctx));
    push(() => jobsClosing(ctx));
  }

  // ── Finance ──────────────────────────────────────────────────────
  if (ctx.variant === "admin" || ctx.variant === "finance") {
    push(() => overdueInvoices(ctx));
    push(() => budgetDeadlines(ctx));
  }

  // ── Security ─────────────────────────────────────────────────────
  if (ctx.variant === "security") {
    push(() => inactiveAccounts(ctx));
  }

  // ── Personal ─────────────────────────────────────────────────────
  if (ctx.variant === "personal") {
    push(() => myOpenTickets(ctx));
  }

  const items = (await Promise.all(producers.map((fn) => fn()))).flat();
  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  items.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count,
  );
  return items.slice(0, 8);
}

async function boardTitleMap(boardIds: string[]): Promise<Map<string, string>> {
  const boards = await Board.find({ _id: { $in: boardIds } }).select("title").lean();
  const map = new Map<string, string>();
  for (const b of boards) map.set(String(b._id), String(b.title ?? "Project"));
  return map;
}

async function overdueTasksCompany(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const boardIds = await getCompanyBoardIds(ctx.companyId);
  if (boardIds.length === 0) return [];
  const sets = await getColumnSets(boardIds);
  const tasks = await Task.find({
    board: { $in: boardIds },
    column: { $nin: sets.doneIds },
    dueDate: { $lt: ctx.now },
  })
    .select("board title dueDate")
    .limit(300)
    .lean();
  if (tasks.length === 0) return [];
  const titles = await boardTitleMap(boardIds);
  const byBoard = new Map<string, number>();
  for (const t of tasks) {
    const key = String(t.board);
    byBoard.set(key, (byBoard.get(key) ?? 0) + 1);
  }
  const topBoards = [...byBoard.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ name: titles.get(id) ?? "Project", count }));
  const breakdown = topBoards.map((b) => `${b.count} in ${b.name}`).join(", ");
  return [
    {
      id: "overdue-tasks",
      severity: "critical",
      title: `${tasks.length} Overdue ${tasks.length === 1 ? "Task" : "Tasks"}`,
      description:
        breakdown.length > 0
          ? `${breakdown} are past their due date and need attention.`
          : "Tasks past their due date need attention.",
      count: tasks.length,
      module: "Tasks",
      actionUrl: "/board",
      actionLabel: "Review Tasks",
    },
  ];
}

async function overdueTasksPersonal(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const boardIds = await getMyBoardIds(ctx.userId);
  if (boardIds.length === 0) return [];
  const sets = await getColumnSets(boardIds);
  const count = await Task.countDocuments({
    board: { $in: boardIds },
    assignees: ctx.userId,
    column: { $nin: sets.doneIds },
    dueDate: { $lt: ctx.now },
  });
  if (count === 0) return [];
  return [
    {
      id: "my-overdue-tasks",
      severity: "critical",
      title: `${count} Overdue ${count === 1 ? "Task" : "Tasks"} Assigned to You`,
      description: "You have tasks past their due date. Mark them complete or request an extension.",
      count,
      module: "Tasks",
      actionUrl: "/board",
      actionLabel: "View Tasks",
    },
  ];
}

async function blockedTasks(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const boardIds = await getCompanyBoardIds(ctx.companyId);
  if (boardIds.length === 0) return [];
  const sets = await getColumnSets(boardIds);
  if (sets.blockedIds.length === 0) return [];
  const count = await Task.countDocuments({
    board: { $in: boardIds },
    column: { $in: sets.blockedIds },
  });
  if (count === 0) return [];
  return [
    {
      id: "blocked-tasks",
      severity: "warning",
      title: `${count} Blocked ${count === 1 ? "Task" : "Tasks"}`,
      description: "Tasks sitting in blocked/waiting columns are holding up progress.",
      count,
      module: "Tasks",
      actionUrl: "/board",
      actionLabel: "View Tasks",
    },
  ];
}

async function pendingHrApprovals(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const [join, leaves, wfh, checkout] = await Promise.all([
    JoinRequest.countDocuments({ company: companyId, status: { $in: ["pending", "hr-approved"] } }),
    LeaveRequest.countDocuments({ company: companyId, status: { $in: PENDING_STATUSES } }),
    WfhRequest.countDocuments({ company: companyId, status: { $in: PENDING_STATUSES } }),
    CheckOutRequest.countDocuments({ company: companyId, status: "pending" }),
  ]);
  const total = join + leaves + wfh + checkout;
  if (total === 0) return [];
  const parts: string[] = [];
  if (leaves > 0) parts.push(`${leaves} leave`);
  if (wfh > 0) parts.push(`${wfh} WFH`);
  if (join > 0) parts.push(`${join} other`);
  if (checkout > 0) parts.push(`${checkout} check-out`);
  return [
    {
      id: "hr-approvals",
      severity: "warning",
      title: `${total} Pending Approval${total === 1 ? "" : "s"}`,
      description: `Waiting on you: ${parts.join(", ")} request${total === 1 ? "" : "s"}.`,
      count: total,
      module: "Approvals",
      actionUrl: "/profile/approvals",
      actionLabel: "Review",
    },
  ];
}

async function pendingFinanceApprovals(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const [salaries, expenses, bills, budgets] = await Promise.all([
    FinanceSalary.countDocuments({ company: companyId, status: { $in: ["pending", "approved"] } }),
    ExpenseRequest.countDocuments({ company: companyId, status: { $in: ["pending", "forwarded", "approved"] } }),
    ExpenseBill.countDocuments({ company: companyId, status: "pending" }),
    ProjectBudget.countDocuments({ company: companyId, status: "pending" }),
  ]);
  const total = salaries + expenses + bills + budgets;
  if (total === 0) return [];
  const parts: string[] = [];
  if (salaries > 0) parts.push(`${salaries} salary`);
  if (expenses > 0) parts.push(`${expenses} expense`);
  if (budgets > 0) parts.push(`${budgets} budget`);
  if (bills > 0) parts.push(`${bills} bill`);
  return [
    {
      id: "finance-approvals",
      severity: "warning",
      title: `${total} Finance Approval${total === 1 ? "" : "s"} Pending`,
      description: `Waiting on you: ${parts.join(", ")}.`,
      count: total,
      module: "Finance",
      actionUrl: "/profile/finance",
      actionLabel: "Review",
    },
  ];
}

async function pendingIdentityApprovals(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const count = await JoinRequest.countDocuments({
    company: companyId,
    status: { $in: ["pending", "hr-approved"] },
    kind: {
      $in: ["identity-code", "role-transfer", "region-address", "employment-type", "id-card", "document-letter"],
    },
  });
  if (count === 0) return [];
  return [
    {
      id: "identity-approvals",
      severity: "warning",
      title: `${count} Identity/Approval Request${count === 1 ? "" : "s"}`,
      description: "Identity codes, role changes and document requests await a decision.",
      count,
      module: "Security",
      actionUrl: "/profile/approvals",
      actionLabel: "Review",
    },
  ];
}

async function pendingPersonalRequests(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const [leave, wfh, checkout, expense] = await Promise.all([
    LeaveRequest.countDocuments({ requester: ctx.userId, status: { $in: PENDING_STATUSES } }),
    WfhRequest.countDocuments({ requester: ctx.userId, status: { $in: PENDING_STATUSES } }),
    CheckOutRequest.countDocuments({ requester: ctx.userId, status: "pending" }),
    ExpenseRequest.countDocuments({ requester: ctx.userId, status: { $in: ["pending", "forwarded"] } }),
  ]);
  const total = leave + wfh + checkout + expense;
  if (total === 0) return [];
  return [
    {
      id: "my-pending",
      severity: "warning",
      title: `${total} Request${total === 1 ? "" : "s"} Awaiting Approval`,
      description: "Your pending requests are still being reviewed.",
      count: total,
      module: "Approvals",
      actionUrl: "/profile/approvals",
      actionLabel: "Track",
    },
  ];
}

async function criticalTickets(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const count = await ITTicket.countDocuments({
    company: companyId,
    priority: { $in: ["HIGH", "URGENT"] },
    status: { $nin: ["RESOLVED", "CANCELLED"] },
  });
  if (count === 0) return [];
  return [
    {
      id: "critical-tickets",
      severity: "critical",
      title: `${count} Critical IT ${count === 1 ? "Ticket" : "Tickets"}`,
      description: "High/urgent priority tickets are still open.",
      count,
      module: "IT",
      actionUrl: "/it/board",
      actionLabel: "Open Tickets",
    },
  ];
}

async function provisioningPending(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const count = await ITProvisioningRequest.countDocuments({
    company: companyId,
    status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED", "ACCOUNT_CREATED"] },
  });
  if (count === 0) return [];
  return [
    {
      id: "provisioning",
      severity: "warning",
      title: `${count} Provisioning Request${count === 1 ? "" : "s"} Incomplete`,
      description: "New joiners are waiting on accounts and access.",
      count,
      module: "IT",
      actionUrl: "/it/board",
      actionLabel: "Open",
    },
  ];
}

async function contractsEnding(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const end = addDays(ctx.now, 30);
  const members = await User.find({
    company: companyId,
    companyStatus: "approved",
    employmentEndDate: { $gte: startOfDay(ctx.now), $lte: end },
  })
    .select("name employmentEndDate")
    .lean();
  if (members.length === 0) return [];
  const upcomingNames = members
    .sort((a, b) => (a.employmentEndDate?.getTime() ?? 0) - (b.employmentEndDate?.getTime() ?? 0))
    .slice(0, 3)
    .map((m) => {
      const when = m.employmentEndDate?.toLocaleDateString("en-US", { day: "numeric", month: "short" }) ?? "";
      return `${String(m.name).split(" ")[0]} (${when})`;
    });
  return [
    {
      id: "contracts-ending",
      severity: "warning",
      title: `${members.length} ${members.length === 1 ? "Contract" : "Contracts"} Ending Soon`,
      description:
        upcomingNames.length > 0
          ? `Within 30 days: ${upcomingNames.join(", ")}.`
          : "Contracts ending within the next 30 days.",
      count: members.length,
      module: "People",
      actionUrl: "/profile/members",
      actionLabel: "Review",
    },
  ];
}

async function missingAttendance(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const today = startOfDay(ctx.now);
  const [members, presentMembers, onLeave] = await Promise.all([
    User.find({ company: companyId, companyStatus: "approved" }).select("_id").lean(),
    Attendance.distinct("user", { date: today, status: "present" }),
    LeaveRequest.find({
      company: companyId,
      status: "approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    })
      .distinct("requester"),
  ]);
  const presentSet = new Set(presentMembers.map(String));
  const leaveSet = new Set((onLeave as unknown as string[]).map(String));
  const missing = members.filter((m) => {
    const id = String(m._id);
    return !presentSet.has(id) && !leaveSet.has(id);
  });
  if (missing.length === 0) return [];
  return [
    {
      id: "missing-attendance",
      severity: "info",
      title: `${missing.length} Employee${missing.length === 1 ? "" : "s"} Missing Attendance`,
      description: "No attendance record marked today (excluding approved leave).",
      count: missing.length,
      module: "Attendance",
      actionUrl: "/profile/attendance",
      actionLabel: "View",
    },
  ];
}

async function offersAwaiting(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const count = await ATSOffer.countDocuments({
    company: companyId,
    status: { $in: ["draft", "sent"] },
  });
  if (count === 0) return [];
  return [
    {
      id: "offers-pending",
      severity: "warning",
      title: `${count} Offer${count === 1 ? "" : "s"} Awaiting Decision`,
      description: "Draft or sent offers still need a decision from the candidate or HR.",
      count,
      module: "Recruitment",
      actionUrl: "/recruitment/offers",
      actionLabel: "Review",
    },
  ];
}

async function jobsClosing(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  // `autoCloseDate` is a wall clock, and the shared startOfDay/addDays helpers
  // build local-time boundaries (payroll and attendance depend on that), so the
  // window for this query is computed on UTC day boundaries instead.
  const dayStart = startOfUtcDayMs(ctx.now);
  const end = dayStart + 14 * 86_400_000 + 86_400_000 - 1;
  const count = await ATSJob.countDocuments({
    company: companyId,
    status: "open",
    autoCloseDate: { $gte: new Date(dayStart), $lte: new Date(end) },
  });
  if (count === 0) return [];
  return [
    {
      id: "jobs-closing",
      severity: "info",
      title: `${count} Open ${count === 1 ? "Job" : "Jobs"} Closing Soon`,
      description: "Applications will be disabled when these auto-close.",
      count,
      module: "Recruitment",
      actionUrl: "/recruitment/jobs",
      actionLabel: "Review",
    },
  ];
}

async function overdueInvoices(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const cutoff = new Date(ctx.now.getTime() - 15 * 24 * 60 * 60 * 1000);
  const rows = await ClientInvoice.aggregate([
    {
      $match: {
        company: companyId,
        status: "pending",
        createdAt: { $lt: cutoff },
      },
    },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
  ]);
  const stat = rows[0];
  if (!stat || stat.count === 0) return [];
  return [
    {
      id: "overdue-invoices",
      severity: "warning",
      title: `${stat.count} Overdue ${stat.count === 1 ? "Invoice" : "Invoices"}`,
      description: `Unpaid invoices older than 15 days totalling ₹${Math.round(Number(stat.total)).toLocaleString("en-IN")}.`,
      count: stat.count,
      module: "Finance",
      actionUrl: "/profile/finance",
      actionLabel: "Review",
    },
  ];
}

async function budgetDeadlines(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const end = addDays(ctx.now, 14);
  const count = await ProjectBudget.countDocuments({
    company: companyId,
    status: "approved",
    deadline: { $gte: startOfDay(ctx.now), $lte: end },
  });
  if (count === 0) return [];
  return [
    {
      id: "budget-deadlines",
      severity: "info",
      title: `${count} Budget Deadline${count === 1 ? "" : "s"} in 2 Weeks`,
      description: "Approved project budgets are approaching their deadline.",
      count,
      module: "Finance",
      actionUrl: "/profile/finance",
      actionLabel: "Review",
    },
  ];
}

async function inactiveAccounts(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const cutoff = new Date(ctx.now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const count = await User.countDocuments({
    company: companyId,
    companyStatus: "approved",
    $or: [{ lastOnline: null }, { lastOnline: { $lt: cutoff } }],
  });
  if (count === 0) return [];
  return [
    {
      id: "inactive-accounts",
      severity: "warning",
      title: `${count} Inactive ${count === 1 ? "Account" : "Accounts"}`,
      description: "Accounts that haven't been active in over 30 days.",
      count,
      module: "Security",
      actionUrl: "/profile/security",
      actionLabel: "Review",
    },
  ];
}

async function myOpenTickets(ctx: CommandCenterContext): Promise<AttentionItem[]> {
  const companyId = ctx.companyId;
  if (!companyId) return [];
  const count = await ITTicket.countDocuments({
    company: companyId,
    requester: ctx.userId,
    status: { $nin: ["RESOLVED", "CANCELLED"] },
  });
  if (count === 0) return [];
  return [
    {
      id: "my-open-tickets",
      severity: "info",
      title: `${count} Open IT ${count === 1 ? "Ticket" : "Tickets"}`,
      description: "Your IT tickets are still being worked on.",
      count,
      module: "IT",
      actionUrl: "/it/tickets",
      actionLabel: "View",
    },
  ];
}