import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { User } from "@/models/User";
import { StoreItem } from "@/models/StoreItem";
import { recordAudit } from "@/lib/audit";
import { STORE_CATEGORIES, isStoreManager, storeRegionOf, type StoreCategory } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

function validCategory(value: unknown): value is StoreCategory {
  return (STORE_CATEGORIES as readonly string[]).includes(String(value ?? "").toLowerCase());
}

async function loadManagerForCompany(userId: string) {
  const user = await User.findById(userId).select(
    "role company companyStatus name regionLabel",
  );
  if (!user) return { error: jsonError("User not found.", 404) };
  if (!user.company || user.companyStatus !== "approved") {
    return { error: jsonError("You must be an approved company member to manage products.", 403) };
  }
  if (!isStoreManager(user.role)) {
    return { error: jsonError("Only warehouse managers can manage products.", 403) };
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;
  const { region } = await storeRegionOf(user);
  return { user, companyId, region };
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid product id.", 400);

  const body = await request.json().catch(() => ({}));
  const name = body.name === undefined ? undefined : String(body.name).trim();
  const category = body.category === undefined ? undefined : String(body.category).toLowerCase();
  const productNumber =
    body.productNumber === undefined ? undefined : String(body.productNumber).trim().toUpperCase();
  const batchNumber =
    body.batchNumber === undefined ? undefined : String(body.batchNumber).trim().toUpperCase();
  const description = body.description === undefined ? undefined : String(body.description).trim().slice(0, 500);
  const unit = body.unit === undefined ? undefined : String(body.unit).trim().slice(0, 40);
  const price = body.price === undefined ? undefined : Number(body.price);
  const stock = body.stock === undefined ? undefined : Number(body.stock);
  const status = body.status === undefined ? undefined : String(body.status);
  const quantity = body.quantity === undefined ? undefined : Number(body.quantity);

  if (name !== undefined && !name) return jsonError("A product name is required.");
  if (name !== undefined && name.length > 160) {
    return jsonError("Product name must be 160 characters or fewer.");
  }
  if (productNumber !== undefined && !productNumber) {
    return jsonError("A product number is required.");
  }
  if (category !== undefined && !validCategory(category)) return jsonError("Invalid store category.");
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    return jsonError("Enter a valid price.");
  }
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

  const gate = await loadManagerForCompany(userId);
  if (gate.error) return gate.error;
  const { user, companyId, region } = gate as any;

  const item = await StoreItem.findOne({ _id: id, company: companyId, regionLabel: region });
  if (!item) return jsonError("Product not found in your region's store.", 404);

  const from = { name: item.name, productNumber: item.productNumber, stock: item.stock, price: item.price };

  if (productNumber !== undefined && productNumber !== item.productNumber) {
    const clash = await StoreItem.findOne({
      company: companyId,
      regionLabel: region,
      productNumber,
      _id: { $ne: item._id },
    });
    if (clash) return jsonError("This product number already exists in your region's store.", 409);
    item.productNumber = productNumber;
  }
  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (batchNumber !== undefined) item.batchNumber = batchNumber;
  if (description !== undefined) item.description = description;
  if (unit !== undefined && unit) item.unit = unit;
  if (price !== undefined) item.price = Math.max(0, price);
  if (stock !== undefined) {
    item.stock = Math.max(0, Math.floor(stock));
  } else if (status === "in" && Number.isFinite(quantity)) {
    const qty = Math.floor(quantity as number);
    if (qty < 1) return jsonError("Enter a valid quantity.");
    item.stock = (item.stock || 0) + qty;
  } else if (status === "out" && Number.isFinite(quantity)) {
    const qty = Math.floor(quantity as number);
    if (qty < 1) return jsonError("Enter a valid quantity.");
    if (qty > (item.stock || 0)) return jsonError("Not enough stock to check out.");
    item.stock = Math.max(0, (item.stock || 0) - qty);
  }

  await item.save();

  await recordAudit({
    action: "store.item.update",
    actionLabel: "Store product updated",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-item",
    entityId: String(item._id),
    from,
    to: { name: item.name, productNumber: item.productNumber, stock: item.stock, price: item.price },
    result: "success",
    request,
  });

  return NextResponse.json({ item: serializeDoc(item) });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid product id.", 400);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const gate = await loadManagerForCompany(userId);
  if (gate.error) return gate.error;
  const { user, companyId, region } = gate as any;

  const item = await StoreItem.findOne({ _id: id, company: companyId, regionLabel: region });
  if (!item) return jsonError("Product not found in your region's store.", 404);

  const snapshot = { name: item.name, productNumber: item.productNumber, stock: item.stock };
  await item.deleteOne();

  await recordAudit({
    action: "store.item.remove",
    actionLabel: "Store product removed",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-item",
    entityId: id,
    from: snapshot,
    result: "success",
    request,
  });

  return NextResponse.json({ removed: true });
}
