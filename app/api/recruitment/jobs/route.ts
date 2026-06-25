import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

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
  const department = searchParams.get("department");

  const filter: Record<string, unknown> = { company: user.company };
  if (status) filter.status = status;
  if (department) filter.department = department;

  const jobs = await ATSJob.find(filter).populate("company", "name").sort({ createdAt: -1 });

  const jobIds = jobs.map((j: any) => j._id);
  const counts = await ATSCandidate.aggregate([
    { $match: { job: { $in: jobIds }, company: user.company } },
    { $group: { _id: "$job", count: { $sum: 1 } } },
  ]);
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[String(c._id)] = c.count;
  const jobsWithCount = jobs.map((job: any) => ({
    ...serializeDoc(job),
    applicantsCount: countMap[String(job._id)] ?? 0,
  }));

  return NextResponse.json({ jobs: jobsWithCount });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  if (!body.title || !body.title.trim()) return jsonError("Title is required.");
  if (!body.department || !body.department.trim()) return jsonError("Department is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.create({
    title: String(body.title).trim(),
    department: String(body.department).trim(),
    location: String(body.location ?? "").trim(),
    employmentType: body.employmentType || "full-time",
    salaryRangeMin: Number(body.salaryRangeMin) || 0,
    salaryRangeMax: Number(body.salaryRangeMax) || 0,
    salaryType: body.salaryType || "per-annum",
    currency: String(body.currency || "INR").trim(),
    openings: Number(body.openings) || 1,
    autoCloseDate: body.autoCloseDate ? new Date(body.autoCloseDate) : null,
    description: String(body.description ?? "").trim(),
    requiredSkills: Array.isArray(body.requiredSkills) ? body.requiredSkills.map(String) : [],
    status: body.status || "draft",
    createdBy: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "create-job",
    entityType: "ATSJob",
    entityId: job._id,
    metadata: { title: job.title },
    company: user.company,
  });

  const admins = await User.find({ company: user.company, role: "admin" });
  for (const admin of admins) {
    if (String(admin._id) === String(userId)) continue;
    await Notification.create({
      user: admin._id,
      company: user.company,
      type: "info",
      title: "New Job Opening",
      message: `${job.title} has been created by ${user.name || user.email}.`,
      link: `/recruitment/jobs/${job._id}`,
    });
    emitToUser(String(admin._id), "notification:new", {
      message: `New job opening: ${job.title}.`,
    });
  }

  return NextResponse.json({ job: serializeDoc(job) }, { status: 201 });
}
