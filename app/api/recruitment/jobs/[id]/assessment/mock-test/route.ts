import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSCandidate } from "@/models/ATSCandidate";
import { User } from "@/models/User";
import {
  mockSampleSize,
  resolveMockTestConfig,
  resolveMockWindow,
  validateMockTestConfig,
  type MockTestConfig,
} from "@/lib/assessment-mock";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { MOCK_ELIGIBLE_STAGES } from "@/lib/assessment-mock-emails";

/**
 * HR configuration for a job's mock test.
 *
 * Separate from the assessment route on purpose: this only ever writes the
 * `mockTest` sub-document, so it cannot disturb the question bank, the pass
 * score or the real proctoring settings. It also never upserts — a mock with no
 * question bank behind it could never be served, so the assessment document
 * has to already exist.
 */

const HR_ROLES = ["admin", "human-resource"];

type AttemptRow = {
  attemptNumber: number;
  startedAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  inProgress: boolean;
  score: number | null;
  passed: boolean | null;
  questionCount: number;
};

type MockCandidateRow = {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  attemptsUsed: number;
  bestScore: number | null;
  rows: AttemptRow[];
};

type Params = { params: Promise<{ id: string }> };

type Ctx = {
  jobId: string;
  company: string;
  assessmentDurationMinutes: number | null;
};

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** Auth + load. Returns either an error Response or the job context. */
async function load(
  request: Request,
  { params }: Params
): Promise<Ctx | NextResponse> {
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
    .select("assessment assessmentDurationMinutes")
    .lean();
  if (!job) return jsonError("Job not found.", 404);
  if (!job?.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

  return {
    jobId: id,
    company: String(user.company),
    assessmentDurationMinutes: job.assessmentDurationMinutes ?? null,
  };
}

export async function GET(request: Request, { params }: Params) {
  const ctx = await load(request, { params });
  if (ctx instanceof NextResponse) return ctx;

  // A job can have the assessment switched on with no question bank saved yet.
  // That is a state the modal has to be able to explain, so it is reported as an
  // empty pool rather than an error — refusing to load would leave HR with a
  // button that opens onto "could not be loaded" and no way to find out why.
  const assessment = await ATSAssessment.findOne({ job: ctx.jobId, company: ctx.company }).lean();

  const config = resolveMockTestConfig(assessment?.mockTest);
  const window = resolveMockWindow(config, Date.now(), ctx.assessmentDurationMinutes);

  const general = (assessment?.questions as any[]) || [];
  const domains = (assessment?.domains as any[]) || [];
  const domainCounts = domains.map((d: any) => ({
    name: String(d?.name || ""),
    questions: (d?.questions as any[])?.length || 0,
  }));
  const poolTotal = general.length + domainCounts.reduce((sum, d) => sum + d.questions, 0);

  // How far along the cohort is, so the modal can say whether changing the
  // window or the attempt limit would land on people already mid-paper.
  const [eligible, invited, attempted] = await Promise.all([
    ATSCandidate.countDocuments({
      job: ctx.jobId,
      company: ctx.company,
      stage: { $in: MOCK_ELIGIBLE_STAGES },
    }),
    ATSCandidate.countDocuments({
      job: ctx.jobId,
      company: ctx.company,
      stage: { $in: MOCK_ELIGIBLE_STAGES },
      "mockTest.inviteSentAt": { $ne: null },
    }),
    ATSCandidate.countDocuments({
      job: ctx.jobId,
      company: ctx.company,
      "mockTest.attempts.startedAt": { $ne: null },
    }),
  ]);

  // Who has actually sat it, newest first. Capped because this is a glance at
  // progress, not a reporting screen — a job with thousands of candidates should
  // not make the modal fetch the lot.
  const sat = await ATSCandidate.find({
    job: ctx.jobId,
    company: ctx.company,
    "mockTest.attempts.startedAt": { $ne: null },
  })
    .select("firstName lastName email mockTest")
    .sort({ "mockTest.lastSubmittedAt": -1, updatedAt: -1 })
    .limit(50)
    .lean();

  const attempts: MockCandidateRow[] = sat
    .map((c: any) => {
      const rows = ((c.mockTest?.attempts as any[]) || []).filter((a) => a?.startedAt);
      const best = rows.reduce<{ score: number | null; index: number }>(
        (acc, a, i) => {
          if (a.submittedAt == null || a.score == null) return acc;
          return acc.score === null || a.score > acc.score ? { score: a.score, index: i } : acc;
        },
        { score: null, index: -1 }
      );
      return {
        candidateId: String((c as any)._id),
        firstName: (c as any).firstName,
        lastName: (c as any).lastName || "",
        email: (c as any).email,
        attemptsUsed: rows.length,
        bestScore: (c.mockTest as any)?.bestScore ?? best.score,
        rows: rows.map((a: any, i: number) => ({
          attemptNumber: a.attemptNumber ?? i + 1,
          startedAt: a.startedAt ?? null,
          submittedAt: a.submittedAt ?? null,
          autoSubmitted: Boolean(a.autoSubmitted),
          inProgress: a.submittedAt == null,
          score: a.score ?? null,
          passed: a.passed ?? null,
          questionCount: (a.questionIndices as any[])?.length ?? 0,
        })),
      };
    })
    .filter((row: { rows: AttemptRow[] }) => row.rows.length > 0);

  return NextResponse.json({
    mockTest: {
      ...config,
      opensAt: iso(window.opensAt),
      closesAt: iso(window.closesAt),
      lastInvitedAt: config.lastInvitedAt ? config.lastInvitedAt.toISOString() : null,
    },
    window: {
      phase: window.phase,
      opensAt: iso(window.opensAt),
      closesAt: iso(window.closesAt),
      lastEntryAt: iso(window.lastEntryAt),
      durationMinutes: window.durationMinutes,
    },
    pool: {
      total: poolTotal,
      // False when there is nothing to sample. The modal uses this to explain
      // the state instead of offering a mock that no candidate could sit.
      ready: poolTotal > 0,
      general: general.length,
      domains: domainCounts,
      // What a candidate on a single-domain paper would actually be asked. Their
      // own domain decides it, so this is the worst case (every domain question).
      sampleSize: mockSampleSize(poolTotal, config.questionPercent),
    },
    job: { assessmentDurationMinutes: ctx.assessmentDurationMinutes },
    cohort: { eligible, invited, attempted },
    attempts,
  });
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await load(request, { params });
  if (ctx instanceof NextResponse) return ctx;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request.", 400);

  const validated = validateMockTestConfig(body, ctx.assessmentDurationMinutes);
  if (!validated.ok) return jsonError(validated.error, 400);
  const config: MockTestConfig = validated.value;

  // Deliberately no upsert. An ATSAssessment with no question bank cannot serve
  // a paper, and creating a stub here would leave a half-built document that
  // the assessment route would later have to reconcile.
  const assessment = await ATSAssessment.findOne({ job: ctx.jobId, company: ctx.company }).lean();
  if (!assessment) return jsonError("Add questions to the assessment first.", 400);

  // An enabled mock draws its paper from the bank, so an empty one would leave
  // every candidate staring at "questions are not yet available" on start. This
  // is checked here as well as in the modal so the state cannot be reached by
  // calling the API directly. Saving a window with it switched off is still
  // allowed, so HR can configure ahead of uploading questions.
  if (config.enabled) {
    const bankSize =
      ((assessment.questions as any[])?.length || 0) +
      ((assessment.domains as any[]) || []).reduce(
        (sum: number, d: any) => sum + ((d?.questions as any[])?.length || 0),
        0
      );
    if (bankSize === 0) {
      return jsonError("Add at least one question before enabling the mock test.", 400);
    }
  }

  const window = resolveMockWindow(config, Date.now(), ctx.assessmentDurationMinutes);
  if (config.enabled && window.phase === "unusable") {
    return jsonError("The mock test window is not valid.", 400);
  }

  // lastInvitedAt is owned by the invite cron, not by HR, so it is carried over
  // rather than reset — otherwise saving the form would re-arm the blast.
  const previous = resolveMockTestConfig(assessment.mockTest);

  // A moved window is a different invitation, so the per-candidate latch has to
  // go with it: otherwise everybody emailed for the old dates would stay latched
  // and never hear about the new ones. Cosmetic saves (duration, attempts,
  // result release) deliberately do not re-arm anything.
  const stamp = (d: Date | null) => (d ? d.getTime() : null);
  const windowChanged =
    stamp(previous.opensAt) !== stamp(config.opensAt) ||
    stamp(previous.closesAt) !== stamp(config.closesAt);
  if (windowChanged) {
    await ATSCandidate.updateMany(
      { job: ctx.jobId, company: ctx.company, stage: { $in: MOCK_ELIGIBLE_STAGES } },
      { $set: { "mockTest.inviteSentAt": null } }
    );
  }

  await ATSAssessment.updateOne(
    { job: ctx.jobId, company: ctx.company },
    { $set: { mockTest: { ...config, lastInvitedAt: previous.lastInvitedAt } } }
  );

  return NextResponse.json({
    ok: true,
    mockTest: {
      ...config,
      opensAt: iso(window.opensAt),
      closesAt: iso(window.closesAt),
      lastInvitedAt: previous.lastInvitedAt ? previous.lastInvitedAt.toISOString() : null,
    },
    window: {
      phase: window.phase,
      opensAt: iso(window.opensAt),
      closesAt: iso(window.closesAt),
      lastEntryAt: iso(window.lastEntryAt),
      durationMinutes: window.durationMinutes,
    },
  });
}
