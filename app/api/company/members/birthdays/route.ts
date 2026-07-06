import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { User } from "@/models/User";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();

  const actor = await User.findById(userId).select("company companyStatus");
  if (!actor) return jsonError("User not found.", 404);
  if (!actor.company || actor.companyStatus !== "approved")
    return jsonError("Approved company access is required.", 403);

  const members = await User.find({
    company: actor.company,
    companyStatus: "approved",
  })
    .select("name dob avatarUrl")
    .lean();

  const result = members.map((m) => ({
    _id: m._id,
    name: m.name,
    dob: m.dob || null,
    avatarUrl: m.avatarUrl || "",
  }));

  return NextResponse.json({ members: result });
}
