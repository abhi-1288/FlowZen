import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { User } from "@/models/User";
import { StoreItem } from "@/models/StoreItem";
import { StoreOrder } from "@/models/StoreOrder";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { recordAudit } from "@/lib/audit";
import {
  nextStoreOrderNumber,
  storeRegionOf,
  validateStoreApprover,
} from "@/lib/store";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name regionLabel",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view orders.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const url = new URL(request.url);
  const scope = String(url.searchParams.get("scope") ?? "my");
  const countOnly = url.searchParams.get("count") === "1";
  const { region } = await storeRegionOf(user);

  let filter: Record<string, unknown> = { company: companyId };
  if (scope === "awaiting") {
    filter = { ...filter, approver: userId, status: "pending" };
  } else if (scope === "all") {
    const isWarehouse = String(user.role) === "warehouse";
    if (!isWarehouse) return jsonError("Only warehouse managers can view all orders.", 403);
    if (region) filter.regionLabel = region;
  } else {
    filter = { ...filter, requester: userId };
  }

  if (countOnly) {
    const count = await StoreOrder.countDocuments(filter);
    return NextResponse.json({ count });
  }

  const orders = await StoreOrder.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("requester", "name email role")
    .populate("approver", "name email role")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name")
    .populate("fulfilledBy", "name");

  return NextResponse.json({
    orders: serializeDocs(orders as any),
    region,
    canDecide: true,
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const deliveryName = String(body.deliveryName ?? "").trim().slice(0, 120);
  const department = String(body.department ?? "").trim().slice(0, 160);
  const approverId = String(body.approverId ?? "").trim();

  if (rawItems.length === 0) return jsonError("Add at least one product to the cart.");
  if (rawItems.length > 50) return jsonError("An order can hold at most 50 lines.");
  if (!deliveryName) return jsonError("A delivery name is required.");
  if (!department) return jsonError("An address (department) is required.");

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name regionLabel team activeTeams",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to order.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const { region } = await storeRegionOf(user);

  const approverCheck = await validateStoreApprover(user as any, approverId);
  if (!approverCheck.ok) return jsonError(approverCheck.error, 403);

  // Resolve and validate every line against this region's stock first.
  const wanted: Array<{ itemId: string; quantity: number }> = [];
  for (const raw of rawItems) {
    const itemId = String((raw as any)?.itemId ?? (raw as any)?.item ?? "");
    const quantity = Math.floor(Number((raw as any)?.quantity ?? 0));
    if (!Types.ObjectId.isValid(itemId)) return jsonError("Invalid product in cart.");
    if (!Number.isFinite(quantity) || quantity < 1) {
      return jsonError("Every product needs a quantity of at least 1.");
    }
    wanted.push({ itemId, quantity });
  }

  const itemIds = wanted.map((w) => w.itemId);
  const items = await StoreItem.find({
    _id: { $in: itemIds },
    company: companyId,
    ...(region ? { regionLabel: region } : {}),
  });
  const byId = new Map(items.map((i) => [String(i._id), i]));

  const lines: Array<{
    item: Types.ObjectId;
    productNumber: string;
    batchNumber: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    quantity: number;
  }> = [];
  for (const w of wanted) {
    const item = byId.get(w.itemId);
    if (!item) return jsonError("A product in your cart is not available in your region's store.");
    if ((item.stock || 0) < w.quantity) {
      return jsonError(
        `Only ${item.stock || 0} left of "${item.name}" — adjust the quantity.`,
        409,
      );
    }
    lines.push({
      item: item._id as Types.ObjectId,
      productNumber: String(item.productNumber ?? ""),
      batchNumber: String(item.batchNumber ?? ""),
      name: String(item.name ?? ""),
      category: String(item.category ?? "other"),
      unit: String(item.unit ?? "piece"),
      price: Number(item.price ?? 0),
      quantity: w.quantity,
    });
  }

  // Hold stock: atomic per-line guard, compensating on partial failure so a
  // race with another order can never oversell.
  const held: Array<{ itemId: string; quantity: number }> = [];
  try {
    for (const line of lines) {
      const res = await StoreItem.updateOne(
        { _id: line.item, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
      );
      if (res.modifiedCount !== 1) {
        throw new Error(`OUT_OF_STOCK:${String(line.item)}`);
      }
      held.push({ itemId: String(line.item), quantity: line.quantity });
    }
  } catch (err) {
    for (const h of held) {
      await StoreItem.updateOne({ _id: h.itemId }, { $inc: { stock: h.quantity } });
    }
    if (err instanceof Error && err.message.startsWith("OUT_OF_STOCK:")) {
      const short = byId.get(err.message.slice("OUT_OF_STOCK:".length));
      return jsonError(
        short
          ? `Not enough stock left for "${short.name}" — another order took it.`
          : "Not enough stock for one of the products.",
        409,
      );
    }
    throw err;
  }

  const orderNumber = await nextStoreOrderNumber(companyId);
  const order = await StoreOrder.create({
    company: companyId,
    orderNumber,
    requester: userId,
    regionLabel: region,
    items: lines,
    deliveryName,
    department,
    status: "pending",
    approver: new Types.ObjectId(approverId),
    activity: [
      { user: userId, action: "Order placed", detail: `${lines.length} product(s) — awaiting approval` },
    ],
  });

  await Notification.create({
    user: approverId,
    company: companyId,
    type: "approval",
    title: "Store order awaiting approval",
    message: `${user.name} placed store order ${orderNumber} (${lines.length} product(s)) and needs your approval.`,
    link: "/profile/store/approvals",
  });
  emitNotification(approverId);

  await recordAudit({
    action: "store.order.create",
    actionLabel: "Store order placed",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-order",
    entityId: String(order._id),
    to: { orderNumber, items: lines.length, approver: approverId, region },
    result: "success",
    request,
  });

  return NextResponse.json({ order: order.toObject() }, { status: 201 });
}
