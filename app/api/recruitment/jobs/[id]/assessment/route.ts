import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("assessment assessmentDate assessmentDurationMinutes");
  if (!job) return jsonError("Job not found.", 404);

  const assessment = await ATSAssessment.findOne({ job: id, company: user.company });

  const inAssessment = await ATSCandidate.countDocuments({ job: id, company: user.company, stage: "assessment" });
  const started = await ATSCandidate.countDocuments({ job: id, company: user.company, stage: "assessment", assessmentStartedAt: { $ne: null } });
  const submitted = await ATSCandidate.countDocuments({ job: id, company: user.company, stage: "assessment", assessmentSubmittedAt: { $ne: null } });
  const passed = await ATSCandidate.countDocuments({ job: id, company: user.company, assessmentStatus: "selected" });
  const failed = await ATSCandidate.countDocuments({ job: id, company: user.company, assessmentStatus: "rejected" });
  const pending = inAssessment - started;

  return NextResponse.json({
    assessment: assessment ? serializeDoc(assessment) : null,
    stats: { inAssessment, started, submitted, passed, failed, pending: Math.max(0, pending) },
    job: { assessment: job.assessment, assessmentDate: job.assessmentDate, assessmentDurationMinutes: job.assessmentDurationMinutes },
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  const body = await request.json();
  if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return jsonError("At least one question is required.", 400);
  }

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);
  if (!job.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  const questions = body.questions.map((q: any) => ({
    text: String(q.text || "").trim(),
    options: Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"],
    correctIndex: Number(q.correctIndex) || 0,
  }));

  const passScore = Math.max(0, Math.min(100, Number(body.passScore) || 50));

  const durationMinutes =
    body.durationMinutes != null
      ? Math.max(1, Math.min(600, Number(body.durationMinutes)))
      : (job.assessmentDurationMinutes ?? 60);

  await ATSJob.findByIdAndUpdate(job._id, { assessmentDurationMinutes: durationMinutes });

  const assessment = await ATSAssessment.findOneAndUpdate(
    { job: id, company: user.company },
    { $set: { passScore, questions, createdBy: userId }, $setOnInsert: { company: user.company } },
    { new: true, upsert: true }
  );

  return NextResponse.json({
    assessment: serializeDoc(assessment!),
    job: { assessmentDurationMinutes: durationMinutes },
  });
}