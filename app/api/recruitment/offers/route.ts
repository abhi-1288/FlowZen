import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSOffer } from "@/models/ATSOffer";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";

const HR_ROLES = ["admin", "human-resource"];

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const filter: Record<string, unknown> = { company: user.company };
  if (status) filter.status = status;

  const offers = await ATSOffer.find(filter)
    .sort({ createdAt: -1 })
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ offers: serializeDocs(offers) });
}
