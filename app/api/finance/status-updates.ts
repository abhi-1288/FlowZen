import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { CompanyPolicy, FinanceSalary, ExpenseRequest, Notification, ProjectBudget, ExpenseBill, User } from "@/models";
import { actorWithCompany, autoGenerateSalariesForMonth, canManageFinance } from "./helpers";

export async function handleStatusUpdates(request: Request) {
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
    if (!["approved", "paid", "rejected"].includes(status))
      return jsonError("Invalid salary status.");
    const existing = await FinanceSalary.findOne({
      _id: id,
      company: actor.company,
    }).select("status employee month");
    if (!existing) return jsonError("Salary record not found.", 404);
    if (status === "paid" && existing.status !== "approved")
      return jsonError("Salary must be approved before marking as paid.", 400);
    if (status === "rejected") {
      if (String(actor.role) !== "admin")
        return jsonError("Only admin can reject salary payouts.", 403);
      if (existing.status !== "pending")
        return jsonError("Only pending salary payouts can be rejected.", 400);
    }

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
      const financeUsers = await User.find({
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      }).select("_id");
      await Notification.insertMany(
        financeUsers.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "info",
          title: "Salary approved",
          message: `Salary for ${salary?.month ?? ""} has been approved. You can now mark it as paid.`,
        })),
      );
      financeUsers.forEach((u) => emitNotification(String(u._id)));
    }

    if (status === "paid") {
      const employeeId = existing.employee;
      const salarySlipLink = `/salary-slip/${String(existing._id)}`;
      await Notification.create({
        user: employeeId,
        company: actor.company,
        type: "info",
        title: "Salary paid",
        message: `Your salary for ${salary?.month ?? ""} has been marked as paid.`,
        link: salarySlipLink,
      });
      emitNotification(String(employeeId));
    }

    if (status === "rejected") {
      const financeUsers = await User.find({
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      }).select("_id");
      await Notification.insertMany(
        financeUsers.map((u) => ({
          user: u._id,
          company: actor.company,
          type: "info",
          title: "Salary payout rejected",
          message: `Salary for ${salary?.month ?? ""} has been rejected by admin.`,
        })),
      );
      financeUsers.forEach((u) => emitNotification(String(u._id)));
    }

    return NextResponse.json({ salary });
  }

  if (type === "expense") {
    const existing = await ExpenseRequest.findOne({
      _id: id,
      company: actor.company,
    }).select("status requester assignedTo adminApprover title amount quantity");
    if (!existing) return jsonError("Expense request not found.", 404);

    const isAssigned =
      existing.assignedTo && String(existing.assignedTo) === userId;

    if (status === "forwarded") {
      if (String(actor.role) !== "finance")
        return jsonError("Only finance can forward expense requests.", 403);
      if (!isAssigned)
        return jsonError("This expense is not assigned to you.", 403);
      if (existing.status !== "pending")
        return jsonError("Expense request already processed.", 409);
      const adminApprover = String(body.adminApprover ?? "");
      if (!adminApprover)
        return jsonError("Please select an admin to approve this expense.", 400);
      const targetAdmin = await User.findOne({
        _id: adminApprover,
        company: actor.company,
        role: "admin",
        companyStatus: "approved",
      }).select("_id");
      if (!targetAdmin)
        return jsonError("Selected admin is not available for this company.", 400);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        { $set: { status, forwardedBy: userId, adminApprover: targetAdmin._id } },
        { new: true },
      );
      await Notification.create({
        user: targetAdmin._id,
        company: actor.company,
        type: "approval",
        title: "Expense forwarded for admin approval",
        message: `${actor.name ?? "Finance"} forwarded expense "${existing.title}" for your approval.`,
      });
      emitNotification(String(targetAdmin._id));
      return NextResponse.json({ expense });
    }

    if (status === "rejected") {
      if (String(actor.role) === "finance") {
        if (!isAssigned)
          return jsonError("This expense is not assigned to you.", 403);
        if (existing.status !== "pending")
          return jsonError("Expense request already processed.", 409);
      } else if (String(actor.role) === "admin") {
        if (existing.status !== "pending" && existing.status !== "forwarded")
          return jsonError("Expense request already processed.", 409);
        if (
          existing.status === "forwarded" &&
          existing.adminApprover &&
          String(existing.adminApprover) !== userId
        )
          return jsonError("This expense is assigned to another admin.", 403);
      } else {
        return jsonError(
          "You are not allowed to reject expense requests.",
          403,
        );
      }
      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (!rejectionReason)
        return jsonError("A rejection reason is required.", 400);
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
      if (String(actor.role) !== "admin")
        return jsonError("Only admin can approve expense requests.", 403);
      if (existing.status !== "pending" && existing.status !== "forwarded")
        return jsonError("Expense request already processed.", 409);
      if (
        existing.status === "forwarded" &&
        existing.adminApprover &&
        String(existing.adminApprover) !== userId
      )
        return jsonError("This expense is assigned to another admin.", 403);
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
        title:
          status === "approved"
            ? "Expense approved by admin"
            : "Expense rejected",
        message: `Your expense request "${existing.title}" has been ${status === "approved" ? "approved by admin" : `rejected: ${existing.status === "forwarded" ? "forwarded request was rejected" : ""}`}.`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    if (status === "accepted") {
      if (String(actor.role) !== "finance")
        return jsonError("Only finance can accept expense requests.", 403);
      if (existing.status !== "approved")
        return jsonError(
          "Expense must be approved by admin before accepting.",
          400,
        );
      if (existing.assignedTo && !isAssigned)
        return jsonError(
          "This expense is assigned to another finance user.",
          403,
        );
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
      if (String(actor.role) !== "finance")
        return jsonError("Only finance can disburse expenses.", 403);
      if (existing.status !== "accepted")
        return jsonError("Expense must be accepted before disbursement.", 400);
      const expense = await ExpenseRequest.findOneAndUpdate(
        { _id: id, company: actor.company },
        {
          $set: {
            status: "disbursed",
            disbursedBy: userId,
            disbursedAt: new Date(),
          },
        },
        { new: true },
      );
      const requesterId = existing.requester;
      await Notification.create({
        user: requesterId,
        company: actor.company,
        type: "info",
        title: "Expense disbursed",
        message: `Your expense request "${existing.title}" x ${existing.quantity ?? 1} for ₹${existing.amount ?? 0} has been disbursed by finance.`,
      });
      emitNotification(String(requesterId));
      return NextResponse.json({ expense });
    }

    return jsonError("Invalid expense status.");
  }

  if (type === "budget") {
    const existing = await ProjectBudget.findOne({
      _id: id,
      company: actor.company,
    }).populate("board", "title");
    if (!existing) return jsonError("Budget not found.", 404);
    const boardTitle = String((existing.board as any)?.title ?? "");

    if (status === "approved") {
      const isAssignedFinance =
        existing.assignedTo && String(existing.assignedTo) === userId;
      const canFinanceApprove =
        String(actor.role) === "finance" &&
        existing.assignedTo &&
        isAssignedFinance;
      const canAdminApprove =
        String(actor.role) === "admin" && !existing.assignedTo;
      if (!canFinanceApprove && !canAdminApprove)
        return jsonError("You are not authorized to approve this budget.", 403);
      if (existing.status !== "pending")
        return jsonError("Budget already processed.", 409);
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
      const isAssignedFinance =
        existing.assignedTo && String(existing.assignedTo) === userId;
      const canFinanceReject =
        String(actor.role) === "finance" &&
        existing.assignedTo &&
        isAssignedFinance;
      const canAdminReject =
        String(actor.role) === "admin" && !existing.assignedTo;
      if (!canFinanceReject && !canAdminReject)
        return jsonError("You are not authorized to reject this budget.", 403);
      if (existing.status !== "pending")
        return jsonError("Budget already processed.", 409);
      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (!rejectionReason)
        return jsonError("A rejection reason is required.", 400);
      const budget = await ProjectBudget.findOneAndUpdate(
        { _id: id, company: actor.company },
        {
          $set: { status: "rejected", rejectionReason, rejectedAt: new Date() },
        },
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
        const financeUsers = await User.find({
          company: actor.company,
          role: "finance",
          companyStatus: "approved",
        }).select("_id");
        await Notification.insertMany(
          financeUsers.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Budget rejected by admin",
            message: `Budget for "${boardTitle}" was rejected by admin: ${rejectionReason}`,
          })),
        );
        financeUsers.forEach((u) => notifyIds.push(String(u._id)));
      } else {
        const admins = await User.find({
          company: actor.company,
          role: "admin",
          companyStatus: "approved",
        }).select("_id");
        await Notification.insertMany(
          admins.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Budget rejected by finance",
            message: `Budget for "${boardTitle}" was rejected by ${actor.name ?? "finance"}: ${rejectionReason}`,
          })),
        );
        admins.forEach((u) => notifyIds.push(String(u._id)));
      }
      notifyIds.forEach((id) => emitNotification(id));
      return NextResponse.json({ budget });
    }

    return jsonError("Invalid budget status.");
  }

  if (type === "bill") {
    if (String(actor.role) !== "finance")
      return jsonError("Only finance can manage bills.", 403);
    const existing = await ExpenseBill.findOne({
      _id: id,
      company: actor.company,
    }).populate({
      path: "budget",
      populate: { path: "board", select: "title" },
    });
    if (!existing) return jsonError("Bill not found.", 404);
    const boardTitle = String((existing.budget as any)?.board?.title ?? "");

    if (status === "paid") {
      if (existing.status !== "pending")
        return jsonError("Bill already processed.", 409);
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

  if (type === "salary-cycle") {
    if (String(actor.role) !== "admin")
      return jsonError("Only admin can approve salary cycle changes.", 403);

    const policy = await CompanyPolicy.findOne({ company: actor.company });
    if (!policy) return jsonError("No policy found.", 404);
    if (policy.salaryCycleChangeStatus !== "pending")
      return jsonError("No pending salary cycle change.", 400);
    if (policy.salaryCycleChangeApprover && String(policy.salaryCycleChangeApprover) !== userId)
      return jsonError("This change is assigned to another admin.", 403);

    if (status === "approved") {
      policy.salaryCycleDay = policy.pendingSalaryCycleDay ?? policy.salaryCycleDay;
      policy.salaryCycleStartDay = policy.pendingSalaryCycleStartDay ?? policy.salaryCycleStartDay;
      policy.salaryCycleEndDay = policy.pendingSalaryCycleEndDay ?? policy.salaryCycleEndDay;
      policy.pendingSalaryCycleDay = null;
      policy.pendingSalaryCycleStartDay = null;
      policy.pendingSalaryCycleEndDay = null;
      policy.salaryCycleChangeStatus = "approved";
      policy.salaryCycleChangeRequestedAt = null;
      await policy.save();

      const currentMonth = new Date().toISOString().slice(0, 7);
      await autoGenerateSalariesForMonth({
        actorCompany: actor.company,
        userId,
        actorName: actor.name ?? "Admin",
        month: currentMonth,
        policy: policy || {},
      });

      if (policy.salaryCycleChangeRequestedBy) {
        const msg = policy.salaryCycleStartDay && policy.salaryCycleEndDay 
          ? `Your proposal to change the salary cycle to ${policy.salaryCycleStartDay} - ${policy.salaryCycleEndDay} has been approved.`
          : `Your proposal to change the salary cycle day to ${policy.salaryCycleDay} has been approved.`;
        
        await Notification.create({
          user: policy.salaryCycleChangeRequestedBy,
          company: actor.company,
          type: "info",
          title: "Salary cycle change approved",
          message: msg,
        });
        emitNotification(String(policy.salaryCycleChangeRequestedBy));
      }
      return NextResponse.json({ ok: true, salaryCycleDay: policy.salaryCycleDay });
    }

    if (status === "rejected") {
      policy.pendingSalaryCycleDay = null;
      policy.pendingSalaryCycleStartDay = null;
      policy.pendingSalaryCycleEndDay = null;
      policy.salaryCycleChangeStatus = "rejected";
      policy.salaryCycleChangeApprover = null;
      policy.salaryCycleChangeRequestedAt = null;
      await policy.save();

      if (policy.salaryCycleChangeRequestedBy) {
        await Notification.create({
          user: policy.salaryCycleChangeRequestedBy,
          company: actor.company,
          type: "info",
          title: "Salary cycle change rejected",
          message: `Your proposal to change the salary cycle day has been rejected.`,
        });
        emitNotification(String(policy.salaryCycleChangeRequestedBy));
      }
      return NextResponse.json({ ok: true });
    }

    return jsonError("Invalid salary-cycle status.");
  }

  return jsonError("Unknown finance update.");
}
