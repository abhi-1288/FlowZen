import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isObjectId, jsonError, requireUserId } from "@/lib/api";
import { resolveEnrollingHr } from "@/lib/enrolling-hr";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: memberId } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(memberId)) return jsonError("Invalid member id.");

  let body: { baseSalary?: number };
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Invalid JSON", 400);
  }

  const salaryAmount = Math.max(0, Number(body.baseSalary ?? 0));
  if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
    return jsonError("Enter a valid base salary.");
  }

  await connectDb();

  const actor = await User.findById(userId).select("role company companyStatus name");
  if (!actor || !actor.company || actor.companyStatus !== "approved") {
    return jsonError("Approved company access is required.", 403);
  }

  const actorRole = String(actor.role ?? "");
  if (!["human-resource", "admin"].includes(actorRole)) {
    return jsonError("Only HR or admin can set member salary.", 403);
  }

  const member = await User.findOne({
    _id: memberId,
    company: actor.company,
    companyStatus: "approved",
  }).select("name company membershipHistory baseSalary salaryHistory");
  if (!member) return jsonError("Member not found.", 404);

  if (actorRole === "human-resource") {
    const enrollingHr = await resolveEnrollingHr(member);
    if (enrollingHr?.id && enrollingHr.id !== userId) {
      return jsonError("Only the enrolling HR or admin can set this salary.", 403);
    }
  }

  const oldSalary = Math.max(0, Number(member.baseSalary ?? 0));
  member.baseSalary = salaryAmount;
  if (!Array.isArray(member.salaryHistory)) member.salaryHistory = [];
  member.salaryHistory.push({
    amount: salaryAmount,
    date: new Date(),
    type: salaryAmount >= oldSalary ? "increment" : "decrement",
  });
  await member.save();

  return NextResponse.json({
    ok: true,
    baseSalary: salaryAmount,
  });
}
