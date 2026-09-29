import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { isCompanyOwner } from "@/lib/admin-region-scope";

export async function POST() {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    try {
      await connectDb();
    } catch (error) {
      const dbError = databaseUnavailable(error);
      if (dbError) return dbError;
      throw error;
    }

    const actor = await User.findById(userId);
    if (!actor) return jsonError("User not found.", 404);
    if (!actor.company) return jsonError("You must have a registered company.", 400);

    const company = await Company.findById(actor.company);
    if (!company) return jsonError("Company not found.", 404);
    if (!isCompanyOwner(company, actor)) {
      return jsonError("Only the company owner can freeze or unfreeze a company.", 403);
    }
    if (company.status === "taken-down") {
      return jsonError("Company has already been taken down.", 400);
    }

    if (company.status === "active") {
      const approvedMembersBesidesAdmin = await User.countDocuments({
        _id: { $ne: actor._id },
        company: company._id,
        companyStatus: "approved",
      });
      if (approvedMembersBesidesAdmin > 0) {
        return jsonError("Remove all approved members before freezing this company.", 409);
      }
      company.status = "frozen";
    } else {
      company.status = "active";
    }

    await company.save();

    return NextResponse.json({ ok: true, status: company.status });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to process request.",
      500,
    );
  }
}
