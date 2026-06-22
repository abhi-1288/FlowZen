import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";

const HR_ROLES = ["admin", "human-resource"];

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const { searchParams } = new URL(request.url);
  const interviewer = searchParams.get("interviewer");
  const status = searchParams.get("status");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");

  const filter: Record<string, unknown> = { company: user.company };
  if (interviewer && isObjectId(interviewer)) filter.interviewer = interviewer;
  if (status) filter.status = status;
  if (fromDate || toDate) {
    filter.scheduledAt = {};
    if (fromDate) (filter.scheduledAt as Record<string, unknown>).$gte = new Date(fromDate);
    if (toDate) (filter.scheduledAt as Record<string, unknown>).$lte = new Date(toDate);
  }

  const interviews = await ATSInterview.find(filter)
    .sort({ scheduledAt: -1 })
    .populate("interviewer", "name email")
    .populate("candidate", "firstName lastName")
    .populate("job", "title");

  return NextResponse.json({ interviews: serializeDocs(interviews) });
}
