import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUserId, jsonError } from "@/lib/api";
import { User } from "@/models/User";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    if (!role) return jsonError("role query param required");

    await connectDb();
    const user = await User.findById(userId);
    if (!user || !user.company) return jsonError("No company", 400);

    const users = await User.find({
      company: user.company,
      role,
      companyStatus: "approved",
    }).select("name email role");

    return NextResponse.json({ users });
  } catch (err: any) {
    return jsonError(err.message || "Error", 500);
  }
}
