import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSReferral } from "@/models/ATSReferral";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";
import { autoCloseOverdueJobs } from "@/lib/recruitment-utils";
import { deleteFileByUrl } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };
const HR_ROLES = ["admin", "human-resource"];

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);
  if (!isObjectId(id)) return jsonError("Invalid job id.");

  await connectDb();
  await autoCloseOverdueJobs();
  const user = await User.findById(userId);
  const isSeniorSecurity = user?.role === "security" && Boolean((user as any).isSeniorSecurity);
  if (!user || (!HR_ROLES.includes(user.role) && !isSeniorSecurity)) return jsonError("Forbidden", 403);
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

  const companyId = user.company;

  const existingJob = await ATSJob.findOne({ _id: id, company: companyId });
  if (!existingJob) return jsonError("Job not found.", 404);

  const action = body.action;

  if (action === "accept") {
    if (user.role !== "human-resource") return jsonError("Only HR can accept assignments.", 403);
    if (String((existingJob as any).workflow?.assignedHR) !== String(userId)) return jsonError("This job is not assigned to you.", 403);
    if ((existingJob as any).workflow?.status !== "requested") return jsonError("Job is not in requested state.", 400);
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { "workflow.status": "assigned", "workflow.assignedAt": new Date() } },
      { new: true }
    );
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "reject") {
    if (user.role !== "human-resource") return jsonError("Only HR can reject assignments.", 403);
    if (String((existingJob as any).workflow?.assignedHR) !== String(userId)) return jsonError("This job is not assigned to you.", 403);
    if ((existingJob as any).workflow?.status !== "requested") return jsonError("Job is not in requested state.", 400);
    const reason = String(body.rejectionReason || "Declined").trim();
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { "workflow.status": "requested", "workflow.rejectionReason": reason }, $unset: { "workflow.assignedHR": "" } },
      { new: true }
    );
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "save-draft") {
    if (user.role !== "human-resource") return jsonError("Only HR can edit job drafts.", 403);
    const wfStatus = (existingJob as any).workflow?.status;
    if (wfStatus !== "assigned" && wfStatus !== "drafting" && wfStatus !== "salary-approved" && wfStatus !== "requested") return jsonError("Cannot edit job at this stage.", 400);
    const updates: Record<string, unknown> = {
      "workflow.status": "drafting",
    };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.department !== undefined) updates.department = String(body.department).trim();
    if (body.location !== undefined) updates.location = String(body.location).trim();
    if (body.employmentType !== undefined) updates.employmentType = body.employmentType;
    if (body.currency !== undefined) updates.currency = String(body.currency).trim();
    if (body.openings !== undefined) updates.openings = Number(body.openings);
    if (body.autoCloseDate !== undefined) updates.autoCloseDate = body.autoCloseDate ? new Date(body.autoCloseDate) : null;
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.requiredSkills !== undefined) updates.requiredSkills = Array.isArray(body.requiredSkills) ? body.requiredSkills.map(String) : [];
    if (body.salaryRangeMin !== undefined) updates.salaryRangeMin = Number(body.salaryRangeMin);
    if (body.salaryRangeMax !== undefined) updates.salaryRangeMax = Number(body.salaryRangeMax);
    if (body.salaryType !== undefined) updates.salaryType = body.salaryType;
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: updates },
      { new: true }
    );
    const requesterId = (existingJob as any).workflow?.requestedBy;
    if (requesterId && String(requesterId) !== String(userId)) {
      await Notification.create({
        user: requesterId,
        company: companyId,
        type: "info",
        title: "Job Draft Saved",
        message: `HR has saved a draft for ${(job as any).title}.`,
        link: `/recruitment/jobs/${job!._id}`,
      });
      emitToUser(String(requesterId), "notification:new", {
        message: `Draft saved for ${(job as any).title}.`,
      });
    }
    const adminUsers = await User.find({ company: companyId, role: "admin" });
    for (const admin of adminUsers) {
      if (String(admin._id) === String(userId) || (requesterId && String(admin._id) === String(requesterId))) continue;
      await Notification.create({
        user: admin._id,
        company: companyId,
        type: "info",
        title: "Job Draft Saved",
        message: `HR has saved a draft for ${(job as any).title}.`,
        link: `/recruitment/jobs/${job!._id}`,
      });
      emitToUser(String(admin._id), "notification:new", {
        message: `Draft saved for ${(job as any).title}.`,
      });
    }
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "forward") {
    if (user.role !== "human-resource") return jsonError("Only HR can forward to admin.", 403);
    if (String((existingJob as any).workflow?.assignedHR) !== String(userId)) return jsonError("This job is not assigned to you.", 403);
    if ((existingJob as any).workflow?.status !== "drafting" && (existingJob as any).workflow?.status !== "requested") return jsonError("Job must be in drafting or requested state to forward.", 400);
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { "workflow.status": "salary-pending", "workflow.forwardedAt": new Date() } },
      { new: true }
    );
    const admins = await User.find({ company: companyId, role: "admin" });
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        company: companyId,
        type: "info",
        title: "Salary Approval Needed",
        message: `${(job as any).title} needs salary approval.`,
        link: `/recruitment/jobs/${job!._id}`,
      });
      emitToUser(String(admin._id), "notification:new", {
        message: `${(job as any).title} needs salary approval.`,
      });
    }
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "set-salary") {
    if (user.role !== "admin") return jsonError("Only admins can set salary.", 403);
    if ((existingJob as any).workflow?.status !== "salary-pending") return jsonError("Job is not awaiting salary.", 400);
    if (body.salaryRangeMin === undefined || body.salaryRangeMax === undefined) return jsonError("Salary range is required.", 400);
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      {
        $set: {
          "workflow.status": "salary-approved",
          "workflow.salaryApprovedBy": userId,
          "workflow.salaryApprovedAt": new Date(),
          salaryRangeMin: Number(body.salaryRangeMin),
          salaryRangeMax: Number(body.salaryRangeMax),
          salaryType: body.salaryType || "per-annum",
        },
      },
      { new: true }
    );
    const hrId = (existingJob as any).workflow?.assignedHR;
    if (hrId) {
      await Notification.create({
        user: hrId,
        company: companyId,
        type: "info",
        title: "Salary Approved",
        message: `Salary has been set for ${(job as any).title}. You can now finalize the job.`,
        link: `/recruitment/jobs/${job!._id}`,
      });
      emitToUser(String(hrId), "notification:new", {
        message: `Salary approved for ${(job as any).title}.`,
      });
    }
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "mark-ready") {
    if (user.role !== "human-resource") return jsonError("Only HR can mark job as ready.", 403);
    if (String((existingJob as any).workflow?.assignedHR) !== String(userId)) return jsonError("This job is not assigned to you.", 403);
    if ((existingJob as any).workflow?.status !== "salary-approved") return jsonError("Salary must be approved first.", 400);
    if (!(existingJob as any).title || !String((existingJob as any).title).trim()) return jsonError("Job title is required before marking ready.", 400);
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      { $set: { "workflow.status": "draft-ready", "workflow.readyAt": new Date() } },
      { new: true }
    );
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  if (action === "publish") {
    if (user.role !== "admin") return jsonError("Only admins can publish jobs.", 403);
    if ((existingJob as any).workflow?.status !== "draft-ready") return jsonError("Job must be draft-ready before publishing.", 400);
    const job = await ATSJob.findOneAndUpdate(
      { _id: id, company: companyId },
      {
        $set: {
          "workflow.status": "published",
          "workflow.publishedBy": userId,
          "workflow.publishedAt": new Date(),
          status: "open",
        },
      },
      { new: true }
    );
    if (job) {
      await ATSAuditLog.create({
        actor: userId,
        action: "publish-job",
        entityType: "ATSJob",
        entityId: job._id,
        metadata: { title: job.title },
        company: companyId,
      });
      const hrUsers = await User.find({ company: companyId, role: "human-resource" });
      for (const hr of hrUsers) {
        await Notification.create({
          user: hr._id,
          company: companyId,
          type: "info",
          title: "Job Published",
          message: `${job.title} has been published and is now live.`,
          link: `/recruitment/jobs/${job._id}`,
        });
        emitToUser(String(hr._id), "notification:new", {
          message: `${job.title} has been published.`,
        });
      }
    }
    return NextResponse.json({ job: serializeDoc(job!) });
  }

  // Fallback: regular field updates (for published/open/closed jobs)
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.department !== undefined) updates.department = String(body.department).trim();
  if (body.location !== undefined) updates.location = String(body.location).trim();
  if (body.employmentType !== undefined) updates.employmentType = body.employmentType;
  if (body.salaryRangeMin !== undefined) updates.salaryRangeMin = Number(body.salaryRangeMin);
  if (body.salaryRangeMax !== undefined) updates.salaryRangeMax = Number(body.salaryRangeMax);
  if (body.salaryType !== undefined) updates.salaryType = body.salaryType;
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
    { _id: id, company: companyId },
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
    company: companyId,
  });

  if (wasPublished) {
    const hrUsers = await User.find({ company: companyId, role: "human-resource" });
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        company: companyId,
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
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);

  const candidates = await ATSCandidate.find({ job: id, company: user.company });
  const candidateIds = (candidates as any[]).map((c) => c._id);

  for (const candidate of candidates) {
    if (candidate.resumeUrl) {
      await deleteFileByUrl(candidate.resumeUrl);
    }
  }

  if (candidateIds.length > 0) {
    await ATSInterview.deleteMany({ candidate: { $in: candidateIds } });
    await ATSOffer.deleteMany({ candidate: { $in: candidateIds } });
    await ATSTimeline.deleteMany({ candidate: { $in: candidateIds } });
    await ATSReferral.deleteMany({ candidate: { $in: candidateIds } });
    await ATSCandidate.deleteMany({ _id: { $in: candidateIds } });
  }

  await ATSJob.deleteOne({ _id: id });

  await ATSAuditLog.create({
    actor: userId,
    action: "delete-job",
    entityType: "ATSJob",
    entityId: job._id,
    metadata: { title: job.title, deletedCandidates: candidateIds.length },
    company: user.company,
  });

  return NextResponse.json({ ok: true });
}
