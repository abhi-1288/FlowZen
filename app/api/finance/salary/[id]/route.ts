import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select(
    "name role company companyStatus",
  );
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);
  if (String(actor.role) !== "finance")
    return jsonError("Only finance can delete salary records.", 403);

  const { id } = await params;

  const salary = await FinanceSalary.findOne({
    _id: id,
    company: actor.company,
  }).select("status");
  if (!salary) return jsonError("Salary record not found.", 404);
  if (salary.status !== "pending")
    return jsonError("Only pending salary records can be deleted.", 400);

  await FinanceSalary.deleteOne({ _id: id, company: actor.company });

  return NextResponse.json({ ok: true });
}
