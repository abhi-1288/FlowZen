import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { FinanceSalary } from "@/models/FinanceSalary";
import { User } from "@/models/User";

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();

    const actor = await User.findById(userId).select("role company companyStatus");
    if (!actor) return jsonError("User not found.", 404);

    const { searchParams } = request.nextUrl;
    const employee = searchParams.get("employee");

    let query: Record<string, unknown> = {};
    if (employee === "me") {
      query.employee = userId;
    } else if (actor.company) {
      query.company = actor.company;
    } else {
      return jsonError("Forbidden", 403);
    }

    const salaries = await FinanceSalary.find(query)
      .sort({ month: -1, createdAt: -1 })
      .populate("employee", "name email companyIdentityCode")
      .lean();

    return NextResponse.json({ salaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
