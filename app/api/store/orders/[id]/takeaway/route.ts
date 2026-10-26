import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { User } from "@/models/User";
import { StoreOrder } from "@/models/StoreOrder";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { recordAudit } from "@/lib/audit";
import { fulfilStoreOrder, storeRegionOf, takeAwayStatusLabel } from "@/lib/store";
import { actingRoleForRequest } from "@/lib/delegation-access";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/store/orders/[id]/takeaway — { status: "ready" | "handed-over" }
 *
 * Take-away orders move through two warehouse steps: packed/ready for pickup
 * (which tells the requester and approver to collect it) and handed over
 * (which fulfils the order and issues the invoice).
 */
export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid order id.", 400);

  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "").trim().toLowerCase();
  if (status !== "ready" && status !== "handed-over") {
    return jsonError("Choose either ready or handed-over for this take-away order.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("role company companyStatus name regionLabel");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to update take-away orders.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  if ((await actingRoleForRequest({
    userId,
    request,
    realRole: String(user.role ?? ""),
    featureKeys: ["warehouse-delivery", "warehouse-orders"],
  })) !== "warehouse") {
    return jsonError("Only the warehouse can update take-away orders.", 403);
  }

  const { region } = await storeRegionOf(user);
  const order = await StoreOrder.findOne({ _id: id, company: companyId });
  if (!order) return jsonError("Order not found.", 404);
  if (region && String((order as any).regionLabel ?? "") !== region) {
    return jsonError("That order belongs to another region.", 403);
  }
  if (String((order as any).fulfillmentMethod ?? "delivery") !== "takeaway") {
    return jsonError("This is a delivery order — use the delivery screen to complete it.", 409);
  }

  const current = String((order as any).takeAwayStatus ?? "pending");
  if (current === status) {
    return NextResponse.json({ order: serializeDoc(order), changed: false });
  }
  if (String(order.status) !== "approved") {
    return jsonError("Only an approved take-away order can be updated.", 409);
  }

  const now = new Date();
  if (status === "ready") {
    if (current !== "pending") {
      return jsonError("This take-away order is already further along.", 409);
    }
    (order as any).takeAwayStatus = "ready";
    (order as any).takeAwayReadyAt = now;
    (order as any).takeAwayReadyBy = user._id;
    if (!Array.isArray(order.activity)) order.activity = [];
    (order.activity as any[]).push({
      user: user._id,
      action: "Ready for pickup",
      detail: "Order packed and ready to be collected",
    });
  } else {
    if (current !== "ready") {
      return jsonError("Mark the order packed and ready for pickup first.", 409);
    }
    (order as any).takeAwayStatus = "handed-over";
    (order as any).takeAwayHandedOverAt = now;
    (order as any).takeAwayHandedOverBy = user._id;
    fulfilStoreOrder(order as any, user, now);
    if (!Array.isArray(order.activity)) order.activity = [];
    (order.activity as any[]).push({
      user: user._id,
      action: "Handed over",
      detail: "Take-away order collected — invoice issued",
    });
  }

  await order.save();

  const orderNumber = String(order.orderNumber ?? "");
  const requesterId = String((order as any).requester ?? "");
  const approverId = String((order as any).approver ?? "");
  const invoiceLink = `/store-invoice/${String(order._id)}`;
  const title = status === "ready" ? "ready for pickup" : "handed over";
  const message =
    status === "ready"
      ? `Store order ${orderNumber} is packed and ready for pickup. Please collect it from the warehouse.`
      : `Store order ${orderNumber} has been handed over. Your invoice is now available.`;

  const recipients = [
    { id: requesterId, link: status === "ready" ? "/profile/store/orders" : invoiceLink },
    { id: approverId, link: status === "ready" ? "/profile/store/approvals" : invoiceLink },
  ];
  for (const recipient of recipients) {
    if (!recipient.id || recipient.id === userId) continue;
    await Notification.create({
      user: recipient.id,
      company: companyId,
      type: "approval",
      title: `Store order ${orderNumber} — ${title}`,
      message,
      link: recipient.link,
    });
    emitNotification(recipient.id);
  }

  await recordAudit({
    action: `store.order.takeaway.${status}`,
    actionLabel: `Store take-away — ${takeAwayStatusLabel(status)}`,
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-order",
    entityId: String(order._id),
    to: { takeAwayStatus: status, invoiceIssued: status === "handed-over" },
    result: "success",
    request,
  });

  return NextResponse.json({ order: serializeDoc(order), changed: true });
}
