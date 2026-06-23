import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).populate("company", "name");
  if (!job) return jsonError("Job not found.", 404);

  const candidateCount = await ATSCandidate.countDocuments({ job: id, company: user.company });

  return NextResponse.json({ job: { ...serializeDoc(job), applicantsCount: candidateCount } });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  const body = await request.json();

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.department !== undefined) updates.department = String(body.department).trim();
  if (body.location !== undefined) updates.location = String(body.location).trim();
  if (body.employmentType !== undefined) updates.employmentType = body.employmentType;
  if (body.salaryRangeMin !== undefined) updates.salaryRangeMin = Number(body.salaryRangeMin);
  if (body.salaryRangeMax !== undefined) updates.salaryRangeMax = Number(body.salaryRangeMax);
  if (body.currency !== undefined) updates.currency = String(body.currency).trim();
  if (body.openings !== undefined) updates.openings = Number(body.openings);
  if (body.autoCloseDate !== undefined) updates.autoCloseDate = body.autoCloseDate ? new Date(body.autoCloseDate) : null;
  if (body.description !== undefined) updates.description = String(body.description).trim();
  if (body.requiredSkills !== undefined) updates.requiredSkills = Array.isArray(body.requiredSkills) ? body.requiredSkills.map(String) : [];
  const wasPublished = body.status === "open" && user.role === "admin";
  if (body.status !== undefined) {
    if (body.status === "open" && user.role !== "admin") return jsonError("Only admins can publish jobs.", 403);
    updates.status = body.status;
  }

  let job = await ATSJob.findOneAndUpdate(
    { _id: id, company: user.company },
    { $set: updates },
    { new: true }
  );
  if (!job) return jsonError("Job not found.", 404);
  job = await ATSJob.findById(job._id).populate("company", "name");

  await ATSAuditLog.create({
    actor: userId,
    action: "update-job",
    entityType: "ATSJob",
    entityId: job._id,
    metadata: { title: job.title, updates: Object.keys(updates) },
    company: user.company,
  });

  if (wasPublished) {
    const hrUsers = await User.find({ company: user.company, role: "human-resource" });
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        company: user.company,
        type: "info",
        title: "Job Published",
        message: `${job.title} has been published and is now live on the careers page.`,
        link: `/recruitment/jobs/${job._id}`,
      });
      emitToUser(String(hr._id), "notification:new", {
        message: `${job.title} has been published.`,
      });
    }
  }

  return NextResponse.json({ job: serializeDoc(job) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || user.role !== "admin") return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOneAndDelete({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);

  await ATSCandidate.updateMany({ job: id }, { $set: { stage: "rejected" } });

  await ATSAuditLog.create({
    actor: userId,
    action: "delete-job",
    entityType: "ATSJob",
    entityId: job._id,
    metadata: { title: job.title },
    company: user.company,
  });

  return NextResponse.json({ ok: true });
}
