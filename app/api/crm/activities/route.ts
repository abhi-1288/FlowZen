import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmActivity } from "@/models/CrmActivity";
import { requireUserId, serializeDocs, serializeDoc, jsonError } from "@/lib/api";
import { crmReadFilter } from "@/lib/crm-assign";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const docs = await CrmActivity.find(await crmReadFilter(userId)).sort({ createdAt: -1 });
  return NextResponse.json({ activities: serializeDocs(docs) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();
  await connectDb();
  const doc = await CrmActivity.create({ ...body, owner: userId });
  return NextResponse.json({ activity: serializeDoc(doc) }, { status: 201 });
}
