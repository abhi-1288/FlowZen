import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { User } from "@/models/User";
import { pickDomain, computeAssessmentScore } from "@/lib/assessment";
import {
  buildServedAssessmentPaper,
  resolveServedIndices,
} from "@/lib/assessment-paper";
import { normalizeAssessmentAnswers } from "@/lib/assessment-finalize";
import {
  buildMockPaper,
  drawMockSample,
} from "@/lib/assessment-mock-attempt";
import { resolveMockTestConfig } from "@/lib/assessment-mock";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { buildPreviewSamplePaper } from "@/lib/assessment-preview-sample";

/**
 * Grade-only scoring for the HR candidate preview.
 *
 * The twin of the preview paper route: it rebuilds the exact served paper from
 * the same deterministic seed (so the questions HR answered are the questions
 * graded), runs `computeAssessmentScore` — the same function the real submit
 * paths use — and returns the result plus an answer-key payload shaped for the
 * panel's PDF builder.\n *
 * Nothing is persisted. No candidate field, no attempt, no timeline entry, and\n * the answers are graded against the pool the job currently has, so a bank edit\n * between preview start and grade can move the paper — acceptable for a preview,\n * and worth saying out loud: the real candidate flow commits its sample, the\n * preview cannot and does not pretend otherwise.\n *
 * Fidelity of the result gate: the answer key follows the *release* rule of the\n * track being previewed — the mock's "show answer key" switch, or the real\n * assessment's published-answer-key flag — so HR previews what the candidate\n * would see, including the "no key" state.\n *
 * When no assessment document exists for the job yet, grading runs on the dummy\n * sample paper with default thresholds (pass 50, no negative marking) and\n * `sample: true`, so the dry run still closes the loop instead of erroring.\n */

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

function previewSeed(jobId: string, mode: "assessment" | "mock"): string {
  return `preview:${jobId}:${mode}`;
}

async function load(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company })
    .select("title assessment assessmentDate assessmentDurationMinutes")
    .lean();
  if (!job) return jsonError("Job not found.", 404);
  if (!job?.assessment) {
    return jsonError("Online assessment is not enabled for this job.", 400);
  }

  // Not a hard error: the preview still runs on dummy sample questions when the
  // assessment document hasn't been created yet.
  const assessment = await ATSAssessment.findOne({ job: id, company: user.company }).lean();

  return { jobId: id, job, assessment };
}

