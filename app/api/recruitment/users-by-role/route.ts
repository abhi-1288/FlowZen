import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { requireUserId } from "@/lib/api";
import { jsonError, serializeDocs } from "@/lib/api";

const ALLOWED_ROLES = ["project-manager", "qa-tester", "finance", "human-resource", "admin"];

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role") || "";

    await connectDb();
    const currentUser = await User.findById(userId);
    if (!currentUser?.company) return jsonError("Company not found", 404);

    const filter: any = { company: currentUser.company, _id: { $ne: userId } };
    if (roleFilter && ALLOWED_ROLES.includes(roleFilter)) {
      filter.role = roleFilter;
    } else {
      filter.role = { $in: ALLOWED_ROLES };
    }

    const users = await User.find(filter).select("name email role").sort({ name: 1 });
    return NextResponse.json({ users: serializeDocs(users) });
  } catch (err: any) {
    return jsonError(err.message || "Failed to fetch users", 500);
  }
}
