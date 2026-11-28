import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { CrmMember } from "@/models/CrmMember";
import { requireUserId, jsonError, isObjectId } from "@/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  const { id } = await params;
  if (!isObjectId(id)) return jsonError("Invalid id", 400);
  await connectDb();
  await CrmMember.deleteOne({ _id: id, owner: userId });
  return NextResponse.json({ ok: true });
}
