import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { emitNotification } from "@/lib/realtime";
import { formatAmount } from "@/lib/procurement";
import { CompanyPolicy, FinanceSalary, ExpenseRequest, Notification, ProjectBudget, ExpenseBill, User } from "@/models";
import { Company } from "@/models/Company";
import { effectiveRegionLabelOf, type OfficeAddressLike } from "@/lib/company-regions";
import { actorWithCompany, assertSalaryTargetInFinanceScope, autoGenerateSalariesForMonth, canManageFinance, syncProcurementFromExpense, financeMemberScope } from "./helpers";
import { delegationForAnyFeature, delegationForFeature, delegationIdFromRequest } from "@/lib/delegation-access";

export async function handleStatusUpdates(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();

  const actor = await actorWithCompany(userId);
  if (!actor) return jsonError("Approved company access is required.", 403);

  const body = await request.json();
  const type = String(body.type ?? "");
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");

  const featureByType: Record<string, string> = {
    salary: "finance-salaries",
    "salary-bulk": "finance-salaries",
    expense: "finance-expense-requests",
    budget: "finance-project-budgets",
    bill: "finance-project-budgets",
  };
  const requiredFeature = featureByType[type] ?? "";
  const roleAllowed = canManageFinance(String(actor.role ?? ""));
  const delegationRow = !roleAllowed && requiredFeature
    ? await delegationForFeature(userId, delegationIdFromRequest(request), requiredFeature)
    : null;
  const delegated = Boolean(delegationRow);
  if (!roleAllowed && !delegated) {
    return jsonError("Only finance or admins can approve payouts.", 403);
  }
  // Delegated recipients perform the finance half of a workflow; admin-only
  // decisions below still compare against the real role.
  const actingRole = roleAllowed ? String(actor.role ?? "") : "finance";
  const requiresVerification = delegated && Boolean((delegationRow as any)?.requiresVerification);
  const authorizerId = delegated ? String((delegationRow as any)?.authorizer ?? "") : "";

  if (type === "salary") {
    if (!["approved", "paid", "rejected"].includes(status))
      return jsonError("Invalid salary status.");
    const existing = await FinanceSalary.findOne({
      _id: id,
      company: actor.company,
    }).select("status employee month");
    if (!existing) return jsonError("Salary record not found.", 404);
    const outOfRegion = await assertSalaryTargetInFinanceScope(actor, String(existing.employee));
    if (outOfRegion) return jsonError(outOfRegion, 403);
    if (status === "paid" && existing.status !== "approved")
      return jsonError("Salary must be approved before marking as paid.", 400);
    if (status === "rejected") {
      if (String(actor.role) !== "admin")
        return jsonError("Only admin can reject salary payouts.", 403);
      if (existing.status !== "pending")
        return jsonError("Only pending salary payouts can be rejected.", 400);
      const rejectionReason = String(body.rejectionReason ?? "").trim();
      if (!rejectionReason)
        return jsonError("A rejection reason is required.", 400);
    }

    const updateFields: Record<string, any> = {
      status,
      updatedBy: userId,
    };
    if (status === "approved") {
      updateFields.approvedBy = userId;
      updateFields.approvedAt = new Date();
      updateFields.paidAt = null;
    }
    if (status === "paid") {
      updateFields.paidAt = new Date();
    }
    if (status === "rejected") {
      updateFields.rejectedBy = userId;
      updateFields.rejectedAt = new Date();
      updateFields.rejectionReason = String(body.rejectionReason ?? "").trim();
      updateFields.approvedBy = null;
      updateFields.paidAt = null;
    }

    const salary = await FinanceSalary.findOneAndUpdate(
      { _id: id, company: actor.company },
      { $set: updateFields },
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
      const rejectionReason = String(body.rejectionReason ?? "").trim();
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
          message: `Salary for ${salary?.month ?? ""} has been rejected by admin. Reason: ${rejectionReason}`,
        })),
      );
      financeUsers.forEach((u) => emitNotification(String(u._id)));
    }

    return NextResponse.json({ salary });
  }

  if (type === "salary-bulk") {
    if (!["approved", "rejected"].includes(status))
      return jsonError("Invalid bulk status.");
    if (status === "rejected" && String(actor.role) !== "admin")
      return jsonError("Only admin can reject salary payouts.", 403);

    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0)
      return jsonError("No salary IDs provided.", 400);

    const filter: Record<string, any> = {
      _id: { $in: ids },
      company: actor.company,
      status: "pending",
    };

    const updateFields: Record<string, any> = {
      status,
      updatedBy: userId,
    };
    if (status === "approved") {
      updateFields.approvedBy = userId;
      updateFields.approvedAt = new Date();
    }
    if (status === "rejected") {
      updateFields.rejectedBy = userId;
      updateFields.rejectedAt = new Date();
      updateFields.rejectionReason = String(body.rejectionReason ?? "Bulk rejected by admin").trim();
    }

    const result = await FinanceSalary.updateMany(filter, { $set: updateFields });

    const modifiedCount = result.modifiedCount;

    if (modifiedCount > 0) {
      const financeUsers = await User.find({
        company: actor.company,
        role: "finance",
        companyStatus: "approved",
      }).select("_id");

      if (status === "approved") {
        await Notification.insertMany(
          financeUsers.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Salaries approved",
            message: `${modifiedCount} salary record(s) have been approved.`,
          })),
        );
      }

      if (status === "rejected") {
        const rejectionReason = updateFields.rejectionReason;
        await Notification.insertMany(
          financeUsers.map((u) => ({
            user: u._id,
            company: actor.company,
            type: "info",
            title: "Salaries rejected",
            message: `${modifiedCount} salary record(s) have been rejected by admin. Reason: ${rejectionReason}`,
          })),
        );
      }

      financeUsers.forEach((u) => emitNotification(String(u._id)));
    }

    return NextResponse.json({ modified: modifiedCount });
  }

  if (type === "expense") {
    const existing = await ExpenseRequest.findOne({
      _id: id,
      company: actor.company,
    }).select("status requester assignedTo adminApprover title amount quantity currency procurement");
    if (!existing) return jsonError("Expense request not found.", 404);

    const isAssigned =
      existing.assignedTo && String(existing.assignedTo) === userId;

    if (status === "forwarded") {
      if (actingRole !== "finance")
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

      // Verification step: when a delegated recipient forwards and requires
      // verification, defer to the authorizer.
      const delegationId = delegationIdFromRequest(request);
      if (delegationId) {
        const delegation = await delegationForFeature(userId, delegationId, "finance-expense-requests");
        if (delegation && (delegation as any).requiresVerification) {
          (existing as any).verificationStatus = "pending-verification";
          (existing as any).submittedBy = userId;
          (existing as any).authorizer = (delegation as any).authorizer;
          (existing as any).pendingAction = "forwarded";
          (existing as any).pendingAdminApprover = adminApprover;
          await existing.save();
          const authorizerId = String((delegation as any).authorizer);
          await Notification.create({
            user: authorizerId,
            company: actor.company,
            type: "approval",
            title: "Expense Pending Verification",
            message: `${actor.name ?? "Finance"} submitted an expense forward for ${existing.title} for your verification.`,
            link: "/profile/finance",
          });
          emitNotification(authorizerId);
          return NextResponse.json({ expense: existing });
        }
      }

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
      if (actingRole === "finance") {
        if (!isAssigned)
          return jsonError("This expense is not assigned to you.", 403);
        if (existing.status !== "pending")
          return jsonError("Expense request already processed.", 409);
      } else if (actingRole === "admin") {
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
      await syncProcurementFromExpense(
        existing,
        "rejected",
        actor,
        rejectionReason,
      );
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
      if (actingRole !== "finance")
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
      await syncProcurementFromExpense(
        existing,
        "accepted",
        actor,
        `Accepted by ${actor.name ?? "finance"}`,
      );
      return NextResponse.json({ expense });
    }

    if (status === "disbursed") {
      if (actingRole !== "finance")
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
        message: `Your expense request "${existing.title}" x ${existing.quantity ?? 1} for ${formatAmount(existing.amount, existing.currency)} has been disbursed by finance.`,
      });
      emitNotification(String(requesterId));
      await syncProcurementFromExpense(
        existing,
        "disbursed",
        actor,
        `Disbursed ${formatAmount(existing.amount, existing.currency)}`,
      );
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
    const budgetRegion = String((existing as any).region ?? "");
    const actorScope = await financeMemberScope(actor);
    if (actorScope.memberIds && budgetRegion !== actorScope.region)
      return jsonError("This budget belongs to another region.", 403);
    const boardTitle = String((existing.board as any)?.title ?? "");

    // Verification apply: if pending-verification and caller is authorizer/admin.
    if ((existing as any).verificationStatus === "pending-verification") {
      const isAuthorizer = (existing as any).authorizer && String((existing as any).authorizer) === userId;
      const isAdmin = String(actor.role) === "admin";
      if (!isAuthorizer && !isAdmin) return jsonError("Forbidden.", 403);
      if (String((existing as any).submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);
      const pendingStatus = String((existing as any).pendingStatus ?? status);
      if (pendingStatus === "approved" || pendingStatus === "rejected") {
        if (pendingStatus === "rejected") {
          const rejectionReason = String((existing as any).pendingReason ?? body.rejectionReason ?? "").trim();
          (existing as any).status = "rejected";
          (existing as any).rejectionReason = rejectionReason;
          (existing as any).rejectedAt = new Date();
        } else {
          (existing as any).status = "approved";
        }
        (existing as any).verificationStatus = "verified";
        (existing as any).verifiedBy = userId;
        (existing as any).verifiedAt = new Date();
        await existing.save();
        return NextResponse.json({ budget: existing });
      }
    }

    // Verification step: when a delegated recipient approves/rejects and requires
    // verification, defer to the authorizer.
    if (requiresVerification && (status === "approved" || status === "rejected")) {
      const delegationId = delegationIdFromRequest(request);
      const delegation = await delegationForFeature(userId, delegationId, "finance-project-budgets");
      if (delegation && (delegation as any).requiresVerification) {
        (existing as any).verificationStatus = "pending-verification";
        (existing as any).submittedBy = userId;
        (existing as any).authorizer = (delegation as any).authorizer;
        (existing as any).pendingStatus = status;
        (existing as any).pendingReason = String(body.rejectionReason ?? "").trim();
        await existing.save();
        const authorizerId = String((delegation as any).authorizer);
        await Notification.create({
          user: authorizerId,
          company: actor.company,
          type: "approval",
          title: "Budget Pending Verification",
          message: `${actor.name ?? "Finance"} submitted a budget ${status} for ${boardTitle} for your verification.`,
          link: "/profile/finance",
        });
        emitNotification(authorizerId);
        return NextResponse.json({ budget: existing });
      }
    }

    if (status === "approved") {
      const isAssignedFinance =
        existing.assignedTo && String(existing.assignedTo) === userId;
      const canFinanceApprove =
        actingRole === "finance" &&
        existing.assignedTo &&
        isAssignedFinance;
      const canAdminApprove =
        actingRole === "admin" && !existing.assignedTo;
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
        actingRole === "finance" &&
        existing.assignedTo &&
        isAssignedFinance;
      const canAdminReject =
        actingRole === "admin" && !existing.assignedTo;
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
      if (actingRole === "admin") {
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
    if (actingRole !== "finance")
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

    // Regional admins may only approve cycle changes for their own region.
    const company = (await Company.findById(actor.company)
      .select("addresses address")
      .lean()) as {
      addresses?: OfficeAddressLike[] | null;
      address?: string | null;
    } | null;
    const adminRegion = effectiveRegionLabelOf(company, actor);

    let policy = await CompanyPolicy.findOne({ company: actor.company, region: adminRegion });
    if (!policy && adminRegion) {
      policy = await CompanyPolicy.findOne({ company: actor.company, region: "" });
    }
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

      // Only auto-generate if today is on/after the new cycle's trigger day
      const now = new Date();
      const dayOfMonth = now.getDate();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const newTriggerDay = Math.min(
        policy.salaryCycleStartDay && policy.salaryCycleEndDay
          ? policy.salaryCycleEndDay + 1
          : (policy.salaryCycleDay ?? 29),
        lastDay,
      );
      const isCycleDay = dayOfMonth >= Math.max(1, newTriggerDay) && dayOfMonth <= lastDay;

      if (isCycleDay && policy.autoSalaryEnabled === true) {
        const currentMonth = now.toISOString().slice(0, 7);
        await autoGenerateSalariesForMonth({
          actorCompany: actor.company,
          userId,
          actorName: actor.name ?? "Admin",
          month: currentMonth,
          policy: policy || {},
        });
      }

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
