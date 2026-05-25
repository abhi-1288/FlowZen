import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { Board } from "@/models/Board";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { FinanceSalary } from "@/models/FinanceSalary";
import { ProjectBudget } from "@/models/ProjectBudget";
import { User } from "@/models/User";

const FINANCE_ROLES = new Set(["finance", "admin", "human-resource"]);

function monthKey(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

async function actorWithCompany(userId: string) {
  const actor = await User.findById(userId).select("role company companyStatus");
  if (!actor) return null;
  if (!actor.company || actor.companyStatus !== "approved") return null;
  return actor;
}

function canManageFinance(role: string) {
  return FINANCE_ROLES.has(role);
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await actorWithCompany(userId);
  if (!actor) return jsonError("Approved company access is required.", 403);
  const role = String(actor.role ?? "");
  const canManage = canManageFinance(role);
  const month = monthKey(new URL(request.url).searchParams.get("month"));

  const [salaries, expenses, budgets, boards, members] = await Promise.all([
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
          .sort({ createdAt: -1 })
          .limit(50)
      : ExpenseRequest.find({ company: actor.company, requester: userId })
          .populate("requester", "name email role")
          .sort({ createdAt: -1 })
          .limit(50),
    canManage
      ? ProjectBudget.find({ company: actor.company })
          .populate("board", "title description")
          .sort({ updatedAt: -1 })
      : [],
    canManage
      ? Board.find({
          $or: [{ owner: userId }, { "members.user": userId }],
        })
          .select("title description")
          .sort({ updatedAt: -1 })
      : [],
    canManage
      ? User.find({ company: actor.company, companyStatus: "approved" })
          .select("name email role customRole companyIdentityCode")
          .sort({ name: 1 })
      : [],
  ]);

  const totalPayroll = salaries.reduce(
    (sum: number, salary: any) => sum + Number(salary.netSalary ?? 0),
    0,
  );
  const pendingSalaries = salaries.filter((salary: any) => salary.status !== "paid").length;
  const paidSalaries = salaries.filter((salary: any) => salary.status === "paid").length;

  return NextResponse.json({
    month,
    canManage,
    dashboard: { totalPayroll, pendingSalaries, paidSalaries },
    salaries: serializeDocs(salaries as any),
    expenses: serializeDocs(expenses as any),
    budgets: serializeDocs(budgets as any),
    boards: serializeDocs(boards as any),
    members: serializeDocs(members as any),
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
    const expense = await ExpenseRequest.create({
      company: actor.company,
      requester: userId,
      category,
      title,
      amount: Number.isFinite(amount) ? amount : 0,
      reason,
    });
    return NextResponse.json({ expense }, { status: 201 });
  }

  if (!canManageFinance(role)) return jsonError("Only finance, HR, or admins can manage finance.", 403);

  if (action === "generate-salary") {
    const employeeId = String(body.employeeId ?? "");
    const month = monthKey(body.month);
    const baseSalary = Math.max(0, Number(body.baseSalary ?? 0));
    const allowances = Math.max(0, Number(body.allowances ?? 0));
    const deductions = Math.max(0, Number(body.deductions ?? 0));
    const employee = await User.findOne({
      _id: employeeId,
      company: actor.company,
      companyStatus: "approved",
    }).select("_id");
    if (!employee) return jsonError("Employee not found in this company.", 404);
    const salary = await FinanceSalary.findOneAndUpdate(
      { company: actor.company, employee: employeeId, month },
      {
        $set: {
          baseSalary,
          allowances,
          deductions,
          netSalary: Math.max(0, baseSalary + allowances - deductions),
        },
        $setOnInsert: { status: "pending" },
      },
      { new: true, upsert: true },
    );
    return NextResponse.json({ salary });
  }

  if (action === "set-budget") {
    const boardId = String(body.boardId ?? "");
    const board = await Board.findOne({
      _id: boardId,
      $or: [{ owner: userId }, { "members.user": userId }],
    }).select("_id");
    if (!board) return jsonError("Project not found.", 404);
    const budget = await ProjectBudget.findOneAndUpdate(
      { company: actor.company, board: boardId },
      {
        $set: {
          totalBudget: Math.max(0, Number(body.totalBudget ?? 0)),
          teamSpendingLimit: Math.max(0, Number(body.teamSpendingLimit ?? 0)),
          resourceBudget: Math.max(0, Number(body.resourceBudget ?? 0)),
          decidedBy: userId,
        },
      },
      { new: true, upsert: true },
    );
    return NextResponse.json({ budget });
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
    if (!salary) return jsonError("Salary record not found.", 404);
    return NextResponse.json({ salary });
  }

  if (type === "expense") {
    if (!["approved", "rejected"].includes(status)) return jsonError("Invalid expense status.");
    const expense = await ExpenseRequest.findOneAndUpdate(
      { _id: id, company: actor.company },
      { $set: { status, decidedBy: userId } },
      { new: true },
    );
    if (!expense) return jsonError("Expense request not found.", 404);
    return NextResponse.json({ expense });
  }

  return jsonError("Unknown finance update.");
}
