import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { Company } from "@/models/Company";
import { ATSAssessment } from "@/models/ATSAssessment";
import { User } from "@/models/User";
import { pickDomain } from "@/lib/assessment";
import {
  buildServedAssessmentPaper,
  resolveServedIndices,
} from "@/lib/assessment-paper";
import { resolveCandidateAssessmentWindow } from "@/lib/assessment-window";
import {
  buildMockPaper,
  drawMockSample,
} from "@/lib/assessment-mock-attempt";
import { resolveMockTestConfig } from "@/lib/assessment-mock";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { resolveProctoringConfig, DEFAULT_PROCTORING } from "@/lib/assessment-proctoring";
import { buildPreviewSamplePaper } from "@/lib/assessment-preview-sample";
import { isQuestionLanguage } from "@/lib/question-languages";
import { resolveTranslateModelConfig, translateQuestionContent } from "@/lib/question-translate";

/**
 * HR preview of the candidate test experience.
 *
 * A dry run of `/api/public/candidate/me` and the candidate start route, HR
 * instead of candidate. Two outputs share one file on purpose — a preview must
 * hand back the *same* paper the client said it answered, so the pre-start card
 * payload and the question payload live beside each other:
 *
 *   GET /api/recruitment/jobs/:id/assessment/preview?mode=mock
 *       -> the portal-card payload (no questions), forced to the open state.
 *
 *   GET /api/recruitment/jobs/:id/assessment/preview?mode=mock&start=1&domain=X
 *       -> the served paper for that domain (same shape the candidate start
 *          route returns) plus the local clock the preview panel counts down.
 *
 * Nothing here writes: no attempt is created, no candidate field moves, no
 * email goes out, and no portal token is minted. The seed is deterministic per
 * job + track, so every preview call replays the same sampling decision until
 * the bank or the configuration changes.
 *
 * Deliberately, the window gates are NOT enforced here. Seeing the paper before
 * the window opens is the point of the preview; the real endpoints keep their
 * gates and the mock-test modal already shows the live window chip. Only the
 * structural gates survive (mock switched off, empty bank, missing date), and
 * even then the messages mirror what a candidate would hit.
 *
 * When no assessment document exists for the job yet, the preview still runs:
 * the info payload reports an empty bank and the paper is served from the dummy
 * sample set, flagged `sample: true` so the UI carries the caution all the way
 * into the result screen.
 */

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

/**
 * Stable sampling seed for one job's preview track. Not derived from the
 * candidate (there is none), and stable across repetitions for the start and
 * the grade that closes the loop.
 */
function previewSeed(jobId: string, mode: "assessment" | "mock"): string {
  return `preview:${jobId}:${mode}`;
}

/** Auth + load shared by every verb in this route family. Returns job + assessment. The assessment may be null (not created yet); the payload and paper builders degrade to dummy data instead of erroring. */
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
    .select(
      "title assessment assessmentDate assessmentDurationMinutes windowMode"
    )
    .lean();
  if (!job) return jsonError("Job not found.", 404);
  if (!job?.assessment) {
    return jsonError("Online assessment is not enabled for this job.", 400);
  }

  // Not a hard error any more: HR can still walk the whole flow on sample
  // questions so they know exactly what candidates will see once a paper exists.
  const assessment = await ATSAssessment.findOne({ job: id, company: user.company }).lean();

  return { jobId: id, job, assessment, companyId: user.company };
}

/** Total questions available right now: the general bank plus every domain's. Null assessment means none. */
function bankCount(assessment: any | null): number {
  if (!assessment) return 0;
  const general = (assessment?.questions as any[]) || [];
  const domains = (assessment?.domains as any[]) || [];
  const domainTotal = domains.reduce(
    (sum, d) => sum + (Array.isArray(d?.questions) ? d.questions.length : 0),
    0
  );
  return general.length + domainTotal;
}

