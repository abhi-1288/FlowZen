import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { StoreOrder } from "@/models/StoreOrder";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/store/orders/[id]/invoice
 *
 * Printable store invoice. The order number doubles as the invoice number and
 * the document deliberately omits prices — it records what was issued, not
 * what it cost. Only the requester, the assigned approver and the warehouse
 * may read it, and only after the warehouse completed the order.
 */
export async function GET(_request: Request, { params }: Params) {
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
    return jsonError("You must be an approved company member to view invoices.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const order = await StoreOrder.findOne({ _id: id, company: companyId })
    .populate("requester", "name email role companyIdentityCode regionLabel")
    .populate("approver", "name email role")
    .populate("fulfilledBy", "name");
  if (!order) return jsonError("Order not found.", 404);

  const requesterId = String((order.requester as any)?._id ?? order.requester ?? "");
  const approverId = String((order.approver as any)?._id ?? order.approver ?? "");
  const isWarehouse = String(user.role) === "warehouse";
  if (!isWarehouse && requesterId !== userId && approverId !== userId) {
    return jsonError("You do not have access to this invoice.", 403);
  }

  if (!(order as any).invoiceIssuedAt) {
    return jsonError("This invoice becomes available once the order is completed.", 409);
  }

  const company = (await Company.findById(companyId)
    .select("name icon address supportEmail website")
    .lean()) as {
    name?: string;
    icon?: string;
    address?: string;
    supportEmail?: string;
    website?: string;
  } | null;

  const items = (Array.isArray(order.items) ? order.items : []).map((line: any) => ({
    name: String(line.name ?? ""),
    productNumber: String(line.productNumber ?? ""),
    category: String(line.category ?? "other"),
    unit: String(line.unit ?? "piece"),
    quantity: Number(line.quantity ?? 0),
  }));

  return NextResponse.json({
    invoice: {
      number: String(order.orderNumber ?? ""),
      issuedAt: (order as any).invoiceIssuedAt,
      completedAt: (order as any).fulfilledAt ?? (order as any).invoiceIssuedAt,
      fulfillmentMethod: String((order as any).fulfillmentMethod ?? "delivery"),
      deliveryName: String((order as any).deliveryName ?? ""),
      department: String((order as any).department ?? ""),
      regionLabel: String((order as any).regionLabel ?? ""),
      requester: (order.requester as any) ?? null,
      approver: (order.approver as any) ?? null,
      fulfilledBy: (order.fulfilledBy as any) ?? null,
      items,
    },
    company: {
      name: String(company?.name ?? "Company"),
      icon: String(company?.icon ?? ""),
      address: String(company?.address ?? ""),
      supportEmail: String(company?.supportEmail ?? ""),
      website: String(company?.website ?? ""),
    },
  });
}
