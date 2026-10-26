import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { User } from "@/models/User";
import { StoreOrder } from "@/models/StoreOrder";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { recordAudit } from "@/lib/audit";
import { actingRoleForRequest } from "@/lib/delegation-access";
import {
  deliveryStatusLabel,
  fulfilStoreOrder,
  isSettableDeliveryStatus,
  storeRegionOf,
} from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/store/orders/[id]/delivery — { index, status } | { indexes, status }
 *
 * Sets the delivery status of one or more product lines on an approved order.
 * Only the warehouse can do this, scoped to their region like every other
 * store screen. When the last line lands on "delivered" the order itself
 * flips to fulfilled so the requester is told the whole order arrived.
 */
export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid order id.", 400);

  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "").trim().toLowerCase();

  const useBatch =
    Array.isArray(body.indexes) &&
    body.indexes.length > 0 &&
    body.indexes.every((value: unknown) => typeof value === "number");
  const targets: number[] = useBatch
    ? [...new Set(body.indexes as number[])].sort((a, b) => a - b)
    : [Math.floor(Number(body.index))];

  if (targets.some((value) => !Number.isInteger(value) || value < 0)) {
    return jsonError(
      useBatch ? "Every selected product line must be a valid index." : "A product line is required.",
    );
  }
  if (!isSettableDeliveryStatus(status)) {
    return jsonError("Unsupported delivery status.");
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
    return jsonError("You must be an approved company member to update deliveries.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  if ((await actingRoleForRequest({
    userId,
    request,
    realRole: String(user.role ?? ""),
    featureKeys: ["warehouse-delivery"],
  })) !== "warehouse") {
    return jsonError("Only the warehouse can update delivery statuses.", 403);
  }

  const { region } = await storeRegionOf(user);
  const order = await StoreOrder.findOne({ _id: id, company: companyId });
  if (!order) return jsonError("Order not found.", 404);
  // Same region scoping as the delivery list: a warehouse only sees and
  // touches orders from its own region (empty region = company-wide).
  if (region && String(order.regionLabel ?? "") !== region) {
    return jsonError("That order belongs to another region.", 403);
  }

  if (String((order as any).fulfillmentMethod ?? "delivery") === "takeaway") {
    return jsonError("This is a take-away order — use the take-away handover actions.", 409);
  }

  if (String(order.status) !== "approved") {
    return jsonError(
      "Only an approved order can have its delivery statuses updated.",
      409,
    );
  }

  const lines = Array.isArray(order.items) ? order.items : [];
  if (targets.some((value) => value >= lines.length)) {
    return jsonError(
      targets.length > 1
        ? "One or more of those products are not part of this order."
        : "That product is not part of this order.",
      400,
    );
  }

  const changedIndexes: number[] = [];
  const changedNames: string[] = [];
  let fromStatus = "";

  for (const target of targets) {
    const line = lines[target];
    const previous = String((line as any).deliveryStatus ?? "pending");
    if (previous === status) continue;
    if (!fromStatus) fromStatus = previous;
    (line as any).deliveryStatus = status;
    changedIndexes.push(target);
    changedNames.push(String(line.name || "Product"));
  }

  if (changedIndexes.length === 0) {
    return NextResponse.json({ order: serializeDoc(order), changed: false });
  }

  const summary = changedNames.join(", ").slice(0, 120);

  if (!Array.isArray(order.activity)) order.activity = [];
  (order.activity as any[]).push({
    user: user._id,
    action: deliveryStatusLabel(status),
    detail: summary,
  });

  // Every product delivered means the order itself is done.
  const allDelivered =
    lines.length > 0 &&
    lines.every((l: (typeof lines)[number]) => String((l as any).deliveryStatus) === "delivered");
  let fulfilledNow = false;
  if (allDelivered) {
    fulfilStoreOrder(order as any, user);
    (order.activity as any[]).push({
      user: user._id,
      action: "Delivered",
      detail: "Every product in this order has been delivered — invoice issued",
    });
    fulfilledNow = true;
  }

  await order.save();

  const orderNumber = String(order.orderNumber ?? "");
  const requesterId = String(order.requester ?? "");
  if (fulfilledNow && requesterId && requesterId !== userId) {
    await Notification.create({
      user: requesterId,
      company: companyId,
      type: "approval",
      title: `Store order ${orderNumber} — delivered`,
      message: `Every product of store order ${orderNumber} has been delivered. Your invoice is now available.`,
      link: "/profile/store/orders",
    });
    emitNotification(requesterId);
  }

  await recordAudit({
    action: "store.order.delivery",
    actionLabel: `Store delivery — ${deliveryStatusLabel(status)}`,
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-order",
    entityId: String(order._id),
    from: { deliveryStatus: fromStatus },
    to: { deliveryStatus: status, indexes: changedIndexes, products: changedNames.join(", ") },
    result: "success",
    request,
  });

  return NextResponse.json({ order: serializeDoc(order), changed: true, fulfilled: fulfilledNow });
}
