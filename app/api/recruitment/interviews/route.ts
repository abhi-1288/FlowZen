import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSInterview } from "@/models/ATSInterview";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";

const ALL_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !ALL_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const { searchParams } = new URL(request.url);
  const interviewer = searchParams.get("interviewer");
  const status = searchParams.get("status");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = rawLimit === 0 ? 0 : Math.min(100, Math.max(1, rawLimit));
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const filter: Record<string, unknown> = { company: user.company };
  if (interviewer && isObjectId(interviewer)) filter.interviewer = interviewer;
  if (status) filter.status = status;
  if (fromDate || toDate) {
    filter.scheduledAt = {};
    if (fromDate) (filter.scheduledAt as Record<string, unknown>).$gte = new Date(fromDate);
    if (toDate) (filter.scheduledAt as Record<string, unknown>).$lte = new Date(toDate);
  }

  const [totalCount, interviews] = await Promise.all([
    ATSInterview.countDocuments(filter),
    ATSInterview.find(filter)
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit || undefined)
      .populate("interviewer", "name email")
      .populate("candidate", "firstName lastName")
      .populate("job", "title"),
  ]);

  return NextResponse.json({ interviews: serializeDocs(interviews), totalCount, page, limit });
}
