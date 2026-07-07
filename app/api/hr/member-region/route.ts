import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";
import { Company } from "@/models/Company";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!["admin", "human-resource"].includes(String(actor.role))) return jsonError("Forbidden.", 403);
  if (String(actor.companyStatus) !== "approved") return jsonError("Company not approved.", 403);

  const body = await request.json();
  const memberId = String(body.memberId ?? "").trim();
  const regionLabel = String(body.regionLabel ?? "").trim();

  if (!memberId) return jsonError("Member ID is required.", 400);

  const member = await User.findById(memberId);
  if (!member) return jsonError("Member not found.", 404);
  if (String(member.company) !== String(actor.company)) return jsonError("Member is not in your company.", 403);

  member.regionLabel = regionLabel;
  await member.save();

  return NextResponse.json({ ok: true, regionLabel });
}
