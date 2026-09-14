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

  const essayPendingCandidates = await ATSCandidate.find({
    job: id,
    company: user.company,
    assessmentStatus: "pending",
    assessmentSubmittedAt: { $ne: null },
  })
    .select("firstName lastName email assessmentScore assessmentAnswers")
    .lean();

  const qIndexToText = new Map<number, string>();
  if (assessment) {
    assessment.questions.forEach((q: any, i: number) => qIndexToText.set(i, q.text));
  }

  const essayReviews = essayPendingCandidates.map((c: any) => ({
    _id: String(c._id),
    firstName: c.firstName,
    lastName: c.lastName || "",
    email: c.email,
    score: c.assessmentScore ?? null,
    answers: (c.assessmentAnswers || [])
      .filter((a: any) => a && a.textAnswer && String(a.textAnswer).trim())
      .map((a: any) => ({
        questionIndex: a.questionIndex,
        questionText: qIndexToText.get(a.questionIndex) ?? `Question ${a.questionIndex + 1}`,
        textAnswer: String(a.textAnswer).trim(),
      })),
  }));

  return NextResponse.json({
    assessment: assessment ? serializeDoc(assessment) : null,
    stats: { inAssessment, started, submitted, passed, failed, pending: Math.max(0, pending) },
    essayReviews,
    job: { assessment: job.assessment, assessmentDate: job.assessmentDate, assessmentDurationMinutes: job.assessmentDurationMinutes },
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
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

  const questions = body.questions.map((q: any) => {
  const type = q.type === "essay" ? "essay" : "mcq";
  if (type === "essay") {
    return {
      text: String(q.text || "").trim(),
      options: [],
      correctIndex: 0,
      type,
      answer: String(q.answer || "").trim().slice(0, 2000),
    };
  }
  return {
    text: String(q.text || "").trim(),
    options: Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"],
    correctIndex: Math.max(0, Number(q.correctIndex) || 0),
    type,
    answer: "",
  };
});

  const passScore = Math.max(0, Math.min(100, Number(body.passScore) || 50));

  const durationMinutes =
    body.durationMinutes != null
      ? Math.max(1, Math.min(600, Number(body.durationMinutes)))
      : (job.assessmentDurationMinutes ?? 60);

  await ATSJob.findByIdAndUpdate(job._id, { assessmentDurationMinutes: durationMinutes });

  const set = { passScore, questions, createdBy: userId };
  let assessment;
  try {
    assessment = await ATSAssessment.findOneAndUpdate(
      { job: id, company: user.company },
      { $set: set, $setOnInsert: { company: user.company } },
      { new: true, upsert: true }
    );
  } catch (err: any) {
    if (err?.code !== 11000 && err?.code !== 11001) throw err;
    // Two saves raced on the upsert (job index is unique). The document now
    // exists (or was stored under a differing company), so update it directly.
    assessment = await ATSAssessment.findOneAndUpdate(
      { job: id },
      { $set: { ...set, company: user.company } },
      { new: true }
    );
    if (!assessment) throw err;
  }

  return NextResponse.json({
    assessment: serializeDoc(assessment),
    job: { assessmentDurationMinutes: durationMinutes },
  });
  } catch (err: any) {
    if (err?.name === "ValidationError" && err?.errors) {
      const first = Object.values(err.errors)
        .map((e: any) => e.message)
        .find(Boolean);
      if (first) return jsonError(String(first), 400);
    }
    console.error("[assessment POST]", err);
    return jsonError(err?.message || "Failed to save the assessment.", 500);
  }
}