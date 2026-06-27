import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

const REQUESTER_ROLES = ["project-manager", "qa-tester", "finance", "human-resource", "admin"];

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  if (!body.title || !String(body.title).trim()) return jsonError("Position name is required.");
  if (!body.assignedHR || !String(body.assignedHR).trim()) return jsonError("Assigned HR is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !REQUESTER_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const hrUser = await User.findOne({ _id: body.assignedHR, company: user.company, role: "human-resource" });
  if (!hrUser) return jsonError("Assigned HR not found or not a human-resource role.", 400);

  const now = new Date();
  const openings = typeof body.openings === "number" && body.openings >= 1 ? body.openings : 1;
  const job = await ATSJob.create({
    title: String(body.title).trim(),
    status: "draft",
    openings,
    workflow: {
      status: "requested",
      requestedBy: userId,
      assignedHR: hrUser._id,
      requestedAt: now,
    },
    createdBy: userId,
    company: user.company,
  });

  await Notification.create({
    user: hrUser._id,
    company: user.company,
    type: "info",
    title: "New Job Request",
    message: `${user.name ?? "A member"} has requested a job for ${job.title}.`,
    link: `/recruitment/jobs/${job._id}`,
  });
  emitToUser(String(hrUser._id), "notification:new", {
    message: `New job request: ${job.title}.`,
  });

  return NextResponse.json({ job: { ...serializeDoc(job), workflow: { ...(job as any).workflow?.toObject?.() ?? (job as any).workflow, requestedBy: { id: user._id, name: user.name }, assignedHR: { id: hrUser._id, name: hrUser.name } } } }, { status: 201 });
}
