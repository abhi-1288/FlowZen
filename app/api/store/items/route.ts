import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId, serializeDocs } from "@/lib/api";
import { User } from "@/models/User";
import { StoreItem } from "@/models/StoreItem";
import { recordAudit } from "@/lib/audit";
import {
  STORE_CATEGORIES,
  isStoreManager,
  storeRegionOf,
  type StoreCategory,
} from "@/lib/store";

function validCategory(value: unknown): value is StoreCategory {
  return (STORE_CATEGORIES as readonly string[]).includes(String(value ?? "").toLowerCase());
}

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
    return jsonError("You must be an approved company member to view the store.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const { region } = await storeRegionOf(user);

  const url = new URL(request.url);
  const category = String(url.searchParams.get("category") ?? "").toLowerCase();
  const lookup = String(url.searchParams.get("lookup") ?? "").trim();
  const search = String(url.searchParams.get("search") ?? "").trim();

  const filter: Record<string, unknown> = { company: companyId };
  // Stock is per-region: only this member's region's products are served.
  if (region) filter.regionLabel = region;
  if (validCategory(category)) filter.category = category;
  if (lookup) {
    const escaped = lookup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { productNumber: { $regex: `^${escaped}$`, $options: "i" } },
      { batchNumber: { $regex: `^${escaped}$`, $options: "i" } },
    ];
  } else if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { productNumber: { $regex: escaped, $options: "i" } },
      { batchNumber: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }

  const items = await StoreItem.find(filter).sort({ category: 1, name: 1 });

  return NextResponse.json({
    items: serializeDocs(items as any),
    region,
    canManage: isStoreManager(user.role),
  });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const category = String(body.category ?? "other").toLowerCase();
  const name = String(body.name ?? "").trim();
  const productNumber = String(body.productNumber ?? "").trim().toUpperCase();
  const batchNumber = String(body.batchNumber ?? "").trim().toUpperCase();
  const description = String(body.description ?? "").trim().slice(0, 500);
  const unit = String(body.unit ?? "piece").trim().slice(0, 40) || "piece";
  const price = Number(body.price ?? 0);
  const stock = Number(body.stock ?? 0);

  if (!validCategory(category)) return jsonError("Invalid store category.");
  if (!name) return jsonError("A product name is required.");
  if (name.length > 160) return jsonError("Product name must be 160 characters or fewer.");
  if (!productNumber) return jsonError("A product number is required.");
  if (productNumber.length > 60) return jsonError("Product number must be 60 characters or fewer.");
  if (batchNumber.length > 60) return jsonError("Batch number must be 60 characters or fewer.");
  if (!Number.isFinite(price) || price < 0) return jsonError("Enter a valid price.");
  if (!Number.isFinite(stock) || stock < 0) return jsonError("Enter a valid stock count.");

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
    return jsonError("You must be an approved company member to manage products.", 403);
  }
  if (!isStoreManager(user.role)) {
    return jsonError("Only warehouse managers can add products.", 403);
  }
  const companyId =
    typeof user.company === "object" && user.company ? (user.company as any)._id : user.company;

  const { region } = await storeRegionOf(user);

  const existing = await StoreItem.findOne({
    company: companyId,
    regionLabel: region,
    productNumber,
  });
  if (existing) {
    return jsonError("This product number already exists in your region's store.", 409);
  }

  const item = await StoreItem.create({
    company: companyId,
    regionLabel: region,
    category,
    name,
    productNumber,
    batchNumber,
    description,
    unit,
    price: Math.max(0, price),
    stock: Math.floor(stock),
    createdBy: userId,
  });

  await recordAudit({
    action: "store.item.add",
    actionLabel: "Store product added",
    company: companyId,
    actor: { id: user._id, name: user.name, role: user.role },
    entityType: "store-item",
    entityId: String(item._id),
    to: { name, productNumber, batchNumber, stock: Math.floor(stock), region },
    result: "success",
    request,
  });

  return NextResponse.json({ item: item.toObject() }, { status: 201 });
}
