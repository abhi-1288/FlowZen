import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import { isValidSlug } from "@/lib/slug-shared";

export async function PATCH(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const newSlug = String(body.slug ?? "").trim().toLowerCase();

  if (!newSlug) return jsonError("Subdomain slug is required.");
  if (!isValidSlug(newSlug)) {
    return jsonError("Invalid slug. Use 2-40 lowercase letters, numbers, and hyphens. No reserved words.");
  }

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) return jsonError("User not found.", 404);
  if (user.role !== "admin") return jsonError("Only admins can change the company subdomain.", 403);
  if (!user.company) return jsonError("You must have a registered company.");

  const companyId = typeof user.company === "object" && user.company
    ? String((user.company as any)._id ?? "")
    : String(user.company);

  const company = await Company.findById(companyId);
  if (!company) return jsonError("Company not found.", 404);

  if (company.slug === newSlug) {
    return NextResponse.json({ slug: company.slug });
  }

  const taken = await Company.exists({ slug: newSlug, _id: { $ne: company._id } });
  if (taken) {
    return jsonError("This subdomain is already taken. Please choose another.", 409);
  }

  company.slug = newSlug;
  await company.save();

  return NextResponse.json({ slug: company.slug });
}
