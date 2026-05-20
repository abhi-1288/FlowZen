import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const admin = await User.findById(userId);
  if (!admin) return jsonError("User not found.", 404);
  if (admin.role !== "admin" || admin.companyStatus !== "approved" || !admin.company) {
    return jsonError("Only approved admins can freeze a company.", 403);
  }

  const company = await Company.findById(admin.company);
  if (!company) return jsonError("Company not found.", 404);
  if (company.status === "taken-down") {
    return jsonError("Company has already been taken down.", 400);
  }

  const approvedMembersBesidesAdmin = await User.countDocuments({
    _id: { $ne: admin._id },
    company: company._id,
    companyStatus: "approved",
  });
  if (approvedMembersBesidesAdmin > 0) {
    return jsonError("Remove all approved members before freezing this company.", 409);
  }

  company.status = "frozen";
  await company.save();

  return NextResponse.json({ ok: true, status: company.status });
}
