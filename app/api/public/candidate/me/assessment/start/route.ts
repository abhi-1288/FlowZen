import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { buildAssessmentQuestions, pickDomain } from "@/lib/assessment";
import {
  getAssessmentAnchorMs,
  getAssessmentDeadlineMs,
  getAssessmentPhase,
} from "@/lib/assessment-timing";
import {
  loadCandidateAssessment,
  resolveCandidateAssessmentWindow,
} from "@/lib/assessment-window";

/**
 * "09:00" -> "9:00 AM", for user-facing error text. UTC on purpose: slot times
 * are configured and displayed in UTC throughout the assessment flow.
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
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const job = await ATSJob.findById(candidate.job);
  if (!job || !job.assessment) return jsonError("Assessment is not available for this job.", 400);

  if (!["screening", "assessment"].includes(candidate.stage))
    return jsonError("You are not eligible for the assessment.", 400);
  if ((candidate as any).assessmentSubmittedAt)
    return jsonError("You have already submitted the assessment.", 400);

  const now = new Date();
  const nowMs = now.getTime();

  const assessment = await loadCandidateAssessment(job._id, candidate.company);
  const window = resolveCandidateAssessmentWindow(job, assessment);
  if (!window) return jsonError("Assessment is not scheduled yet.", 400);

  const { slots, mode, durationMinutes, instructions, passScore, negativeMarking, domains } = window;

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
    const deadline = getAssessmentDeadlineMs(
      new Date((candidate as any).assessmentStartedAt).getTime(),
      durationMinutes
    );
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
    ? getAssessmentDeadlineMs(new Date((candidate as any).assessmentStartedAt).getTime(), durationMinutes)
    : getAssessmentDeadlineMs(
        getAssessmentAnchorMs(slot, mode, new Date((candidate as any).assessmentStartedAt || now).getTime()),
        durationMinutes
      );

  const responseBase = {
    windowMode: mode,
    durationMinutes,
    passScore,
    negativeMarking,
    instructions,
    domains,
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

  const flatQuestions = buildAssessmentQuestions(
    (assessment.questions as any[]) || [],
    (chosenDomain?.questions as any[]) || []
  );
  if (!flatQuestions.length) return jsonError("Assessment questions are not yet available.", 400);

  if (!alreadyStarted) {
    const fromStage = candidate.stage;
    const updates: any = {
      assessmentStartedAt: new Date(
        getAssessmentAnchorMs(slot, mode, new Date((candidate as any).assessmentStartedAt || now).getTime())
      ),
      assessmentSlotStart: new Date(slot.startMs),
    };
    if (chosenDomain) updates.assessmentDomain = chosenDomain.name;
    if (fromStage === "screening") updates.stage = "assessment";
    await ATSCandidate.findByIdAndUpdate(candidate._id, updates);

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
  }

  const sourceQuestions = [
    ...(assessment.questions as any[]) || [],
    ...(chosenDomain?.questions as any[]) || [],
  ];
  const questions = flatQuestions.map((q, idx) => {
    const src = sourceQuestions[idx] || {};
    return {
      index: idx,
      text: src.text ?? "",
      options: Array.isArray(src.options) ? src.options : [],
      type: q.type,
      marks: q.marks,
      required: q.required,
    };
  });

  return NextResponse.json({ ...responseBase, waiting: false, started: true, questions });
}