export async function POST(request: Request, { params }: Params) {
  const loaded = await load(request, { params });
  if (loaded instanceof NextResponse) return loaded;
  const { job, assessment } = loaded;

  const body = await request.json().catch(() => ({}));
  const mode: "assessment" | "mock" = body?.mode === "mock" ? "mock" : "assessment";
  const domainParam = typeof body?.domain === "string" ? body.domain : "";
  // Mirror of the real submit routes: a submission at or after its own deadline
  // is the hard stop, not a failure, so required questions are only enforced
  // while there is still time on the (client-anchored) preview clock.
  const autoSubmitted = body?.autoSubmitted === true;
  const answers = normalizeAssessmentAnswers(body?.answers);
  if (!answers.length) return jsonError("No answers provided.", 400);

  const general = assessment ? (((assessment as any).questions as any[]) || []) : [];
  const domains = assessment ? (((assessment as any).domains as any[]) || []) : [];
  const negativeMarking = assessment ? ((assessment as any).negativeMarking ?? 0) : 0;
  const passScore = assessment ? ((assessment as any).passScore ?? 50) : 50;

  let chosen: { name: string; questions: any[] } | null = null;
  let paper: { served: any[]; key: any[] };
  // True when the sample fallback ran: the preview start would have taken the
  // same path, which is also what makes skipping the domain gate below safe.
  let sample = false;

  if (!assessment) {
    // No assessment document at all: grade the same dummy sample paper the start served.
    paper = buildPreviewSamplePaper();
    sample = true;
  } else if (mode === "mock") {
    const config = resolveMockTestConfig((assessment as any).mockTest);
    if (!config.enabled) return jsonError("The mock test is not available.", 400);
    chosen = pickDomain(domains, domainParam);
    const poolSize = general.length + (chosen?.questions?.length || 0);
    if (!poolSize) {
      // Nothing serveable at all: grade the same sample paper the start served.
      paper = buildPreviewSamplePaper();
      sample = true;
    } else {
      const indices = drawMockSample(poolSize, config, previewSeed(String(job._id), mode));
      paper = buildMockPaper(general, (chosen?.questions || []) as any[], indices);
      if (!paper.served.length) {
        paper = buildPreviewSamplePaper();
        sample = true;
      }
    }
  } else {
    chosen = pickDomain(domains, domainParam);
    const servedIndices = resolveServedIndices({
      generalPool: general.length,
      domainPool: chosen?.questions?.length || 0,
      domainLimit: chosen ? Number((chosen as any).limit) || 0 : 0,
      questionLimit: Number((assessment as any).questionLimit) || 0,
      seed: previewSeed(String(job._id), mode),
    });
    paper = buildServedAssessmentPaper(general, (chosen?.questions || []) as any[], servedIndices);
    if (!paper.served.length) {
      // Empty bank, or an empty slice of it: grade the sample paper the start served.
      paper = buildPreviewSamplePaper();
      sample = true;
    }
  }

  // The domain question only gates a real paper: when the sample fallback ran
  // the preview start skipped it too, so enforcing it here would reject a
  // submission the UI legitimately allowed.
  if (!sample && domains.length && !chosen) {
    return jsonError(
      mode === "mock"
        ? "Please select your domain to start the mock test."
        : "Please select your domain to start the assessment.",
      400
    );
  }

  const questions = paper.key;
  // Required questions are enforced exactly like the real submit routes, so the
  // preview reproduces the "Please answer the required question(s)" refusal as
  // well as the scoring — skipped once the clock is up, when answering has
  // already gone from required to best-effort.
  if (!autoSubmitted) {
    const missingRequired: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] as any;
      if (!q?.required) continue;
      const a = answers.find((x) => x.questionIndex === i);
      const answered =
        q.type === "essay"
          ? Boolean(a && String(a.textAnswer || "").trim())
          : a != null && typeof a.selectedOption === "number";
      if (!answered) missingRequired.push(i + 1);
    }
    if (missingRequired.length) {
      return jsonError(
        `Please answer the required question${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`,
        400
      );
    }
  }

  const graded = computeAssessmentScore(
    answers as any[],
    questions as any[],
    negativeMarking
  );

  // The release rule of the track decides whether the answer key comes back at
  // all — previewing the withheld state is part of the preview.
  const answerKeyVisible =
    mode === "mock"
      ? assessment ? resolveMockTestConfig((assessment as any).mockTest).showAnswerKey : false
      : assessment ? Boolean((assessment as any).answerKeyPublished) : false;

  const submittedAtIso = new Date().toISOString();
  let answerKey: Record<string, unknown> | null = null;
  if (answerKeyVisible) {
    const answersList = answers as Array<{ questionIndex: number; selectedOption: number | null; textAnswer?: string }>;
    answerKey = {
      candidate: { firstName: "HR", lastName: "Preview", email: "candidate-experience-preview" },
      jobTitle: (job as any).title,
      domain: chosen?.name || null,
      score: graded.score,
      rawMarks: graded.rawMarks,
      maxMarks: graded.maxMarks,
      passScore,
      negativeMarking,
      negativeMarkingLabel: assessment ? ((assessment as any).negativeMarkingLabel || "") : "",
      startedAt: submittedAtIso,
      submittedAt: submittedAtIso,
      publishedAt: null,
      questions: paper.served.map((q: any, i: number) => {
        const a = answersList.find((x) => x.questionIndex === i);
        return {
          index: i,
          text: q?.text ?? "",
          options: Array.isArray(q?.options) ? q.options : [],
          correctIndex: q?.correctIndex ?? 0,
          marks: Math.max(0, Number(q?.marks) || 1),
          required: Boolean(q?.required),
          type: q?.type === "essay" ? "essay" : "mcq",
          answer: q?.answer ?? "",
          selectedOption: a?.selectedOption ?? null,
          textAnswer: a?.textAnswer ?? "",
        };
      }),
    };
  }

  return NextResponse.json({
    ok: true,
    mode,
    sample,
    score: graded.score,
    rawMarks: graded.rawMarks,
    maxMarks: graded.maxMarks,
    passed: graded.score >= passScore,
    correct: graded.correct,
    wrong: graded.wrong,
    mcqTotal: graded.mcqTotal,
    essayCount: graded.essayCount,
    hasEssays: graded.hasEssays,
    questionCount: questions.length,
    passScore,
    negativeMarking,
    negativeMarkingLabel: assessment ? ((assessment as any).negativeMarkingLabel || "") : "",
    answerKeyVisible,
    startedAt: submittedAtIso,
    submittedAt: submittedAtIso,
    answerKey,
  });
}
