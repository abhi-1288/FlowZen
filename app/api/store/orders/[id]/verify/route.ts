import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { StoreOrder } from "@/models/StoreOrder";
import { Notification } from "@/models/Notification";
import { emitNotification } from "@/lib/realtime";
import { restoreStoreOrderStock } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
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

  const user = await User.findById(userId).select("name role company companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") return jsonError("Approved company access is required.", 403);

  const order = await StoreOrder.findOne({ _id: id, company: user.company });
  if (!order) return jsonError("Order not found.", 404);
  if ((order as any).verificationStatus !== "pending-verification") return jsonError("This order is not pending verification.", 400);

  const isAdminHr = ["admin", "human-resource"].includes(String(user.role));
  const isAuthorizer = (order as any).authorizer && String((order as any).authorizer) === userId;
  if (!isAdminHr && !isAuthorizer) return jsonError("Forbidden.", 403);
  if (String((order as any).submittedBy) === userId) return jsonError("You cannot verify your own submission.", 403);

  const pendingAction = String((order as any).pendingAction ?? "approved");
  const pendingReason = String((order as any).pendingReason ?? "");

  if (pendingAction === "approved") {
    order.status = "approved";
    order.approvedBy = user._id;
    order.approvedAt = new Date();
  } else if (pendingAction === "rejected") {
    order.status = "rejected";
    order.rejectedBy = user._id;
    order.rejectedAt = new Date();
    order.rejectedReason = pendingReason;
    await restoreStoreOrderStock(order);
  }

  (order as any).verificationStatus = "verified";
  (order as any).verifiedBy = userId;
  (order as any).verifiedAt = new Date();
  (order as any).pendingAction = "";
  (order as any).pendingReason = "";
  await order.save();

  // Notify requester
  const requesterId = String((order as any).requester ?? "");
  if (requesterId) {
    await Notification.create({
      user: requesterId,
      company: user.company,
      type: "info",
      title: "Order decision verified",
      message: `Order ${order.orderNumber} has been verified (${pendingAction}) by ${user.name ?? "approver"}.`,
      link: "/profile/store/orders",
    });
    emitNotification(requesterId);
  }

  return NextResponse.json({ order: (order as any).toObject ? (order as any).toObject() : order });
}
