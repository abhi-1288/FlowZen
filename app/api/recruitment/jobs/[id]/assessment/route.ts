import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId, serializeDoc } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import { pickDomain } from "@/lib/assessment";
import { parseNegativeMarking } from "@/lib/assessment-negative-marking";
import {
  DEFAULT_PROCTORING,
  MAX_NOISE_THRESHOLD_DB,
  MIN_NOISE_THRESHOLD_DB,
} from "@/lib/assessment-proctoring";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

function cleanQuestion(q: any) {
  const type = q.type === "essay" ? "essay" : "mcq";
  if (type === "essay") {
    return {
      text: String(q.text || "").trim(),
      options: [],
      correctIndex: 0,
      type,
      answer: String(q.answer || "").trim().slice(0, 2000),
      marks: Math.max(0, Math.min(100, Number(q.marks) || 1)),
      required: Boolean(q.required),
    };
  }
  const options = Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"];
  return {
    text: String(q.text || "").trim(),
    options,
    correctIndex: Math.max(0, Number(q.correctIndex) || 0),
    type,
    answer: "",
    marks: Math.max(0, Math.min(100, Number(q.marks) || 1)),
    required: Boolean(q.required),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
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
    .select("firstName lastName email assessmentScore assessmentDomain assessmentAnswers")
    .lean();

  const essayReviews = essayPendingCandidates.map((c: any) => {
    const domain = pickDomain((assessment?.domains as any[]) || [], c.assessmentDomain);
    const flat = [
      ...(assessment?.questions || []),
      ...(domain?.questions || []),
    ];
    const qIndexToText = new Map<number, string>();
    flat.forEach((q: any, i: number) => qIndexToText.set(i, q.text));
    return {
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
    };
  });

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
  const general = Array.isArray(body.questions) ? body.questions : [];
  const domains = Array.isArray(body.domains) ? body.domains : [];

  const totalQuestions = general.length + domains.reduce((s: number, d: any) => s + (Array.isArray(d.questions) ? d.questions.length : 0), 0);
  if (totalQuestions === 0) {
    return jsonError("Add at least one question across the general section or the domain sections.", 400);
  }

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company });
  if (!job) return jsonError("Job not found.", 404);
  if (!job.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  const questions = general.map(cleanQuestion);

  const cleanDomains = domains
    .map((d: any) => {
      const name = String(d.name || "").trim();
      if (!name) return null;
      return {
        name: name.slice(0, 100),
        limit: Math.max(0, Math.min(500, Number(d.limit) || 0)),
        questions: (Array.isArray(d.questions) ? d.questions : []).map(cleanQuestion),
      };
    })
    .filter((d: any) => !!d);

  const passScore = Math.max(0, Math.min(100, Number(body.passScore) || 50));
  const negativeMarking = Math.max(0, Math.min(100, Number(body.negativeMarking) || 0));
  // The label is display-only, so never trust it: keep it only when it really
  // is the fraction HR meant. Anything else falls back to no label and the
  // candidate-facing text shows the plain decimal.
  const requestedLabel = String(body.negativeMarkingLabel ?? "").trim();
  let negativeMarkingLabel = "";
  if (requestedLabel && negativeMarking > 0) {
    const reparsed = parseNegativeMarking(requestedLabel);
    if (reparsed.ok && Math.abs(reparsed.value - negativeMarking) < 1e-9) {
      negativeMarkingLabel = requestedLabel.slice(0, 40);
    }
  }

  const durationMinutes =
    body.durationMinutes != null
      ? Math.max(1, Math.min(600, Number(body.durationMinutes)))
      : (job.assessmentDurationMinutes ?? 60);

  // Scheduling mode, extra start times, and the optional pre-exam notice the
  // candidate reads in the waiting room. Slots are "HH:mm" values on the job's
  // assessment date; an empty list means a single slot taken from that date.
  const windowMode: "uniform" | "relief" = body.windowMode === "uniform" ? "uniform" : "relief";
  const timeSlots = (Array.isArray(body.timeSlots) ? body.timeSlots : [])
    .map((s: any) => ({ start: String(s?.start || "").trim() }))
    .filter((s: { start: string }) => /^([01]?\d|2[0-3]):([0-5]\d)$/.test(s.start))
    .slice(0, 12);
  const instructions = String(body.instructions || "").trim().slice(0, 2000);

  // Proctoring settings. Camera/mic/face checks are only meaningful while the
  // paper is proctored, so they collapse to their permissive values when the
  // whole feature is off — otherwise turning proctoring on and off would leave
  // a stale "camera required" behind.
  const requestedProctoring = (body.proctoring ?? {}) as Record<string, unknown>;
  const proctoringEnabled = requestedProctoring.enabled === true;
  const proctoring = {
    enabled: proctoringEnabled,
    requireCamera: proctoringEnabled && requestedProctoring.requireCamera !== false,
    requireMic: proctoringEnabled && requestedProctoring.requireMic !== false,
    requireFullscreen:
      proctoringEnabled && requestedProctoring.requireFullscreen !== false,
    blockOnFocusLoss: proctoringEnabled && requestedProctoring.blockOnFocusLoss !== false,
    noiseThresholdDb: (() => {
      const raw = Number(requestedProctoring.noiseThresholdDb);
      if (!Number.isFinite(raw)) return DEFAULT_PROCTORING.noiseThresholdDb;
      return Math.min(
        MAX_NOISE_THRESHOLD_DB,
        Math.max(MIN_NOISE_THRESHOLD_DB, raw)
      );
    })(),
    noiseWarningLimit: (() => {
      const raw = Number(requestedProctoring.noiseWarningLimit);
      if (!Number.isFinite(raw)) return DEFAULT_PROCTORING.noiseWarningLimit;
      return Math.min(20, Math.max(0, Math.round(raw)));
    })(),
    requireSingleFace: proctoringEnabled && requestedProctoring.requireSingleFace === true,
    blockScreenShare: proctoringEnabled && requestedProctoring.blockScreenShare !== false,
  };

  await ATSJob.findByIdAndUpdate(job._id, { assessmentDurationMinutes: durationMinutes });

  const set = {
    passScore,
    negativeMarking,
    negativeMarkingLabel,
    windowMode,
    timeSlots,
    proctoring,
    instructions,
    questions,
    domains: cleanDomains,
    createdBy: userId,
  };
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
