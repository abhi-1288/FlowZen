import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { getCandidateDeadlineMs, pickDomain } from "@/lib/assessment";
import { buildServedAssessmentPaper, resolveServedIndices } from "@/lib/assessment-paper";
import { resolveProctoringConfig } from "@/lib/assessment-proctoring";
import {
  getAssessmentAnchorMs,
  getAssessmentDeadlineMs,
  getAssessmentPhase,
} from "@/lib/assessment-timing";
import {
  loadCandidateAssessment,
  resolveCandidateAssessmentWindow,
} from "@/lib/assessment-window";
import {
  buildMockPaper,
  drawMockSample,
  isMockMode,
  mockSampleSeed,
  resolveMockDomain,
  resolveMockSitting,
} from "@/lib/assessment-mock-attempt";
import { resolveActiveMockAttempt } from "@/lib/assessment-mock";

/**
 * "09:00" -> "9:00 AM", for user-facing error text. Pure arithmetic on the
 * configured HH:mm label — no timezone is involved.
 */
function formatSlotLabel(start: string): string {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((start || "").trim());
  if (!match) return start || "selected";
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${match[2]} ${suffix}`;
}

/**
 * Entering an assessment is a two-phase flow.
 *
 *   lobby  (10 min before the slot)  the candidate can enter, read the notice
 *                                    and pick their domain, but no questions
 *                                    are served and no exam clock is created.
 *   exam   (at the slot start)       questions are served and the clock runs.
 *
 * One endpoint serves both, so the panel can simply re-POST when its countdown
 * reaches zero. `assessmentStartedAt` doubles as the exam clock anchor, which is
 * what makes the deadline survive a tab close or a duplicate request.
 */
/**
 * Starting a mock test.
 *
 * Shares the panel, the clock, the proctoring config and the question bank with
 * the real assessment, and nothing else. It is a separate path rather than a
 * parameterised one so that it cannot inherit — even by accident — the real
 * flow's stage promotion, its already-submitted guard, or its timeline entries.
 * A practice paper must leave no trace on the recruitment record.
 *
 * There is no lobby: the mock window is continuous, so a candidate may start at
 * any moment inside it and the paper begins when they press the button.
 */
async function startMockAttempt(request: Request, candidate: any, job: any) {
  if (!["screening", "assessment"].includes(candidate.stage))
    return jsonError("You are not eligible for the mock test.", 400);

  const now = new Date();
  const nowMs = now.getTime();

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  if (!assessment) return jsonError("Mock test questions are not yet available.", 400);

  const sitting = resolveMockSitting(
    candidate,
    (assessment as any).mockTest,
    job.assessmentDurationMinutes ?? null,
    nowMs
  );

  // ── Gates ────────────────────────────────────────────────────────────────
  // An attempt already in progress is governed by its own clock, not by the
  // window: someone who started an hour before the window shut is still sitting
  // it, and must not be cut off because the entry window has since closed.
  if (sitting.activeIndex === null) {
    if (!sitting.config.enabled) return jsonError("The mock test is not open.", 400);
    if (sitting.window.phase === "unusable") return jsonError("The mock test is not available.", 400);
    if (sitting.window.phase === "scheduled") {
      return jsonError(
        `The mock test opens at ${new Date(sitting.window.opensAt as number).toISOString()}.`,
        425
      );
    }
    if (sitting.window.phase === "entry-closed") {
      return jsonError(
        `The last time to start the mock test has passed. It closes at ${new Date(
          sitting.window.closesAt as number
        ).toISOString()}.`,
        409
      );
    }
    if (sitting.window.phase !== "open") return jsonError("The mock test is not available.", 400);
    if (sitting.remainingStarts <= 0) {
      return jsonError("You have used all of your mock test attempts.", 409);
    }
  } else if (sitting.deadlineMs !== null && nowMs >= sitting.deadlineMs) {
    return jsonError("Your time is up. The mock test has been closed.", 409);
  }

  // ── Domain ───────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const requestedDomain = typeof body?.domain === "string" ? body.domain : "";
  const domains = ((assessment as any).domains as any[]) || [];
  const chosenDomain = resolveMockDomain(domains, requestedDomain, candidate, sitting.active);
  if (domains.length && !chosenDomain) {
    return jsonError("Please select your domain to start the mock test.", 400);
  }

  // ── Proctoring ───────────────────────────────────────────────────────────
  // The same config, and the same acknowledgement gate, as the real paper: a
  // client can skip this by calling the endpoint directly, so requiring the
  // device check before anything is served is what closes the trivial bypass.
  const proctoring = resolveProctoringConfig((assessment as any).proctoring);
  const exempt = sitting.active?.proctoring?.exempt === true;
  const proctoringActive = proctoring.enabled && !exempt;

  if (proctoringActive && sitting.activeIndex === null && body?.proctoringAck !== true) {
    return jsonError("This mock test is proctored. Complete the camera and microphone check first.", 428);
  }

  // ── First start: draw the sample and persist it ──────────────────────────
  // The indices are written as part of the same atomic push that records the
  // start, so there is no window in which a sitting exists without a paper
  // behind it. Two concurrent first-starts draw the same seeded sample, so
  // whichever lands first produces the same paper.
  let index = sitting.activeIndex;
  let attempt = sitting.active;

  if (index === null || !attempt) {
    const poolSize =
      ((assessment as any).questions as any[])?.length + (chosenDomain?.questions?.length || 0);
    if (poolSize <= 0) return jsonError("Mock test questions are not yet available.", 400);

    const attemptNumber = sitting.used + 1;
    const questionIndices = drawMockSample(
      poolSize,
      sitting.config,
      mockSampleSeed(String(candidate._id), String(job._id), attemptNumber)
    );
    if (!questionIndices.length) return jsonError("Mock test questions are not yet available.", 400);

    // Both conditions are enforced in the update filter, not merely read above:
    // two tabs (or a double-clicked Begin) can arrive before either has written,
    // and a plain read-then-push would let both claim attempt number 1.
    // `startedAt` counts toward the cap, matching `resolveMockSitting`.
    const startedCount = {
      $size: {
        $filter: {
          input: { $ifNull: ["$mockTest.attempts", []] },
          as: "a",
          cond: { $ne: ["$$a.startedAt", null] },
        },
      },
    };
    const created = await ATSCandidate.findOneAndUpdate(
      {
        _id: candidate._id,
        // No sitting in progress.
        "mockTest.attempts": {
          $not: { $elemMatch: { startedAt: { $ne: null }, submittedAt: null } },
        },
        // Still within the attempt limit.
        $expr: { $lt: [startedCount, sitting.config.maxAttempts] },
      },
      {
        $push: {
          "mockTest.attempts": {
            attemptNumber,
            startedAt: now,
            submittedAt: null,
            autoSubmitted: false,
            domain: chosenDomain?.name || "",
            questionIndices,
            answers: [],
            proctoring: {
              // Kept to facts: the browser cannot prove a camera is really a
              // camera, so nothing is recorded that the preflight did not see.
              log: proctoringActive
                ? [
                    {
                      at: now,
                      kind: "devices",
                      detail: [
                        proctoring.requireCamera ? "camera required" : "camera optional",
                        proctoring.requireMic ? "microphone required" : "microphone optional",
                        body?.devices === "ok" ? "both devices opened" : "device state unconfirmed",
                        proctoring.requireFullscreen ? "fullscreen enforced" : "fullscreen not enforced",
                      ].join(", "),
                    },
                  ]
                : [],
            },
          },
        },
      },
      { new: true }
    ).select("mockTest.attempts");

    const fresh = (created as any)?.mockTest?.attempts as any[] | undefined;
    if (!created || !fresh?.length) {
      // Lost the race. If the winner's attempt is still in progress, serve that
      // one instead of erroring: two tabs opening together should both be able
      // to work on the same paper.
      const reread = await ATSCandidate.findById(candidate._id).select("mockTest.attempts");
      const attempts = ((reread as any)?.mockTest?.attempts as any[] | undefined)?.filter(Boolean) ?? [];
      const resumed = resolveActiveMockAttempt(attempts) as { index: number; attempt: any } | null;
      if (!resumed) {
        return jsonError("You have used all available attempts for this mock test.", 409);
      }
      index = resumed.index;
      attempt = resumed.attempt;
    } else {
      index = fresh.length - 1;
      attempt = fresh[index];
    }
  }

  // ── Serve ────────────────────────────────────────────────────────────────
  // Replayed from the persisted sample, never re-drawn, so a reload or a second
  // tab cannot hand the candidate a different paper from the one they answered.
  const paper = buildMockPaper(
    ((assessment as any).questions as any[]) || [],
    (chosenDomain?.questions || []) as any[],
    Array.isArray(attempt?.questionIndices) ? attempt.questionIndices : null
  );
  if (!paper.served.length) return jsonError("Mock test questions are not yet available.", 400);

  const questions = paper.served.map((src: any, i: number) => ({
    index: i,
    text: src?.text ?? "",
    options: Array.isArray(src?.options) ? src.options : [],
    type: src?.type === "essay" ? "essay" : "mcq",
    marks: Math.max(0, Number(src?.marks) || 1),
    required: Boolean(src?.required),
  }));

  const startedAtMs = new Date(attempt?.startedAt || now).getTime();
  const deadlineMs = sitting.deadlineMs ?? startedAtMs + (sitting.window.durationMs ?? 0);

  return NextResponse.json({
    mode: "mock",
    waiting: false,
    started: true,
    attemptNumber: attempt?.attemptNumber ?? 1,
    maxAttempts: sitting.maxAttempts,
    windowMode: "relief",
    durationMinutes: sitting.window.durationMinutes,
    passScore: (assessment as any).passScore,
    negativeMarking: (assessment as any).negativeMarking,
    negativeMarkingLabel: (assessment as any).negativeMarkingLabel,
    instructions: (assessment as any).instructions,
    domains,
    proctoring: { ...proctoring, active: proctoringActive },
    domain: chosenDomain?.name || attempt?.domain || null,
    slotStart: new Date(startedAtMs).toISOString(),
    startsAt: new Date(startedAtMs).toISOString(),
    lobbyOpensAt: sitting.window.opensAt === null ? null : new Date(sitting.window.opensAt).toISOString(),
    endsAt: new Date(deadlineMs).toISOString(),
    slots: [],
    questions,
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job);
  if (!job || !job.assessment) return jsonError("Assessment is not available for this job.", 400);

  if (isMockMode(searchParams)) {
    return startMockAttempt(request, candidate, job);
  }

  if (!["screening", "assessment"].includes(candidate.stage))
    return jsonError("You are not eligible for the assessment.", 400);
  if ((candidate as any).assessmentSubmittedAt)
    return jsonError("You have already submitted the assessment.", 400);

  const now = new Date();
  const nowMs = now.getTime();

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  const window = resolveCandidateAssessmentWindow(job, assessment, candidate);
  if (!window) return jsonError("This assessment is not open yet.", 400);
  const { slots, mode, durationMinutes, instructions, passScore, negativeMarking, negativeMarkingLabel, domains, proctoring } = window;

  // A candidate moved back to "screening" by HR is treated as not started,
  // even if a stale assessmentStartedAt flag remains.
  const alreadyStarted = Boolean((candidate as any).assessmentStartedAt) && candidate.stage === "assessment";

  const body = await request.json().catch(() => ({}));
  const requestedSlotMs = body?.slotStart ? new Date(body.slotStart).getTime() : NaN;
  const storedSlotMs = (candidate as any).assessmentSlotStart
    ? new Date((candidate as any).assessmentSlotStart).getTime()
    : null;

  // An in-progress candidate stays pinned to the slot they committed to.
  const chosenSlotMs = alreadyStarted ? storedSlotMs : Number.isFinite(requestedSlotMs) ? requestedSlotMs : storedSlotMs;

  const info = getAssessmentPhase(slots, mode, chosenSlotMs, nowMs);
  const slot = info.slot;
  if (!slot) return jsonError("Assessment is not scheduled yet.", 400);

  // ── Gate: too early to enter at all ──────────────────────────────────────
  if (!alreadyStarted && info.phase === "closed") {
    return jsonError(
      `The waiting room opens ten minutes before the assessment (at ${new Date(
        info.lobbyOpensAt
      ).toISOString()}).`,
      425
    );
  }

  // ── Gate: window closed to new entries ───────────────────────────────────
  if (!alreadyStarted && nowMs >= info.lastEntryAt) {
    return jsonError("The assessment window has closed.", 409);
  }

  // ── Gate: the specific slot has already run its course ───────────────────
  // In uniform mode a slot's exam ends at start + duration. Without this check a
  // candidate who cold-opens the portal after their slot finished (but before the
  // last slot of the day) would be handed questions with a deadline in the past.
  if (!alreadyStarted && nowMs >= slot.endMs) {
    return jsonError(
      `The ${formatSlotLabel(slot.start)} slot has already closed.${assessment?.windowMode === "uniform" ? " Please choose an upcoming start time." : ""}`,
      409
    );
  }

  // ── Gate: this candidate's own clock has already run out ─────────────────
  if (alreadyStarted) {
    const deadline = getCandidateDeadlineMs(candidate, durationMinutes);
    if (deadline !== null && nowMs >= deadline) {
      return jsonError("Your time is up. The assessment has been closed.", 409);
    }
  }

  // ── Domain ───────────────────────────────────────────────────────────────
  // Resolved and persisted even during the lobby, so candidates pre-select and
  // only ever receive their own domain plus the general questions.
  const requestedDomain = typeof body?.domain === "string" ? body.domain : "";
  const chosenDomain = pickDomain(
    (assessment?.domains as any[]) || [],
    requestedDomain || (candidate as any).assessmentDomain || ""
  );

  if (domains.length && !chosenDomain) {
    return jsonError("Please select your domain to start the assessment.", 400);
  }

  // Persist the slot (and domain) before serving anything, so a reload or a
  // second tab agrees with this one.
  if (!alreadyStarted || !(candidate as any).assessmentSlotStart) {
    const updates: Record<string, unknown> = { assessmentSlotStart: new Date(slot.startMs) };
    if (chosenDomain && (candidate as any).assessmentDomain !== chosenDomain.name) {
      updates.assessmentDomain = chosenDomain.name;
    }
    await ATSCandidate.findByIdAndUpdate(candidate._id, { $set: updates });
  }

  const deadlineMs = alreadyStarted
    ? getCandidateDeadlineMs(candidate, durationMinutes)
    : getAssessmentDeadlineMs(
        getAssessmentAnchorMs(slot, mode, new Date((candidate as any).assessmentStartedAt || now).getTime()),
        durationMinutes
      );

  // Proctoring is requested per assessment, but a candidate HR has exempted is
  // served an unproctored paper. `proctoring.enabled` still comes back so the
  // client knows the paper was meant to be proctored.
  const proctoringActive = proctoring.enabled && !proctoring.exempt;

  const responseBase = {
    windowMode: mode,
    durationMinutes,
    passScore,
    negativeMarking,
    negativeMarkingLabel,
    instructions,
    domains,
    proctoring: { ...proctoring, active: proctoringActive },
    domain: chosenDomain?.name || (candidate as any).assessmentDomain || null,
    slotStart: new Date(slot.startMs).toISOString(),
    startsAt: new Date(slot.startMs).toISOString(),
    lobbyOpensAt: new Date(info.lobbyOpensAt).toISOString(),
    endsAt: deadlineMs === null ? null : new Date(deadlineMs).toISOString(),
    slots: slots.map((s) => ({ start: s.start, startMs: new Date(s.startMs).toISOString() })),
  };

  // ── Lobby: questions are withheld until the start instant ─────────────────
  if (nowMs < slot.startMs) {
    return NextResponse.json({ ...responseBase, waiting: true, started: alreadyStarted, questions: [] });
  }

  // ── Exam ─────────────────────────────────────────────────────────────────
  if (!assessment) return jsonError("Assessment questions are not yet available.", 400);

  // Anything client-side can be skipped by calling this endpoint directly, so a
  // proctored sitting must be acknowledged before the paper is served. This is
  // not a security boundary — nothing on the client can be trusted — but it
  // closes the trivial bypass and leaves an auditable trace in the log.
  if (proctoringActive && !alreadyStarted && body?.proctoringAck !== true) {
    return jsonError(
      "This assessment is proctored. Complete the camera and microphone check first.",
      428
    );
  }

  const generalBank = (assessment.questions as any[]) || [];
  const domainBank = (chosenDomain?.questions || []) as any[];

  let paper: { served: any[]; key: any[] };
  let paperDomainName = chosenDomain?.name || (candidate as any).assessmentDomain || null;

  if (alreadyStarted) {
    // Replay the paper committed at the first start. Legacy attempts (started
    // before sampling existed) have no indices, so they serve the whole pool in
    // order — the behaviour they were started under.
    const persisted = (candidate as any).assessmentQuestionIndices;
    paper = buildServedAssessmentPaper(
      generalBank,
      domainBank,
      Array.isArray(persisted) && persisted.length ? persisted : null
    );
  } else {
    // Draw this candidate's sample and commit it as part of the start write.
    const servedIndices = resolveServedIndices({
      generalPool: generalBank.length,
      domainPool: domainBank.length,
      domainLimit: chosenDomain ? Number((chosenDomain as any).limit) || 0 : 0,
      questionLimit: Number((assessment as any).questionLimit) || 0,
      seed: `${candidate._id}:${job._id}:assessment`,
    });
    const seedCheck = buildServedAssessmentPaper(generalBank, domainBank, servedIndices);
    if (!seedCheck.served.length) return jsonError("Assessment questions are not yet available.", 400);
    paper = seedCheck;

    const fromStage = candidate.stage;
    const updates: any = {
      assessmentStartedAt: new Date(
        getAssessmentAnchorMs(slot, mode, new Date((candidate as any).assessmentStartedAt || now).getTime())
      ),
      assessmentSlotStart: new Date(slot.startMs),
      assessmentQuestionIndices: servedIndices,
    };
    if (chosenDomain) updates.assessmentDomain = chosenDomain.name;
    if (fromStage === "screening") updates.stage = "assessment";
    if (proctoringActive) {
      // Record that the paper was proctored, plus whatever the preflight could
      // actually see about the devices. Kept to facts: the browser cannot prove
      // a camera is really a camera, so nothing is claimed that it did not check.
      updates["assessmentProctoring.log"] = [
        ...(((candidate as any).assessmentProctoring?.log as any[]) || []),
        {
          at: new Date(),
          kind: "devices",
          detail: [
            proctoring.requireCamera ? "camera required" : "camera optional",
            proctoring.requireMic ? "microphone required" : "microphone optional",
            body?.devices === "ok" ? "both devices opened" : "device state unconfirmed",
            proctoring.requireFullscreen ? "fullscreen enforced" : "fullscreen not enforced",
          ].join(", "),
        },
      ].slice(-200);
    }

    // Guarded so two tabs cannot both claim the first start. The filter pins the
    // commit to an unstarted attempt: whoever lands first owns the paper.
    const won = await ATSCandidate.findOneAndUpdate(
      { _id: candidate._id, assessmentStartedAt: null, assessmentSubmittedAt: null },
      updates,
      { new: true }
    );

    if (won) {
      await ATSTimeline.create({
        candidate: candidate._id,
        job: job._id,
        action: "assessment-started",
        metadata: { jobTitle: job.title, ...(chosenDomain ? { domain: chosenDomain.name } : {}) },
        company: candidate.company,
      });

      if (fromStage === "screening") {
        await ATSTimeline.create({
          candidate: candidate._id,
          job: job._id,
          action: "stage-changed",
          metadata: {
            from: "screening",
            to: "assessment",
            reason: "Started online assessment",
            ...(chosenDomain ? { domain: chosenDomain.name } : {}),
          },
          company: candidate.company,
        });
      }
    } else {
      // Lost the race. Serve the paper the winner committed to, which may be
      // against a different domain than this request asked for. Answers are
      // keyed to the served positions, so both tabs must see the same list.
      const reread = await ATSCandidate.findById(candidate._id).select(
        "assessmentQuestionIndices assessmentDomain"
      );
      const committedIndices = (reread as any)?.assessmentQuestionIndices;
      if (Array.isArray(committedIndices) && committedIndices.length) {
        const committedDomain = pickDomain(
          (assessment?.domains as any[]) || [],
          (reread as any)?.assessmentDomain || ""
        );
        const committedPaper = buildServedAssessmentPaper(
          generalBank,
          (committedDomain?.questions || []) as any[],
          committedIndices
        );
        if (committedPaper.served.length) {
          paper = committedPaper;
          paperDomainName = committedDomain?.name || (reread as any)?.assessmentDomain || paperDomainName;
        }
      }
    }
  }

  if (!paper.served.length) return jsonError("Assessment questions are not yet available.", 400);

  const questions = paper.served.map((src: any, i: number) => ({
    index: i,
    text: src?.text ?? "",
    options: Array.isArray(src?.options) ? src.options : [],
    type: src?.type === "essay" ? "essay" : "mcq",
    marks: Math.max(0, Number(src?.marks) || 1),
    required: Boolean(src?.required),
  }));

  return NextResponse.json({
    ...responseBase,
    domain: paperDomainName,
    waiting: false,
    started: true,
    questions,
  });
}
