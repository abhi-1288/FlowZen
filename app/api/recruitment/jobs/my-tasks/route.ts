import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDocs } from "@/lib/api";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user) return jsonError("User not found", 404);
  if (!user.company) return jsonError("No company found.", 400);

  const role = user.role;
  const isHr = role === "human-resource";
  const isAdmin = role === "admin";

  if (!isHr && !isAdmin) return NextResponse.json({ tasks: [] });

  const now = new Date();

  if (isHr) {
    const hrTasks = await ATSJob.find({
      company: user.company,
      $or: [
        { "workflow.assignedHR": userId, "workflow.status": "requested" },
        { "workflow.assignedHR": userId, "workflow.status": "assigned" },
        { "workflow.assignedHR": userId, "workflow.status": "drafting" },
        { "workflow.assignedHR": userId, "workflow.status": "salary-approved" },
      ],
    })
      .sort({ "workflow.requestedAt": -1 })
      .populate("workflow.requestedBy", "name email")
      .lean();

    const serialized = serializeDocs(hrTasks as any);

    return NextResponse.json({
      tasks: serialized.map((t: any) => ({
        ...t,
        workflow: {
          ...t.workflow,
          requestedBy: t.workflow?.requestedBy ? { id: String(t.workflow.requestedBy._id), name: t.workflow.requestedBy.name } : null,
          assignedHR: { id: userId, name: user.name },
        },
      })),
    });
  }

  if (isAdmin) {
    const adminTasks = await ATSJob.find({
      company: user.company,
      $or: [
        { "workflow.status": "salary-pending" },
        { "workflow.status": "draft-ready" },
      ],
    })
      .sort({ "workflow.forwardedAt": -1 })
      .populate("workflow.requestedBy", "name email")
      .populate("workflow.assignedHR", "name email")
      .lean();

    const serialized = serializeDocs(adminTasks as any);

    return NextResponse.json({
      tasks: serialized.map((t: any) => ({
        ...t,
        workflow: {
          ...t.workflow,
          requestedBy: t.workflow?.requestedBy ? { id: String(t.workflow.requestedBy._id), name: t.workflow.requestedBy.name } : null,
          assignedHR: t.workflow?.assignedHR ? { id: String(t.workflow.assignedHR._id), name: t.workflow.assignedHR.name } : null,
        },
      })),
    });
  }

  return NextResponse.json({ tasks: [] });
}
