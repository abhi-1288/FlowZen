import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ExpenseRequest } from "@/models/ExpenseRequest";
import { Notification } from "@/models/Notification";
import { ProcurementRequest } from "@/models/ProcurementRequest";
import { User } from "@/models/User";
import { emitNotification } from "@/lib/realtime";
import {
  canCancelProcurement,
  canTransitionProcurement,
  findFinanceUserForProcurement,
  formatAmount,
  procurementRequestFilter,
  procurementScope,
  pushProcurementActivity,
} from "@/lib/procurement";

const IT_ROLES = ["it-admin", "it-administration"];

function companyIdOf(user: any): any {
  return typeof user.company === "object" && user.company
    ? (user.company as any)._id
    : user.company;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus regionLabel");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const scope = await procurementScope(user as any);
  const existing = await ProcurementRequest.findOne({
    _id: id,
    company: companyIdOf(user),
    ...procurementRequestFilter(scope),
  })
    .populate("requester", "name email role customRole regionLabel")
    .populate("itAssignedTo", "name email role")
    .populate("itReviewedBy", "name email role")
    .populate("financeAssignedTo", "name email role")
    .populate("expense", "status amount currency requestNumber");
  if (!existing) return jsonError("Purchase request not found.", 404);

  return NextResponse.json({ request: serializeDoc(existing) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const status = String(body.status ?? "").toUpperCase();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("role company companyStatus name regionLabel");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const companyId = companyIdOf(actor);
  const scope = await procurementScope(actor as any);
  const existing = await ProcurementRequest.findOne({
    _id: id,
    company: companyId,
    ...procurementRequestFilter(scope),
  }  ).select(
    "status requester regionLabel requestNumber title category reason amount quantity currency expense itAssignedTo financeAssignedTo",
  );
  if (!existing) return jsonError("Purchase request not found.", 404);

  if (!status) return jsonError("A status is required.");
  if (!canTransitionProcurement(existing.status, status)) {
    return jsonError(
      `Cannot move a purchase request from ${existing.status} to ${status}.`,
      409,
    );
  }

  const actorIsIt = IT_ROLES.includes(String(actor.role));
  const summary = `${existing.requestNumber} · ${existing.title} · ${formatAmount(
    existing.amount,
    existing.currency,
  )}`;

  // --- IT leg ------------------------------------------------------------
  if (status === "ASSIGNED_IT") {
    if (!actorIsIt) return jsonError("Only IT can assign a purchase request.", 403);
    const targetId = String(body.itAssignedTo ?? userId);
    if (!targetId) return jsonError("Choose who should review this request.", 400);
    const target = await User.findOne({
      _id: targetId,
      company: companyId,
      companyStatus: "approved",
      role: { $in: IT_ROLES },
    }).select("_id name");
    if (!target)
      return jsonError("That reviewer is not an available IT admin in this company.", 400);

    const updated = await ProcurementRequest.findOneAndUpdate(
      { _id: id, company: companyId },
      {
        $set: {
          status,
          itAssignedTo: (target as any)._id,
          itAssignedBy: actor._id,
          itAssignedAt: new Date(),
        },
      },
      { new: true },
    );
    pushProcurementActivity(
      updated,
      { _id: actor._id, name: actor.name },
      "Assigned for review",
      `Assigned to ${(target as any).name}`,
    );
    await updated.save();
    if (String((target as any)._id) !== String(actor._id)) {
      await Notification.create({
        user: (target as any)._id,
        company: companyId,
        type: "info",
        title: "Purchase request assigned to you",
        message: `${summary} needs your IT review.`,
      });
      emitNotification(String((target as any)._id));
    }
    return NextResponse.json({ request: serializeDoc(updated) });
  }

  if (status === "IT_APPROVED") {
    if (!actorIsIt) return jsonError("Only IT can approve a purchase request.", 403);
    if (existing.expense)
      return jsonError("This request already went to finance.", 409);

    // Two hops: IT signs off on the need, then finance releases the money. The
    // finance leg is seeded as `approved` with no admin approver, because the
    // IT review *is* the approval — that lets the existing finance handlers
    // (`accepted` → `disbursed`) run untouched.
    const financeUserId = await findFinanceUserForProcurement(
      companyId,
      existing.regionLabel,
    );
    if (!financeUserId)
      return jsonError(
        "No finance user is available to release this purchase. Ask an admin to add one.",
        409,
      );

    const expense = await ExpenseRequest.create({
      company: companyId,
      requester: existing.requester,
      category: existing.category,
      title: existing.title,
      amount: existing.amount,
      quantity: existing.quantity,
      currency: existing.currency,
      regionLabel: existing.regionLabel,
      procurement: existing._id,
      reason: String(existing.reason ?? ""),
      status: "approved",
      decidedBy: actor._id,
      assignedTo: financeUserId,
    });

    const updated = await ProcurementRequest.findOneAndUpdate(
      { _id: id, company: companyId },
      {
        $set: {
          status,
          itReviewedBy: actor._id,
          itReviewedAt: new Date(),
          expense: expense._id,
          financeAssignedTo: financeUserId,
        },
      },
      { new: true },
    );
    pushProcurementActivity(
      updated,
      { _id: actor._id, name: actor.name },
      "Approved by IT",
      `Forwarded to finance for ${formatAmount(existing.amount, existing.currency)}`,
    );
    await updated.save();

    await Notification.create({
      user: financeUserId,
      company: companyId,
      type: "approval",
      title: "Approved purchase ready for payment",
      message: `IT approved ${summary}. Accept and disburse it from the Finance tab.`,
    });
    emitNotification(financeUserId);
    await Notification.create({
      user: existing.requester,
      company: companyId,
      type: "info",
      title: "Purchase approved by IT",
      message: `Your request ${summary} was approved by IT and sent to finance for payment.`,
    });
    emitNotification(String(existing.requester));

    return NextResponse.json({
      request: serializeDoc(updated),
      expense: expense.toObject(),
    });
  }

  if (status === "REJECTED_IT") {
    if (!actorIsIt) return jsonError("Only IT can reject a purchase request.", 403);
    const reason = String(body.rejectionReason ?? "").trim();
    if (!reason) return jsonError("A rejection reason is required.", 400);

    const updated = await ProcurementRequest.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { status, itReviewedBy: actor._id, itReviewedAt: new Date(), itRejectionReason: reason } },
      { new: true },
    );
    pushProcurementActivity(
      updated,
      { _id: actor._id, name: actor.name },
      "Rejected by IT",
      reason,
    );
    await updated.save();
    await Notification.create({
      user: existing.requester,
      company: companyId,
      type: "info",
      title: "Purchase request rejected",
      message: `Your request ${summary} was rejected by IT: ${reason}`,
    });
    emitNotification(String(existing.requester));
    return NextResponse.json({ request: serializeDoc(updated) });
  }

  // --- Finance leg -------------------------------------------------------
  // Finance acts on the linked `ExpenseRequest` from the Finance tab; the
  // procurement status is synced from there so there is one write path per
  // action. These branches exist so the transition table stays total and a
  // direct PATCH cannot invent a finance decision.
  if (status === "REJECTED_FIN") {
    if (String(actor.role) !== "finance")
      return jsonError("Only finance can reject a purchase at the payment stage.", 403);
    if (!existing.expense)
      return jsonError("This request has not reached finance yet.", 409);

    // The finance status machine only rejects from `pending`, and a purchase
    // arrives here already `approved` (IT signed off). Reject the linked
    // expense directly rather than loosening that rule for every expense.
    const reason = String(body.rejectionReason ?? "").trim();
    if (!reason) return jsonError("A rejection reason is required.", 400);

    const expense = await ExpenseRequest.findOneAndUpdate(
      { _id: existing.expense, company: companyId },
      { $set: { status: "rejected", rejectionReason: reason } },
      { new: true },
    );
    if (!expense) return jsonError("Linked expense not found.", 404);

    const updated = await ProcurementRequest.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { status, financeRejectionReason: reason } },
      { new: true },
    );
    pushProcurementActivity(
      updated,
      { _id: actor._id, name: actor.name },
      "Rejected by finance",
      reason,
    );
    await updated.save();
    await Notification.create({
      user: existing.requester,
      company: companyId,
      type: "info",
      title: "Purchase rejected by finance",
      message: `Your request ${summary} was rejected by finance: ${reason}`,
    });
    emitNotification(String(existing.requester));
    return NextResponse.json({ request: serializeDoc(updated) });
  }

  if (["ACCEPTED_FIN", "DISBURSED"].includes(status)) {
    if (String(actor.role) !== "finance")
      return jsonError(
        "Finance actions on a purchase happen from the Finance tab.",
        403,
      );
    return jsonError(
      "Action this payment from the Finance tab — the linked expense drives this step.",
      409,
    );
  }

  // --- Cancellation ------------------------------------------------------
  if (status === "CANCELLED") {
    if (String(existing.requester) !== String(actor._id))
      return jsonError("Only the requester can withdraw a purchase request.", 403);
    if (!canCancelProcurement(existing.status))
      return jsonError("This request can no longer be withdrawn.", 409);

    const reason = String(body.cancelReason ?? "").trim();
    const updated = await ProcurementRequest.findOneAndUpdate(
      { _id: id, company: companyId },
      {
        $set: {
          status,
          cancelReason: reason,
          cancelledBy: actor._id,
          cancelledAt: new Date(),
        },
      },
      { new: true },
    );
    pushProcurementActivity(
      updated,
      { _id: actor._id, name: actor.name },
      "Withdrawn by requester",
      reason || "Withdrawn",
    );
    await updated.save();
    if (existing.itAssignedTo) {
      await Notification.create({
        user: existing.itAssignedTo,
        company: companyId,
        type: "info",
        title: "Purchase request withdrawn",
        message: `${summary} was withdrawn by the requester.`,
      });
      emitNotification(String(existing.itAssignedTo));
    }
    return NextResponse.json({ request: serializeDoc(updated) });
  }

  return jsonError("Invalid purchase request status.");
}
