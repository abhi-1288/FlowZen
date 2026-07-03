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
import { monthKey, actorWithCompany, autoGenerateSalariesForMonth, canManageFinance, computeSalaryBreakdown } from "./helpers";
import { handleStatusUpdates } from "./status-updates";
import { CompanyPolicy } from "@/models/CompanyPolicy";

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
    const [
      pendingSalaryApproval,
      pendingSalaryPayment,
      pendingExpenseApproval,
      forwardedExpenseApproval,
      pendingExpenseAcceptance,
      pendingAssignedExpenses,
      pendingBills,
      pendingBudgets,
    ] = await Promise.all([
      FinanceSalary.countDocuments({
        company: actor.company,
        month,
        status: "pending",
      }),
      FinanceSalary.countDocuments({
        company: actor.company,
        month,
        status: "approved",
      }),
      ExpenseRequest.countDocuments({
        company: actor.company,
        status: "pending",
      }),
      ExpenseRequest.countDocuments({
        company: actor.company,
        status: "forwarded",
        ...(role === "admin" ? { adminApprover: userId } : {}),
      }),
      ExpenseRequest.countDocuments({
        company: actor.company,
        status: "approved",
        $or: [{ assignedTo: null }, { assignedTo: userId }],
      }),
      ExpenseRequest.countDocuments({
        company: actor.company,
        status: "pending",
        assignedTo: userId,
      }),
      ExpenseBill.countDocuments({ company: actor.company, status: "pending" }),
      ProjectBudget.countDocuments({
        company: actor.company,
        status: "pending",
      }),
    ]);
    return NextResponse.json({
      pendingSalaryApproval,
      pendingSalaryPayment,
      pendingExpenseApproval,
      forwardedExpenseApproval,
      pendingExpenseAcceptance,
      pendingAssignedExpenses,
      pendingBills,
      pendingBudgets,
    });
  }

  const month = monthKey(url.searchParams.get("month"));

  const policy = await CompanyPolicy.findOne({ company: actor.company }).select("salaryCycleDay salaryCycleStartDay salaryCycleEndDay");
  const salaryCycleDay = policy?.salaryCycleDay ?? 29;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  const cycleTriggerDay = Math.min(
    policy?.salaryCycleStartDay && policy?.salaryCycleEndDay
      ? policy.salaryCycleEndDay + 1  // e.g., period 29th→28th, trigger on 29th
      : salaryCycleDay,
    lastDay,
  );
  
  const isCycleDay = dayOfMonth >= Math.max(1, cycleTriggerDay) && dayOfMonth <= lastDay;

  let monthEndGenerated = false;
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (canManage && isCycleDay && month === currentMonth) {
    monthEndGenerated = await autoGenerateSalariesForMonth({
      actorCompany: actor.company,
      userId,
      actorName: actor.name ?? "Finance",
      month,
      policy: policy || {},
    });
  }

  const [salaries, expenses, budgets, boards, members, financeMembers, bills] =
    await Promise.all([
      canManage
        ? FinanceSalary.find({ company: actor.company, month })
            .populate(
              "employee",
              "name email role customRole companyIdentityCode",
            )
            .sort({ updatedAt: -1 })
        : FinanceSalary.find({
            company: actor.company,
            employee: userId,
            month,
          })
            .populate(
              "employee",
              "name email role customRole companyIdentityCode",
            )
            .sort({ updatedAt: -1 }),
      canManage
        ? ExpenseRequest.find({ company: actor.company })
            .populate("requester", "name email role")
            .populate("assignedTo", "name email role")
            .populate("adminApprover", "name email role")
            .populate("forwardedBy", "name email role")
            .populate("acceptedBy", "name email role")
            .sort({ createdAt: -1 })
            .limit(50)
        : ExpenseRequest.find({ company: actor.company, requester: userId })
            .populate("requester", "name email role")
            .populate("assignedTo", "name email role")
            .populate("adminApprover", "name email role")
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
            owner: {
              $in: [
                ...new Set([
                  userId,
                  ...(await User.find({
                    company: actor.company,
                    companyStatus: "approved",
                  }).distinct("_id")),
                ]),
              ].map(String),
            },
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
      User.find({
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      })
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
  const pendingSalaries = salaries.filter(
    (salary: any) => salary.status === "pending",
  ).length;
  const paidSalaries = salaries.filter(
    (salary: any) => salary.status === "paid",
  ).length;

  const budgetByBoard = new Map<string, any>();
  for (const budget of budgets as any[]) {
    const boardId = String(budget.board?._id ?? budget.board ?? "");
    if (boardId && !budgetByBoard.has(boardId))
      budgetByBoard.set(boardId, budget);
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
      label = assigned
        ? `Assigned by ${String(assigned.name ?? "User")}`
        : "Invited";
    } else {
      label = `Created by ${String(owner?.name ?? "Unknown")}`;
    }

    if (boardBudget) {
      const budgetAssigned = boardBudget.assignedTo;
      label += budgetAssigned
        ? ` (Budget → ${String(budgetAssigned.name ?? "User")})`
        : " (Budget set)";
    }

    return { ...b, label };
  });

  return NextResponse.json({
    month,
    canManage,
    monthEndGenerated,
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
    const quantity = Math.max(1, Math.floor(Number(body.quantity ?? 1)));
    const reason = String(body.reason ?? "").trim();
    if (!title) return jsonError("Expense title is required.");
    if (
      !["software", "device", "travel", "office-resources"].includes(category)
    ) {
      return jsonError("Invalid expense category.");
    }
    let assignedTo = null;
    if (role !== "finance") {
      assignedTo = String(body.assignedTo ?? "");
      if (!assignedTo)
        return jsonError(
          "Please assign a finance user to handle this request.",
          400,
        );
      const financeUser = await User.findOne({
        _id: assignedTo,
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      }).select("_id");
      if (!financeUser)
        return jsonError(
          "Assigned finance user not found in this company.",
          404,
        );
    }
    const expense = await ExpenseRequest.create({
      company: actor.company,
      requester: userId,
      category,
      title,
      amount: Number.isFinite(amount) ? amount : 0,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      reason,
      ...(assignedTo ? { assignedTo } : {}),
    });
    const admins = await User.find({
      company: actor.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
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
      })),
    );
    admins.forEach((u) => notifyIds.push(String(u._id)));
    notifyIds.forEach((id) => emitNotification(id));
    return NextResponse.json({ expense }, { status: 201 });
  }

  if (!canManageFinance(role))
    return jsonError("Only finance, HR, or admins can manage finance.", 403);

  if (action === "calculate-salary") {
    const employeeId = String(body.employeeId ?? "");
    const periodStart = String(body.periodStart ?? "");
    const periodEnd = String(body.periodEnd ?? "");
    if (!periodStart || !periodEnd)
      return jsonError("Salary period dates are required.");
    const computed = await computeSalaryBreakdown({
      actorCompany: actor.company,
      employeeId,
      periodStart,
      periodEnd,
      allowances: 0,
      manualDeductions: 0,
    });
    if ("error" in computed) {
      const errorMessage = computed.error ?? "Unknown error";

      return jsonError(
        errorMessage,
        errorMessage.includes("not found") ? 404 : 400,
      );
    }
    return NextResponse.json({
      breakdown: computed.breakdown,
      employee: {
        pfNumber: String((computed.employee as any).pfNumber ?? ""),
        pfDeductionAmount: Number((computed.employee as any).pfDeductionAmount ?? 0),
        esicNumber: String((computed.employee as any).esicNumber ?? ""),
        esicDeductionAmount: Number((computed.employee as any).esicDeductionAmount ?? 0),
      },
    });
  }

  if (action === "generate-salary") {
    const employeeId = String(body.employeeId ?? "");
    const periodStart = String(body.periodStart ?? "");
    const periodEnd = String(body.periodEnd ?? "");
    if (!periodStart || !periodEnd)
      return jsonError("Salary period dates are required.");
    const allowances = Math.max(0, Number(body.allowances ?? 0));
    const manualDeductions = Math.max(0, Number(body.deductions ?? 0));

    const pfNumber = String(body.pfNumber ?? "").trim();
    const pfDeductionAmount = Math.max(0, Number(body.pfDeductionAmount ?? 0));
    const esicNumber = String(body.esicNumber ?? "").trim();
    const esicDeductionAmount = Math.max(0, Number(body.esicDeductionAmount ?? 0));
    if (pfNumber || esicNumber || pfDeductionAmount > 0 || esicDeductionAmount > 0) {
      const updateData: Record<string, string | number> = {};
      if (pfNumber) updateData.pfNumber = pfNumber;
      if (esicNumber) updateData.esicNumber = esicNumber;
      if (pfDeductionAmount > 0) updateData.pfDeductionAmount = pfDeductionAmount;
      if (esicDeductionAmount > 0) updateData.esicDeductionAmount = esicDeductionAmount;
      await User.updateOne({ _id: employeeId }, { $set: updateData });
    }

    const computed = await computeSalaryBreakdown({
      actorCompany: actor.company,
      employeeId,
      periodStart,
      periodEnd,
      allowances,
      manualDeductions,
    });
    if ("error" in computed) {
      const errorMessage = computed.error ?? "Unknown error";

      return jsonError(
        errorMessage,
        errorMessage.includes("not found") ? 404 : 400,
      );
    }
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
    const admins = await User.find({
      company: actor.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
    await Notification.insertMany(
      admins.map((u) => ({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: "Salary pending approval",
        message: `${actor.name ?? "Finance"} generated a salary for ${String(employee.name ?? "an employee")} (${breakdown.periodStart} to ${periodEnd}).`,
      })),
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
      owner: {
        $in: (
          await User.find({
            company: actor.company,
            companyStatus: "approved",
          }).distinct("_id")
        ).map(String),
      },
    }).select("_id title");
    if (!board) return jsonError("Project not found.", 404);
    const deadline = body.deadline ? new Date(String(body.deadline)) : null;
    let assignedTo: string | null = null;
    if (role === "admin") {
      assignedTo = String(body.assignedTo ?? "");
      if (!assignedTo)
        return jsonError(
          "Please assign a finance user to approve this budget.",
          400,
        );
      const financeUser = await User.findOne({
        _id: assignedTo,
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      }).select("_id");
      if (!financeUser)
        return jsonError("Assigned finance user not found.", 404);
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
        : (
            await User.find({
              company: actor.company,
              role: "finance",
              companyStatus: "approved",
            }).distinct("_id")
          ).map(String);
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
      const admins = await User.find({
        company: actor.company,
        role: "admin",
        companyStatus: "approved",
      }).select("_id");
      await Notification.insertMany(
        admins.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "approval",
          title: "Budget pending admin approval",
          message: `${actor.name ?? "Finance"} allocated a budget for "${boardTitle}" — please review and approve.`,
        })),
      );
      admins.forEach((u) => emitNotification(String(u._id)));
    }
    return NextResponse.json({ budget });
  }

  if (action === "generate-bill") {
    const budgetId = String(body.budgetId ?? "");
    const amount = Math.max(0, Number(body.amount ?? 0));
    if (!budgetId || !amount)
      return jsonError("Budget and amount are required.", 400);
    const budget = await ProjectBudget.findOne({
      _id: budgetId,
      company: actor.company,
      status: "approved",
    }).populate("board", "title");
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
    const admins = await User.find({
      company: actor.company,
      role: "admin",
      companyStatus: "approved",
    }).select("_id");
    await Notification.insertMany(
      admins.map((u) => ({
        user: u._id,
        company: actor.company,
        type: "approval",
        title: "Expense bill pending approval",
        message: `${actor.name ?? "Finance"} generated an expense bill of ₹${amount} for "${boardTitle}".`,
      })),
    );
    admins.forEach((u) => emitNotification(String(u._id)));
    return NextResponse.json({ bill }, { status: 201 });
  }

  return jsonError("Unknown finance action.");
}

export async function PATCH(request: Request) {
  return handleStatusUpdates(request);
}
