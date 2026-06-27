import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";

const REQUESTER_ROLES = ["admin", "human-resource", "project-manager", "qa-tester", "finance"];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !REQUESTER_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const jobs = await ATSJob.find({
    company: user.company,
    "workflow.requestedBy": userId,
    status: "draft",
  })
    .sort({ "workflow.requestedAt": -1 })
    .populate("workflow.assignedHR", "name email")
    .lean();

  const serialized = serializeDocs(jobs as any);

  return NextResponse.json({
    requests: serialized.map((j: any) => ({
      ...j,
      workflow: {
        ...j.workflow,
        assignedHR: j.workflow?.assignedHR ? { id: String(j.workflow.assignedHR._id), name: j.workflow.assignedHR.name } : null,
      },
    })),
  });
}
