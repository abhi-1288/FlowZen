import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmMember } from "@/models/CrmMember";
import { requireUserId, serializeDocs, serializeDoc, jsonError } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  await connectDb();
  const docs = await CrmMember.find({ owner: userId }).sort({ createdAt: -1 });
  return NextResponse.json({ members: serializeDocs(docs) });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const body = await request.json();
  if (!body?.name && !body?.email) return jsonError("Name or email is required", 400);
  await connectDb();
  const doc = await CrmMember.create({ ...body, owner: userId });
  return NextResponse.json({ member: serializeDoc(doc) }, { status: 201 });
}
