import { Attendance } from "@/models/Attendance";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Board } from "@/models/Board";
import { ClientInvoice } from "@/models/ClientInvoice";
import { Column } from "@/models/Column";
import { ExpenseBill } from "@/models/ExpenseBill";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ITProvisioningRequest } from "@/models/ITProvisioningRequest";
import { ITTicket } from "@/models/ITTicket";
import { ProjectBudget } from "@/models/ProjectBudget";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { bucketIndex, buildBuckets } from "./dates";
import type { Bucket } from "./dates";
import type { CommandCenterContext } from "./context";
import type { ProjectHealth, TrendMetric, Variant } from "./types";

export const DONE_RE = /done|complete|closed|finished|delivered/i;
export const BLOCKED_RE = /block|wait|hold|stuck|defer|parked/i;

export async function getCompanyBoardIds(companyId: string | null): Promise<string[]> {
  if (!companyId) return [];
  const members = await User.find({
    company: companyId,
    companyStatus: "approved",
  })
    .select("_id")
    .lean();
  const memberIds = members.map((m) => m._id);
  const boards = await Board.find({ owner: { $in: memberIds } })
    .select("_id")
    .lean();
  return boards.map((b) => String(b._id));
}

export async function getMyBoardIds(userId: string): Promise<string[]> {
  const boards = await Board.find({ "members.user": userId }).select("_id").lean();
  return boards.map((b) => String(b._id));
}

export async function getColumnSets(boardIds: string[]) {
  const cols = await Column.find({ board: { $in: boardIds } })
    .select("board title")
    .lean();
  const done: string[] = [];
  const blocked: string[] = [];
  for (const c of cols) {
    const title = String(c.title ?? "");
    if (DONE_RE.test(title)) done.push(String(c._id));
  }
  for (const c of cols) {
    const title = String(c.title ?? "");
    if (BLOCKED_RE.test(title) && !DONE_RE.test(title)) blocked.push(String(c._id));
  }
  return { doneIds: done, blockedIds: blocked, allIds: cols.map((c) => String(c._id)) };
}

function emptySeries(key: string, label: string, unit: string, buckets: Bucket[]): TrendMetric {
  return {
    key,
    label,
    unit,
    points: buckets.map((b) => ({ label: b.label, value: 0 })),
  };
}

async function attendanceSeries(
  companyId: string | null,
  activeMembers: number,
  buckets: Bucket[],
  userIdForPersonal?: string,
): Promise<TrendMetric> {
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const match: Record<string, unknown> = { date: { $gte: start, $lt: end } };
  if (userIdForPersonal) match["user"] = userIdForPersonal;
  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: "$date", users: { $addToSet: "$user" } } },
  ]);
  const counts = buckets.map(() => 0);
  for (const row of rows) {
    const idx = bucketIndex(new Date(row._id), buckets);
    if (idx >= 0) counts[idx] = (row.users as unknown[]).length;
  }
  const active = Math.max(1, userIdForPersonal ? 1 : activeMembers);
  return {
    key: "attendance",
    label: "Attendance",
    unit: "%",
    points: buckets.map((b, i) => ({
      label: b.label,
      value: Math.round((counts[i] / active) * 100),
    })),
  };
}

function createdCounts(docs: Array<Record<string, unknown>>, createdAtKey: string, buckets: Bucket[]): number[] {
  const counts = buckets.map(() => 0);
  for (const d of docs) {
    const at = d[createdAtKey] as Date | undefined;
    if (!at) continue;
    const idx = bucketIndex(new Date(at), buckets);
    if (idx >= 0) counts[idx] += 1;
  }
  return counts;
}

function sumCounts(
  docs: Array<Record<string, unknown>>,
  atKey: string,
  amountKey: string,
  buckets: Bucket[],
): number[] {
  const sums = buckets.map(() => 0);
  for (const d of docs) {
    const at = d[atKey] as Date | undefined;
    if (!at) continue;
    const idx = bucketIndex(new Date(at), buckets);
    if (idx >= 0) sums[idx] += Number(d[amountKey]) || 0;
  }
  return sums;
}

