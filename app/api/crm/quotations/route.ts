import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmQuotation } from "@/models/CrmQuotation";
import { requireUserId, serializeDocs, serializeDoc, jsonError } from "@/lib/api";
import { crmReadFilter } from "@/lib/crm-assign";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const docs = await CrmQuotation.find(await crmReadFilter(userId)).sort({ createdAt: -1 });
  return NextResponse.json({ quotations: serializeDocs(docs) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();
  await connectDb();
  const doc = await CrmQuotation.create({ ...body, owner: userId });
  return NextResponse.json({ quotation: serializeDoc(doc) }, { status: 201 });
}
