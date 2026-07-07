import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { JoinRequest } from "@/models/JoinRequest";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId).select("company");
  if (!user || !user.company) {
    return NextResponse.json({ status: null });
  }

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const pending = await JoinRequest.findOne({
    requester: userId,
    company: companyId,
    kind: "id-card",
    status: "pending",
  }).select("_id").lean() as Record<string, unknown> | null;

  if (pending) {
    return NextResponse.json({ status: "pending" });
  }

  const approved = await JoinRequest.findOne({
    requester: userId,
    company: companyId,
    kind: "id-card",
    status: "approved",
  }).select("_id metadata").lean() as Record<string, unknown> | null;

  if (approved) {
    const meta = (approved.metadata ?? {}) as Record<string, unknown>;
    const signature = meta.isSigned
      ? {
          name: String(meta.signedBy ?? ""),
          role: String(meta.signedRole ?? ""),
          signedAt: String(meta.signedAt ?? ""),
        }
      : null;
    const issueDate = String(meta.approvedAt ?? "");
    return NextResponse.json({ status: "approved", requestId: String(approved._id), signature, issueDate });
  }

  return NextResponse.json({ status: null });
}