async function tasksSeries(
  boardIds: string[],
  buckets: Bucket[],
  userIdForPersonal?: string,
): Promise<TrendMetric> {
  if (boardIds.length === 0) return emptySeries("productivity", "Tasks created", "tasks", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const match: Record<string, unknown> = { board: { $in: boardIds }, createdAt: { $gte: start, $lt: end } };
  if (userIdForPersonal) match["assignees"] = userIdForPersonal;
  const tasks = await Task.find(match).select("createdAt").lean();
  return {
    key: "productivity",
    label: "Tasks created",
    unit: "tasks",
    points: buckets.map((b, i) => ({ label: b.label, value: createdCounts(tasks as any, "createdAt", buckets)[i] })),
  };
}

async function expenseSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("expenses", "Expenses", "₹", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const [requests, bills] = await Promise.all([
    ExpenseRequest.find({
      company: companyId,
      status: { $nin: ["rejected"] },
      createdAt: { $gte: start, $lt: end },
    })
      .select("amount createdAt")
      .lean(),
    ExpenseBill.find({ company: companyId, status: "paid", paidAt: { $gte: start, $lt: end } })
      .select("amount paidAt")
      .lean(),
  ]);
  const sums = sumCounts(
    requests as any,
    "createdAt",
    "amount",
    buckets,
  );
  const billSums = sumCounts(bills as any, "paidAt", "amount", buckets);
  return {
    key: "expenses",
    label: "Expenses",
    unit: "₹",
    points: buckets.map((b, i) => ({ label: b.label, value: Math.round(sums[i] + billSums[i]) })),
  };
}

async function revenueSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("revenue", "Revenue", "₹", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const invoices = await ClientInvoice.find({
    company: companyId,
    status: "paid",
    paidAt: { $gte: start, $lt: end },
  })
    .select("amount paidAt")
    .lean();
  const sums = sumCounts(invoices as any, "paidAt", "amount", buckets);
  return {
    key: "revenue",
    label: "Revenue",
    unit: "₹",
    points: buckets.map((b, i) => ({ label: b.label, value: Math.round(sums[i]) })),
  };
}

async function payrollSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("payroll", "Payroll", "₹", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const salaries = await FinanceSalary.find({
    company: companyId,
    status: "paid",
    paidAt: { $gte: start, $lt: end },
  })
    .select("netSalary paidAt")
    .lean();
  const sums = sumCounts(salaries as any, "paidAt", "netSalary", buckets);
  return {
    key: "payroll",
    label: "Payroll",
    unit: "₹",
    points: buckets.map((b, i) => ({ label: b.label, value: Math.round(sums[i]) })),
  };
}

async function candidateSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("candidates", "Candidates", "", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const candidates = await ATSCandidate.find({
    company: companyId,
    createdAt: { $gte: start, $lt: end },
  })
    .select("createdAt")
    .lean();
  const counts = createdCounts(candidates as any, "createdAt", buckets);
  return {
    key: "candidates",
    label: "Candidates",
    unit: "",
    points: buckets.map((b, i) => ({ label: b.label, value: counts[i] })),
  };
}

async function ticketSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("tickets", "Tickets created", "", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const tickets = await ITTicket.find({
    company: companyId,
    createdAt: { $gte: start, $lt: end },
  })
    .select("createdAt")
    .lean();
  const counts = createdCounts(tickets as any, "createdAt", buckets);
  return {
    key: "tickets",
    label: "Tickets created",
    unit: "",
    points: buckets.map((b, i) => ({ label: b.label, value: counts[i] })),
  };
}

async function ticketResolvedSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("tickets-resolved", "Tickets resolved", "", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const tickets = await ITTicket.find({
    company: companyId,
    resolvedAt: { $gte: start, $lt: end },
  })
    .select("resolvedAt")
    .lean();
  const counts = createdCounts(tickets as any, "resolvedAt", buckets);
  return {
    key: "tickets-resolved",
    label: "Tickets resolved",
    unit: "",
    points: buckets.map((b, i) => ({ label: b.label, value: counts[i] })),
  };
}

async function accessRequestSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("access-requests", "Access requests", "", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const requests = await ITProvisioningRequest.find({
    company: companyId,
    createdAt: { $gte: start, $lt: end },
  })
    .select("createdAt")
    .lean();
  const counts = createdCounts(requests as any, "createdAt", buckets);
  return {
    key: "access-requests",
    label: "Access requests",
    unit: "",
    points: buckets.map((b, i) => ({ label: b.label, value: counts[i] })),
  };
}

async function joinerSeries(companyId: string | null, buckets: Bucket[]): Promise<TrendMetric> {
  if (!companyId) return emptySeries("joiners", "New joiners", "", buckets);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const users = await User.find({
    company: companyId,
    companyStatus: "approved",
    companyJoined: { $gte: start, $lt: end },
  })
    .select("companyJoined")
    .lean();
  const counts = createdCounts(users as any, "companyJoined", buckets);
  return {
    key: "joiners",
    label: "New joiners",
    unit: "",
    points: buckets.map((b, i) => ({ label: b.label, value: counts[i] })),
  };
}

async function buildProjectHealth(
  companyId: string | null,
  boardIds: string[],
  now: Date,
): Promise<ProjectHealth[] | null> {
  if (boardIds.length === 0) return [];
  const sets = await getColumnSets(boardIds);
  const [boards, budgets, taskGroups] = await Promise.all([
    Board.find({ _id: { $in: boardIds } }).select("title").lean(),
    ProjectBudget.find({ company: companyId, board: { $in: boardIds } })
      .select("board deadline")
      .lean(),
    Task.aggregate([
      { $match: { board: { $in: boardIds } } },
      {
        $group: {
          _id: "$board",
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $in: ["$column", sets.doneIds] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: [{ $in: ["$column", sets.doneIds] }] },
                    { $lt: ["$dueDate", now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          blocked: { $sum: { $cond: [{ $in: ["$column", sets.blockedIds] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const deadlineMap = new Map<string, Date>();
  for (const budget of budgets) deadlineMap.set(String(budget.board), budget.deadline);

  const groupMap = new Map<
    string,
    { done: number; blocked: number; overdue: number; total: number }
  >();
  for (const g of taskGroups) groupMap.set(String(g._id), g);

  const health: ProjectHealth[] = boards.map((board) => {
    const id = String(board._id);
    const stats = groupMap.get(id) ?? { total: 0, done: 0, overdue: 0, blocked: 0 };
    const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const deadline = deadlineMap.get(id);
    const deadlineSoon = deadline
      ? deadline.getTime() - now.getTime() <= 14 * 24 * 60 * 60 * 1000
      : false;
    return {
      id,
      name: String(board.title ?? "Project"),
      href: `/board/${id}`,
      pct,
      totalTasks: stats.total,
      doneTasks: stats.done,
      overdue: stats.overdue,
      blocked: stats.blocked,
      warning: stats.overdue > 0 || stats.blocked > 0 || deadlineSoon || pct < 50,
    };
  });
  health.sort((a, b) => {
    if (a.warning !== b.warning) return a.warning ? -1 : 1;
    return b.pct - a.pct;
  });
  return health.slice(0, 8);
}

export async function buildTrends(
  ctx: CommandCenterContext,
): Promise<{ trends: TrendMetric[]; projectHealth: ProjectHealth[] | null }> {
  const { companyId, variant, period, userId, now } = ctx;
  const buckets = buildBuckets(period, now);
  const activeMembers = companyId
    ? await User.countDocuments({ company: companyId, companyStatus: "approved" })
    : 0;

  let projectHealth: ProjectHealth[] | null = null;
  let boardIds: string[] = [];
  let myBoardIds: string[] = [];

  if (variant === "admin" || variant === "projects") {
    boardIds = await getCompanyBoardIds(companyId);
    projectHealth = await buildProjectHealth(companyId, boardIds, now);
  }
  if (variant === "personal") {
    myBoardIds = await getMyBoardIds(userId);
  }

  const producers: Record<Variant, () => Promise<TrendMetric[]>> = {
    admin: () =>
      Promise.all([
        attendanceSeries(companyId, activeMembers, buckets),
        tasksSeries(boardIds, buckets),
        expenseSeries(companyId, buckets),
        revenueSeries(companyId, buckets),
      ]),
    hr: () =>
      Promise.all([
        attendanceSeries(companyId, activeMembers, buckets),
        candidateSeries(companyId, buckets),
        tasksSeries(boardIds, buckets),
        joinerSeries(companyId, buckets),
      ]),
    finance: () =>
      Promise.all([
        revenueSeries(companyId, buckets),
        expenseSeries(companyId, buckets),
        payrollSeries(companyId, buckets),
        attendanceSeries(companyId, activeMembers, buckets),
      ]),
    projects: () =>
      Promise.all([
        tasksSeries(boardIds, buckets),
        expenseSeries(companyId, buckets),
        revenueSeries(companyId, buckets),
      ]),
    it: () =>
      Promise.all([ticketSeries(companyId, buckets), ticketResolvedSeries(companyId, buckets)]),
    security: () =>
      Promise.all([accessRequestSeries(companyId, buckets), joinerSeries(companyId, buckets)]),
    personal: () =>
      Promise.all([
        attendanceSeries(companyId, activeMembers, buckets, userId),
        tasksSeries(myBoardIds, buckets, userId),
      ]),
  };

  const trends = await producers[variant]();
  return { trends, projectHealth };
}