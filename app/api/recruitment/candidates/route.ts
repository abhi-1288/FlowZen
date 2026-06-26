import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { ATSAuditLog } from "@/models/ATSAuditLog";
import { User } from "@/models/User";
import { isObjectId, jsonError, requireUserId, serializeDoc, serializeDocs } from "@/lib/api";
import { emitToUser } from "@/lib/socket-emit";

const HR_ROLES = ["admin", "human-resource"];
const ALL_ROLES = [...HR_ROLES, "project-manager", "qa-tester", "finance"];

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !ALL_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const jobId = searchParams.get("jobId");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = rawLimit === 0 ? 0 : Math.min(100, Math.max(1, rawLimit));
  const skip = limit === 0 ? 0 : (page - 1) * limit;

  const filter: Record<string, unknown> = { company: user.company };
  if (stage) filter.stage = stage;
  if (jobId && isObjectId(jobId)) filter.job = jobId;
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (!HR_ROLES.includes(user.role)) {
    filter["assignedTeam.user"] = userId;
  }

  const [totalCount, candidates] = await Promise.all([
    ATSCandidate.countDocuments(filter),
    ATSCandidate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit || undefined)
      .populate("assignedRecruiter", "name email")
      .populate("assignedTeam.user", "name email")
      .populate("job", "title"),
  ]);

  const candidateIds = candidates.map((c: any) => c._id);
  const upcomingInterviews = candidateIds.length > 0
    ? await import("@/models/ATSInterview").then(({ ATSInterview }) =>
        ATSInterview.find({ candidate: { $in: candidateIds }, status: "scheduled", company: user.company })
          .select("candidate roundType scheduledAt")
          .sort({ scheduledAt: 1 })
          .lean()
      )
    : [];
  const interviewMap: Record<string, any[]> = {};
  for (const iv of upcomingInterviews) {
    const cid = String((iv as any).candidate);
    if (!interviewMap[cid]) interviewMap[cid] = [];
    interviewMap[cid].push(iv);
  }

  const serialized = serializeDocs(candidates).map((c: any) => ({
    ...c,
    upcomingInterviews: interviewMap[c.id] || [],
  }));

  return NextResponse.json({ candidates: serialized, totalCount, page, limit });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  if (!body.firstName || !body.firstName.trim()) return jsonError("First name is required.");
  if (!body.email || !body.email.trim()) return jsonError("Email is required.");
  if (!body.job) return jsonError("Job is required.");

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: body.job, company: user.company });
  if (!job) return jsonError("Job not found.", 404);

  const candidate = await ATSCandidate.create({
    firstName: String(body.firstName).trim(),
    lastName: String(body.lastName ?? "").trim(),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone ?? "").trim(),
    currentCompany: String(body.currentCompany ?? "").trim(),
    experienceYears: Number(body.experienceYears) || 0,
    currentCTC: Number(body.currentCTC) || 0,
    expectedCTC: Number(body.expectedCTC) || 0,
    noticePeriod: Number(body.noticePeriod) || 0,
    source: body.source || "Other",
    stage: "applied",
    rating: Number(body.rating) || 0,
    notes: String(body.notes ?? "").trim(),
    portfolioUrl: String(body.portfolioUrl ?? "").trim(),
    linkedInUrl: String(body.linkedInUrl ?? "").trim(),
    assignedRecruiter: isObjectId(body.assignedRecruiter) ? body.assignedRecruiter : null,
    job: job._id,
    company: user.company,
  });

  await ATSTimeline.create({
    candidate: candidate._id,
    job: job._id,
    action: "applied",
    metadata: { source: body.source || "Other" },
    actor: userId,
    company: user.company,
  });

  await ATSAuditLog.create({
    actor: userId,
    action: "create-candidate",
    entityType: "ATSCandidate",
    entityId: candidate._id,
    metadata: { name: `${candidate.firstName} ${candidate.lastName}`, job: job.title },
    company: user.company,
  });

  if (candidate.assignedRecruiter) {
    emitToUser(String(candidate.assignedRecruiter), "notification:new", {
      message: `Candidate ${candidate.firstName} ${candidate.lastName} assigned to you.`,
    });
  }

  const populated = await ATSCandidate.findById(candidate._id)
    .populate("assignedRecruiter", "name email")
    .populate("job", "title");

  return NextResponse.json({ candidate: serializeDoc(populated!) }, { status: 201 });
}