/** The portal-card payload, mirroring `/api/public/candidate/me`, forced open. Null assessment degrades to defaults. */
function buildInfoPayload(job: any, assessment: any | null, isMock: boolean) {
  const window = assessment ? resolveCandidateAssessmentWindow(job, assessment, null) : null;
  // The real assessment runs entirely off the configured date; the mock track
  // keeps its own window, so a missing date does not stop a mock preview.
  if (!isMock && assessment && !window) {
    return jsonError(
      "The assessment has no date configured, so candidates would see no test. Preview is unavailable until a date is set.",
      400
    );
  }

  const proctoring = assessment
    ? { ...resolveProctoringConfig((assessment as any)?.proctoring), exempt: false }
    : { ...DEFAULT_PROCTORING, active: false, exempt: false };
  const slots = window ? (window as any).slots || [] : [];
  const firstSlotMs = slots.length ? Number(slots[0]?.startMs) : NaN;
  const anchorMs = Number.isFinite(firstSlotMs)
    ? firstSlotMs
    : job.assessmentDate
      ? new Date(job.assessmentDate).getTime()
      : null;
  const anchorIso = anchorMs != null && Number.isFinite(anchorMs) ? new Date(anchorMs).toISOString() : null;
  const durationMinutes = isMock
    ? (assessment ? resolveMockTestConfig((assessment as any).mockTest).durationMinutes : null) ?? (job as any).assessmentDurationMinutes ?? null
    : (window as any)?.durationMinutes ?? null;

  const domains = assessment ? (((assessment as any).domains as any[]) || []) : [];
  const base: Record<string, unknown> = {
    enabled: true,
    // Real question count right now: the preview modal uses it to warn that the
    // walkthrough will run on flagged sample questions when the bank is empty.
    questionTotal: bankCount(assessment),
    // Preview is a dry run lying in one direction only: the phase. Everything
    // else — thresholds, instructions, domains, the slot list — is the real
    // configuration so HR reviews what candidates will actually get.
    phase: "open",
    eligibleToStart: true,
    submittable: false,
    windowMode: isMock ? "relief" : (((window as any)?.mode) as "uniform" | "relief") ?? "uniform",
    durationMinutes,
    passScore: assessment ? ((assessment as any).passScore ?? 50) : 50,
    negativeMarking: assessment ? ((assessment as any).negativeMarking ?? 0) : 0,
    negativeMarkingLabel: assessment ? ((assessment as any).negativeMarkingLabel || "") : "",
    instructions: assessment ? ((assessment as any).instructions || "") : "",
    domains: domains.map((d) => ({
      name: d.name,
      limit: d.limit ?? 0,
      questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
    })),
    domain: "",
    stage: "assessment",
    // No candidate here, so every per-candidate field stays blank.
    startedAt: null,
    submittedAt: null,
    score: null,
    rawMarks: null,
    maxMarks: null,
    status: "pending",
    rejectionNote: "",
    slotStart: null,
    startsAt: anchorIso,
    lastEntryAt: null,
    untilLobbyMs: 0,
    untilStartMs: 0,
    endsAt: null,
    slots: slots.map((s: any) => ({ start: s.start, startMs: new Date(s.startMs).toISOString() })),
    answerKeyPublished: assessment ? Boolean((assessment as any).answerKeyPublished) : false,
    resultPublished: false,
    // Enforcement is off in preview even when candidates will be proctored.
    // `previewProctoring` is the real config so the walkthrough can show it.
    proctoring: { ...proctoring, active: false },
    previewProctoring: { ...proctoring, active: proctoring.enabled },
  };

  if (isMock) {
    const config = assessment ? (resolveMockTestConfig((assessment as any).mockTest) as any) : { enabled: false };
    Object.assign(base, {
      mockEnabled: Boolean(config.enabled),
      resultRelease: config.resultRelease,
      resultDelayHours: config.resultDelayHours,
      maxAttempts: config.maxAttempts,
      attemptsUsed: 0,
      attemptNumber: null,
      result: null,
      bestScore: null,
      resultVisible: false,
      resultVisibleAt: null,
      answerKeyVisible: Boolean(config.showAnswerKey),
    });
    return base;
  }

  return { ...base, startsAt: anchorIso };
}

