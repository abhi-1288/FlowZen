import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { User } from "@/models/User";
import { StoreOrder } from "@/models/StoreOrder";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { recordAudit } from "@/lib/audit";
import { canTransitionStoreOrder, restoreStoreOrderStock } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

const TRANSITION_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  fulfilled: "Marked fulfilled",
};

async function loadOrder(id: string, companyId: unknown) {
  return StoreOrder.findOne({ _id: id, company: companyId })
    .populate("requester", "name email role regionLabel")
    .populate("approver", "name email role");
}

export async function GET(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid order id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view orders.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const order = await loadOrder(id, companyId);
  if (!order) return jsonError("Order not found.", 404);

  const requesterId = String((order.requester as any)?._id ?? order.requester ?? "");
  const approverId = String((order.approver as any)?._id ?? order.approver ?? "");
  const isWarehouse = String(user.role) === "warehouse";
  const isRequester = requesterId === userId;
  const isApprover = approverId === userId;
  if (!isWarehouse && !isRequester && !isApprover) {
    return jsonError("You do not have access to this order.", 403);
  }

  return NextResponse.json({
    order: serializeDoc(order),
    viewer: { isRequester, isApprover, isWarehouse },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid order id.", 400);

  const body = await request.json().catch(() => ({}));
  const nextStatus = String(body.status ?? "").trim().toLowerCase();
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  if (!nextStatus) return jsonError("A status transition is required.");
  if (!["approved", "rejected", "cancelled", "fulfilled"].includes(nextStatus)) {
    return jsonError("Unsupported order transition.");
  }
  if ((nextStatus === "rejected" || nextStatus === "cancelled") && !reason) {
    return jsonError("A reason is required for this transition.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus name");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const order = await StoreOrder.findOne({ _id: id, company: companyId });
  if (!order) return jsonError("Order not found.", 404);
  const fromStatus = String(order.status);

  const requesterId = String((order as any).requester ?? "");
  const approverId = String((order as any).approver ?? "");
  const isWarehouse = String(user.role) === "warehouse";
  const isRequester = requesterId === userId;
  const isApprover = approverId === userId;

  if (!canTransitionStoreOrder(order.status, nextStatus)) {
    return jsonError(`An order marked "${order.status}" cannot move to "${nextStatus}".`, 409);
  }

  // Authorization per transition: approver decides, requester may withdraw,
  // warehouse marks approved orders fulfilled.
  if (nextStatus === "approved" || nextStatus === "rejected") {
    if (!isApprover && !isWarehouse) {
      return jsonError("Only the assigned approver can decide this order.", 403);
    }
    if (order.status !== "pending") {
      return jsonError("This order has already been decided.", 409);
    }
  } else if (nextStatus === "cancelled") {
    if (!isRequester) {
      return jsonError("Only the requester can cancel this order.", 403);
    }
    if (order.status !== "pending") {
      return jsonError("Only a pending order can be cancelled.", 409);
    }
  } else if (nextStatus === "fulfilled") {
    if (!isApprover && !isWarehouse) {
      return jsonError("Only the approver or the warehouse can fulfil this order.", 403);
    }
  }

  const notifyId =
    nextStatus === "cancelled" ? approverId : nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "fulfilled" ? requesterId : "";

  if (nextStatus === "approved") {
    order.status = "approved";
    order.approvedBy = user._id;
    order.approvedAt = new Date();
  } else if (nextStatus === "rejected") {
    order.status = "rejected";
    order.rejectedBy = user._id;
    order.rejectedAt = new Date();
    order.rejectedReason = reason;
    await restoreStoreOrderStock(order);
  } else if (nextStatus === "cancelled") {
    order.status = "cancelled";
    order.cancelledBy = user._id;
    order.cancelledAt = new Date();
    order.cancelReason = reason;
    await restoreStoreOrderStock(order);
  } else if (nextStatus === "fulfilled") {
    order.status = "fulfilled";
    order.fulfilledBy = user._id;
    order.fulfilledAt = new Date();
  }

  if (!Array.isArray(order.activity)) order.activity = [];
  (order.activity as any[]).push({
    user: user._id,
    action: TRANSITION_LABELS[nextStatus] ?? nextStatus,
    detail: reason,
  });

  await order.save();

  const orderNumber = String(order.orderNumber ?? "");
  if (notifyId && notifyId !== userId) {
    const messages: Record<string, string> = {
      approved: `Store order ${orderNumber} has been approved.`,
      rejected: `Store order ${orderNumber} was rejected: ${reason}`,
      cancelled: `Store order ${orderNumber} was cancelled by the requester: ${reason}`,
      fulfilled: `Store order ${orderNumber} has been fulfilled.`,
    };
    await Notification.create({
      user: notifyId,
      company: companyId,
      type: "approval",
      title: `Store order ${orderNumber} — ${TRANSITION_LABELS[nextStatus] ?? nextStatus}`,
      message: messages[nextStatus] ?? `Store order ${orderNumber} is now ${nextStatus}.`,
      link: nextStatus === "cancelled" ? "/profile/store/approvals" : "/profile/store/orders",
    });
    emitNotification(notifyId);
  }

  await recordAudit({
    action: `store.order.${nextStatus}`,
    actionLabel: `Store order ${TRANSITION_LABELS[nextStatus] ?? nextStatus}`,
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-order",
    entityId: String(order._id),
    from: { status: fromStatus },
    to: { status: nextStatus, reason },
    result: "success",
    request,
  });

  return NextResponse.json({ order: order.toObject() });
}
