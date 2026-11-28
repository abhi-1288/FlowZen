import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmLead } from "@/models/CrmLead";
import { requireUserId, serializeDoc, jsonError, isObjectId } from "@/lib/api";
import { crmWriteFilter } from "@/lib/crm-assign";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid id", 400);
  await connectDb();
  const doc = await CrmLead.findOne({ ...(await crmWriteFilter(userId)), _id: id });
  if (!doc) return jsonError("Not found", 404);
  return NextResponse.json({ lead: serializeDoc(doc) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid id", 400);
  const body = await request.json();
  await connectDb();
  const doc = await CrmLead.findOneAndUpdate({ ...(await crmWriteFilter(userId)), _id: id }, body, { new: true });
  if (!doc) return jsonError("Not found", 404);
  return NextResponse.json({ lead: serializeDoc(doc) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid id", 400);
  await connectDb();
  const doc = await CrmLead.findOneAndDelete({ ...(await crmWriteFilter(userId)), _id: id });
  if (!doc) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
}
