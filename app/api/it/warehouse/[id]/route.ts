import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { WarehouseItem } from "@/models/WarehouseItem";
import { recordAudit } from "@/lib/audit";

const IT_ROLE_SET = new Set<string>(["it-admin", "it-administration"]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid inventory id.", 400);

  const body = await request.json();
  const model = body.model === undefined ? undefined : String(body.model).trim();
  const stock = body.stock === undefined ? undefined : Number(body.stock);
  const status = body.status === undefined ? undefined : String(body.status);
  const notes = body.notes === undefined ? undefined : String(body.notes).trim().slice(0, 500);

  if (model !== undefined && !model) return jsonError("A model name is required.");
  if (model !== undefined && model.length > 160) return jsonError("Model name must be 160 characters or fewer.");
  if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) {
    return jsonError("Enter a valid stock count.");
  }
  if (status !== undefined && status !== "in" && status !== "out") {
    return jsonError("Invalid stock status.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to manage inventory.", 403);
  }
  if (!IT_ROLE_SET.has(String(user.role))) {
    return jsonError("Only IT admins can manage inventory.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const item = await WarehouseItem.findOne({ _id: id, company: companyId });
  if (!item) return jsonError("Inventory item not found.", 404);

  const from = {
    category: item.category,
    model: item.model,
    stock: item.stock,
  };

  if (model !== undefined) item.model = model;
  if (notes !== undefined) item.notes = notes;
  if (stock !== undefined) {
    item.stock = Math.max(0, Math.floor(stock));
  } else if (status === "in" && body.quantity !== undefined) {
    const qty = Math.floor(Number(body.quantity));
    if (!Number.isFinite(qty) || qty < 1) return jsonError("Enter a valid quantity.");
    item.stock = (item.stock || 0) + qty;
  } else if (status === "out" && body.quantity !== undefined) {
    const qty = Math.floor(Number(body.quantity));
    if (!Number.isFinite(qty) || qty < 1) return jsonError("Enter a valid quantity.");
    if (qty > (item.stock || 0)) return jsonError("Not enough stock to check out.");
    item.stock = Math.max(0, (item.stock || 0) - qty);
  }

  await item.save();

  await recordAudit({
    action: "it.inventory.update",
    actionLabel: "Inventory item updated",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "warehouse",
    entityId: String(item._id),
    from,
    to: { category: item.category, model: item.model, stock: item.stock },
    result: "success",
    request,
  });

  return NextResponse.json({ item: item.toObject() });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid inventory id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select(
    "role company companyStatus name",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to manage inventory.", 403);
  }
  if (!IT_ROLE_SET.has(String(user.role))) {
    return jsonError("Only IT admins can manage inventory.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const item = await WarehouseItem.findOne({ _id: id, company: companyId });
  if (!item) return jsonError("Inventory item not found.", 404);

  const snapshot = {
    category: item.category,
    model: item.model,
    stock: item.stock,
  };
  await item.deleteOne();

  await recordAudit({
    action: "it.inventory.remove",
    actionLabel: "Inventory item removed",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "warehouse",
    entityId: String(item._id),
    from: snapshot,
    result: "success",
    request,
  });

  return NextResponse.json({ removed: true });
}