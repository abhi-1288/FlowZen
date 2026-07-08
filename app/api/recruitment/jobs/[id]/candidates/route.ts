import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDocs } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  if (!user || (!HR_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);

  const candidates = await ATSCandidate.find({ job: id, company: user.company })
    .sort({ createdAt: -1 })
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

  return NextResponse.json({ candidates: serializeDocs(candidates) });
}
