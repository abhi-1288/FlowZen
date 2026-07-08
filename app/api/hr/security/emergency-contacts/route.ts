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

  const actor = await User.findById(userId).select("company role isSeniorSecurity");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company) return jsonError("No company.", 400);
  if (!["admin", "human-resource", "security"].includes(String(actor.role))) return jsonError("Forbidden.", 403);

  const isSenior = String(actor.role) === "admin" || String(actor.role) === "human-resource" || Boolean((actor as any).isSeniorSecurity);

  const members = await User.find({
    company: actor.company,
    companyStatus: "approved",
  })
    .select("name email phone emergencyContact bloodGroup role regionLabel")
    .sort({ name: 1 })
    .lean() as Record<string, unknown>[];

  return NextResponse.json({
    contacts: members.map((m) => ({
      id: String(m._id),
      name: m.name,
      email: m.email,
      role: m.role,
      emergencyContact: m.emergencyContact || "",
      phone: isSenior ? (m.phone || "") : "",
      bloodGroup: m.bloodGroup || "",
      regionLabel: m.regionLabel || "",
    })),
  });
}
