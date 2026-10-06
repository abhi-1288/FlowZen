import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { User } from "@/models/User";
import { WarehouseItem } from "@/models/WarehouseItem";
import { recordAudit } from "@/lib/audit";

const IT_ROLE_SET = new Set<string>(["it-admin", "it-administration"]);

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
    "role company companyStatus name",
  );
  if (!user) return jsonError("User not found.", 404);
  if (!user.company || user.companyStatus !== "approved") {
    return jsonError("You must be an approved company member to view inventory.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const url = new URL(request.url);
  const category = String(url.searchParams.get("category") ?? "").toLowerCase();

  const filter: Record<string, unknown> = { company: companyId };
  if (category === "laptop" || category === "desktop") filter.category = category;

  const items = await WarehouseItem.find(filter).sort({ category: 1, model: 1 });

  return NextResponse.json({ items: serializeDocs(items as any) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const category = String(body.category ?? "").toLowerCase();
  const model = String(body.model ?? "").trim();
  const stock = Number(body.stock ?? 0);
  const notes = String(body.notes ?? "").trim().slice(0, 500);

  if (category !== "laptop" && category !== "desktop") {
    return jsonError("Invalid inventory category.");
  }
  if (!model) return jsonError("A model name is required.");
  if (model.length > 160) return jsonError("Model name must be 160 characters or fewer.");
  if (!Number.isFinite(stock) || stock < 0) return jsonError("Enter a valid stock count.");

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

  const existing = await WarehouseItem.findOne({ company: companyId, category, model });
  if (existing) {
    return jsonError("This model is already in the inventory for this category.", 409);
  }

  const item = await WarehouseItem.create({
    company: companyId,
    category,
    model,
    stock: Math.floor(stock),
    notes,
    createdBy: userId,
  });

  await recordAudit({
    action: "it.inventory.add",
    actionLabel: "Inventory item added",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "warehouse",
    entityId: String(item._id),
    to: { category, model, stock: Math.floor(stock) },
    result: "success",
    request,
  });

  return NextResponse.json({ item: item.toObject() }, { status: 201 });
}