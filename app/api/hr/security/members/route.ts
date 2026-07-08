import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { databaseUnavailable, jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  try {
    await connectDb();
  } catch (error) {
    const dbError = databaseUnavailable(error);
    if (dbError) return dbError;
    throw error;
  }

  const actor = await User.findById(userId).select("company role");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
  const role = String(url.searchParams.get("role") ?? "").trim();

  const filter: Record<string, unknown> = {
    company: actor.company,
    companyStatus: "approved",
  };
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { companyIdentityCode: { $regex: search, $options: "i" } },
    ];
  }

  const members = await User.find(filter)
    .select("name email role avatarUrl companyIdentityCode companyStatus regionLabel")
    .sort({ name: 1 })
    .lean() as Record<string, unknown>[];

  return NextResponse.json({
    members: members.map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email,
      role: m.role,
      avatarUrl: m.avatarUrl,
      companyIdentityCode: m.companyIdentityCode,
      companyStatus: m.companyStatus,
      regionLabel: m.regionLabel,
    })),
  });
}
