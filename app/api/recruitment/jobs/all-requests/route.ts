import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { jsonError, requireUserId } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found", 404);
  if (!user.company) return jsonError("No company found.", 400);

  const isHr = user.role === "human-resource";
  const isAdmin = user.role === "admin";
  if (!isHr && !isAdmin) return NextResponse.json({ requests: [] });

  const jobs = await ATSJob.find({
    company: user.company,
    "workflow.requestedBy": { $ne: userId },
    status: "draft",
    "workflow.status": { $nin: ["published"] },
  })
    .sort({ "workflow.requestedAt": -1 })
    .populate("workflow.requestedBy", "name email")
    .populate("workflow.assignedHR", "name email")
    .lean();

  const requests = jobs.map((j: any) => {
    const id = String(j._id ?? j.id);
    return {
      ...j,
      _id: id,
      id,
      __v: undefined,
      workflow: {
        ...j.workflow,
        requestedBy: j.workflow?.requestedBy ? { id: String(j.workflow.requestedBy._id), name: j.workflow.requestedBy.name } : null,
        assignedHR: j.workflow?.assignedHR ? { id: String(j.workflow.assignedHR._id), name: j.workflow.assignedHR.name } : null,
      },
    };
  });

  return NextResponse.json({ requests });
}
