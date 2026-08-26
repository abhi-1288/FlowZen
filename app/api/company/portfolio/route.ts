import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.role !== "admin" && user.role !== "human-resource") return jsonError("Only admins and HR can update the company portfolio.", 403);
  if (!user.company) return jsonError("You must have a registered company.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const company = await Company.findById(companyId);
  if (!company) return jsonError("Company not found.", 404);

  if (body.tagline !== undefined) {
    company.tagline = String(body.tagline ?? "").trim().slice(0, 150);
  }
  if (body.about !== undefined) {
    company.about = String(body.about ?? "").trim().slice(0, 2000);
  }
  if (body.mission !== undefined) {
    company.mission = String(body.mission ?? "").trim().slice(0, 1000);
  }

  await company.save();

  return NextResponse.json({
    tagline: company.tagline,
    about: company.about,
    mission: company.mission,
  });
}
