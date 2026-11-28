import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmLead } from "@/models/CrmLead";
import { requireUserId, serializeDocs, serializeDoc, jsonError } from "@/lib/api";
import { crmReadFilter } from "@/lib/crm-assign";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const docs = await CrmLead.find(await crmReadFilter(userId)).sort({ createdAt: -1 });
  return NextResponse.json({ leads: serializeDocs(docs) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();
  await connectDb();
  const doc = await CrmLead.create({ ...body, owner: userId });
  return NextResponse.json({ lead: serializeDoc(doc) }, { status: 201 });
}
