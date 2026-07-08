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
  if (user.role !== "admin") return jsonError("Forbidden", 403);
  if (user.companyStatus !== "approved") return jsonError("Company not approved.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const hrs = await User.find({
    company: companyId,
    role: "human-resource",
    companyStatus: "approved",
  })
    .select("name email")
    .lean();

  return NextResponse.json({
    hrs: hrs.map((h) => ({
      id: String(h._id),
      name: h.name ?? "",
      email: h.email ?? "",
    })),
  });
}