/** Build the paper for one preview sitting, mirroring the candidate start routes. */
function buildPaperPayload(job: any, assessment: any | null, mode: "assessment" | "mock", domainParam: string) {
  const general = assessment ? (((assessment as any).questions as any[]) || []) : [];
  const domains = assessment ? (((assessment as any).domains as any[]) || []) : [];
  const window = assessment ? resolveCandidateAssessmentWindow(job, assessment, null) : null;

  // Structural gate: without a date a candidate sees no test at all.
  if (mode !== "mock" && assessment && !window) {
    return jsonError(
      "The assessment has no date configured, so candidates would see no test.",
      400
    );
  }

  // No assessment document at all: walk the whole flow on dummy sample questions
  // so HR can still preview device check, countdown, grading and the result screen.
  if (!assessment) {
    const paper = buildPreviewSamplePaper();
    const nowMs = Date.now();
    const durationMinutes = (job as any).assessmentDurationMinutes ?? null;
    return {
      mode,
      sample: true,
      questions: paper.served.map((src: any, i: number) => ({
        index: i,
        text: src?.text ?? "",
        options: Array.isArray(src?.options) ? src.options : [],
        type: src?.type === "essay" ? "essay" : "mcq",
        marks: Math.max(0, Number(src?.marks) || 1),
        required: Boolean(src?.required),
      })),
      domain: null,
      durationMinutes,
      startedAt: new Date(nowMs).toISOString(),
      endsAt: durationMinutes ? new Date(nowMs + Number(durationMinutes) * 60_000).toISOString() : null,
    };
  }

  const chosen = pickDomain(domains, domainParam);
  let paper: { served: any[]; key: any[] };
  let sample = false;
  let durationMinutes: number | null = null;

  if (mode === "mock") {
    const config = resolveMockTestConfig((assessment as any).mockTest);
    if (!config.enabled) {
      return jsonError("The mock test is switched off for this job.", 400);
    }
    const poolSize = general.length + (chosen?.questions?.length || 0);
    if (!poolSize) {
      // Nothing serveable at all: the sample paper keeps the walkthrough usable
      // and the `sample` flag carries the caution all the way into the UI.
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
    durationMinutes = config.durationMinutes || (job as any).assessmentDurationMinutes || null;
  } else {
    const servedIndices = resolveServedIndices({
      generalPool: general.length,
      domainPool: chosen?.questions?.length || 0,
      domainLimit: chosen ? Number((chosen as any).limit) || 0 : 0,
      questionLimit: Number((assessment as any).questionLimit) || 0,
      seed: previewSeed(String(job._id), mode),
    });
    paper = buildServedAssessmentPaper(general, (chosen?.questions || []) as any[], servedIndices);
    if (!paper.served.length) {
      // Empty bank, or an empty slice of it (a domain with no questions): the
      // sample paper keeps the walkthrough usable rather than dead-ending.
      paper = buildPreviewSamplePaper();
      sample = true;
    }
    durationMinutes = (window as any)?.durationMinutes ?? null;
  }

  // The domain question only gates a real paper. When the sample fallback ran
  // there was nothing to choose from, so insisting on a selection would make
  // the preview dead-end exactly where it was built not to.
  if (!sample && domains.length && !chosen) {
    return jsonError(
      mode === "mock"
        ? "Please select your domain to start the mock test."
        : "Please select your domain to start the assessment.",
      400
    );
  }

  const nowMs = Date.now();
  return {
    mode,
    sample,
    questions: paper.served.map((src: any, i: number) => ({
      index: i,
      text: src?.text ?? "",
      options: Array.isArray(src?.options) ? src.options : [],
      type: src?.type === "essay" ? "essay" : "mcq",
      marks: Math.max(0, Number(src?.marks) || 1),
      required: Boolean(src?.required),
    })),
    domain: chosen?.name || null,
    durationMinutes,
    startedAt: new Date(nowMs).toISOString(),
    endsAt: durationMinutes ? new Date(nowMs + Number(durationMinutes) * 60_000).toISOString() : null,
  };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const loaded = await load(request, { params });
    if (loaded instanceof NextResponse) return loaded;
    const { job, assessment } = loaded;

    const { searchParams } = new URL(request.url);
    const mode: "assessment" | "mock" = searchParams.get("mode") === "mock" ? "mock" : "assessment";

    if (searchParams.get("start") === "1") {
      const domain = typeof searchParams.get("domain") === "string" ? String(searchParams.get("domain")) : "";
      const paper = buildPaperPayload(job, assessment, mode, domain);
      // A jsonError from inside the builder is already a NextResponse; wrapping it
      // again would turn every validation failure into a 200 carrying `{}`.
      if (paper instanceof NextResponse) return paper;
      return NextResponse.json(paper);
    }

    const info = buildInfoPayload(job, assessment, mode === "mock");
    if (info instanceof NextResponse) return info;
    return NextResponse.json(info);
  } catch (err: any) {
    // Surface the real failure (instead of an empty 500) so the UI can show it,
    // and log the stack server-side.
    console.error("[assessment/preview] GET failed:", err);
    return jsonError(err?.message || "Preview failed.", 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  const loaded = await load(request, { params });
  if (loaded instanceof NextResponse) return loaded;

  const body = await request.json().catch(() => ({}));
  const language = String(body?.language ?? "").trim();
  if (!isQuestionLanguage(language)) return jsonError("Unsupported language.", 400);

  const text = String(body?.text ?? "");
  if (!text || text.length > 1000) return jsonError("Question text is missing or too long.", 400);

  const rawOptions = Array.isArray(body?.options) ? body.options : [];
  if (rawOptions.length > 20) return jsonError("Too many options.", 400);
  const options = rawOptions.map((o: unknown) => String(o ?? ""));
  if (options.some((o: string) => o.length > 500)) return jsonError("An option is too long.", 400);

  const company = await Company.findById(loaded.companyId)
    .select("atsProvider atsModelApiKey atsModelName atsBaseUrl")
    .lean();
  const config = resolveTranslateModelConfig(company);

  try {
    const translated = await translateQuestionContent({ language, text, options, config });
    return NextResponse.json(translated);
  } catch (err: any) {
    console.error("[preview translate] failed:", err?.message || err);
    return jsonError(err?.message || "Translation is unavailable right now. Please try again.", 500);
  }
}
