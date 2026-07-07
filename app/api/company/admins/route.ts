import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

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

  const user = await User.findById(userId).select("company role companyStatus");
  if (!user) return jsonError("User not found.", 404);
  if (!user.company) return jsonError("No company found.");
  if (user.role !== "human-resource" && user.role !== "admin") return jsonError("Forbidden", 403);
  if (user.companyStatus !== "approved") return jsonError("Company not approved.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const admins = await User.find({
    company: companyId,
    role: "admin",
    companyStatus: "approved",
  })
    .select("name email")
    .lean();

  return NextResponse.json({
    admins: admins.map((a) => ({
      id: String(a._id),
      name: a.name ?? "",
      email: a.email ?? "",
    })),
  });
}
