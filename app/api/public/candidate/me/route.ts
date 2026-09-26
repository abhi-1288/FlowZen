import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSOffer } from "@/models/ATSOffer";
import { ATSInterview } from "@/models/ATSInterview";
import { ATSTimeline } from "@/models/ATSTimeline";
import { jsonError, serializeDoc } from "@/lib/api";
import { createUniqueGuestPassCode, findCandidateByToken } from "@/lib/candidate-portal";
import { normalizeVideoProvider, videoProviderLabel } from "@/lib/interview-provider";
import { getAssessmentDeadlineMs, getAssessmentPhase } from "@/lib/assessment-timing";
import { loadCandidateAssessment, resolveCandidateAssessmentWindow } from "@/lib/assessment-window";
import { finalizeCandidateIfExpired } from "@/lib/assessment-auto-submit";
import { INTERVIEW_JOINABLE_STATUSES } from "@/lib/interview-timing";
import {
  CANDIDATE_VISIBLE_TIMELINE_ACTIONS,
  publicCandidateProjection,
  publicInterviewProjection,
  sanitizeTimelineEntry,
} from "@/lib/candidate-visibility";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  await connectDb();

  let candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  // Close out an attempt whose clock has run out. This is the hot path for the
  // background auto-submit: it fires on the candidate's own next page load, so
  // their autosaved answers get graded without waiting for the nightly cron.
  if ((candidate as any).assessmentStartedAt && !(candidate as any).assessmentSubmittedAt) {
    try {
      const closedOut = await finalizeCandidateIfExpired(candidate._id);
      // The finalizer writes to the database, so the in-memory document is now
      // stale. Re-read it, otherwise this response would still report the attempt
      // as in progress right after it was graded.
      if (closedOut) {
        const refreshed = await ATSCandidate.findById(candidate._id);
        if (refreshed) candidate = refreshed as any;
      }
    } catch (err) {
      console.error("Assessment auto-submit (scoped) failed:", err);
    }
  }

  const more = await ATSCandidate.findById(candidate._id)
    .populate("job", "title department location employmentType salaryRangeMin salaryRangeMax salaryType currency description requiredSkills assessment assessmentDate assessmentDurationMinutes editApplicationsEnabled")
    .populate("company", "name icon primaryColor stageOrder");

  if (!candidate) return jsonError("Invalid or expired link.", 401);

  // Filtered in the query, not in the UI, so internal entries never leave the
  // server at all. `note-added` in particular carries HR's notes and — because
  // the ATS scorer writes its score and reasoning into one — would otherwise tell
  // the candidate exactly why they were filtered.
  const timeline = await ATSTimeline.find({
    candidate: candidate._id,
    action: { $in: [...CANDIDATE_VISIBLE_TIMELINE_ACTIONS] },
  })
    .sort({ createdAt: -1 });

  // Everything the candidate can still join. Restricting this to "scheduled"
  // hid the interview from the portal the instant either side joined, because
  // the room endpoint flips the status to "in-progress" on first join — so the
  // candidate lost the ability to rejoin while the interviewer was still running
  // the interview. Feedback submission is what sets "completed", and that is the
  // point at which rejoining should stop being offered.
  const interviews = await ATSInterview.find({
    candidate: candidate._id,
    status: { $in: [...INTERVIEW_JOINABLE_STATUSES] },
  })
    .sort({ scheduledAt: 1 })
    .populate("interviewer", "name companyIdentityCode");

  // Lazy backfill: ensure in-person scheduled interviews carry a scannable guest
  // pass code so existing candidates' ID cards and QR verifications work.
  const companyId = String(candidate.company);
  for (const int of interviews as any[]) {
    if (!int.passCode && !int.meetingLink && int.location) {
      const code = await createUniqueGuestPassCode(companyId);
      int.passCode = code;
      await ATSInterview.updateOne({ _id: int._id }, { $set: { passCode: code } });
      await ATSTimeline.create({
        candidate: candidate._id,
        job: int.job,
        action: "note-added",
        metadata: { text: `Guest pass code generated: ${code}` },
        company: candidate.company,
      });
    }
  }

  const offer = await ATSOffer.findOne({ candidate: candidate._id, company: candidate.company })
    .populate("job", "title")
    .sort({ createdAt: -1 });

  // Assessment info for portal
  const jobDoc = (more as any)?.job;
  const now = new Date();
  const nowMs = now.getTime();
  let assessmentPayload: any = null;
  if (jobDoc && jobDoc.assessment) {
    const assessmentDoc = await loadCandidateAssessment(jobDoc._id, candidate.company);
    const window = resolveCandidateAssessmentWindow(jobDoc, assessmentDoc);

    const isSubmitted = Boolean((candidate as any).assessmentSubmittedAt);
    // A candidate moved back to "screening" by HR should be able to restart,
    // even if a stale assessmentStartedAt flag remains.
    const isStarted = Boolean((candidate as any).assessmentStartedAt) && !isSubmitted && candidate.stage === "assessment";
    const startedAt = (candidate as any).assessmentStartedAt ? new Date((candidate as any).assessmentStartedAt) : null;
    const storedSlotMs = (candidate as any).assessmentSlotStart
      ? new Date((candidate as any).assessmentSlotStart).getTime()
      : null;

    // Results stay hidden until HR reviews the assessment outcomes.
    const resultPublished = Boolean((candidate as any).assessmentResultPublishedAt);

    if (window) {
      const { slots, mode, durationMinutes, instructions, passScore, negativeMarking, domains } = window;
      const info = getAssessmentPhase(slots, mode, storedSlotMs, nowMs);

      const durationMin = durationMinutes;
      // Once started the deadline is fixed by the anchored clock; before that
      // the slot's own end is only meaningful in uniform mode.
      const endsAt = isStarted
        ? getAssessmentDeadlineMs(startedAt!.getTime(), durationMin)
        : mode === "uniform"
          ? getAssessmentDeadlineMs(info.startsAt, durationMin)
          : null;

      const stageOk = ["screening", "assessment"].includes(candidate.stage);
      const expiredForThisCandidate = isStarted && endsAt !== null && nowMs >= endsAt;
      const phase: "closed" | "lobby" | "open" | "expired" = expiredForThisCandidate
        ? "expired"
        : isStarted
          ? "open"
          : info.phase;

      assessmentPayload = {
        enabled: true,
        windowMode: mode,
        instructions,
        durationMinutes: durationMin,
        passScore,
        negativeMarking,
        domains,
        domain: (candidate as any).assessmentDomain || "",
        answerKeyPublished: (assessmentDoc as any)?.answerKeyPublished ?? false,
        resultPublished,
        stage: candidate.stage,
        startedAt: (candidate as any).assessmentStartedAt || null,
        slotStart: (candidate as any).assessmentSlotStart
          ? new Date((candidate as any).assessmentSlotStart).toISOString()
          : info.startsAt
            ? new Date(info.startsAt).toISOString()
            : null,
        submittedAt: (candidate as any).assessmentSubmittedAt || null,
        score: resultPublished ? (candidate as any).assessmentScore ?? null : null,
        rawMarks: resultPublished ? (candidate as any).assessmentRawMarks ?? null : null,
        maxMarks: resultPublished ? (candidate as any).assessmentMaxMarks ?? null : null,
        status: resultPublished ? (candidate as any).assessmentStatus || "pending" : "pending",
        rejectionNote: resultPublished ? (candidate as any).assessmentRejectionNote || "" : "",
        phase,
        lobbyOpensAt: info.lobbyOpensAt ? new Date(info.lobbyOpensAt).toISOString() : null,
        startsAt: info.startsAt ? new Date(info.startsAt).toISOString() : null,
        lastEntryAt: info.lastEntryAt ? new Date(info.lastEntryAt).toISOString() : null,
        untilLobbyMs: info.untilLobbyMs,
        untilStartMs: info.untilStartMs,
        endsAt: endsAt === null ? null : new Date(endsAt).toISOString(),
        slots: slots.map((s) => ({ start: s.start, startMs: new Date(s.startMs).toISOString() })),
        // The chosen slot must still be open, otherwise the button would offer a
        // start whose exam has already finished.
        eligibleToStart:
          stageOk &&
          !isStarted &&
          !isSubmitted &&
          (info.phase === "lobby" || info.phase === "open") &&
          Boolean(info.slot) &&
          info.slot!.endMs > nowMs,
        submittable: isStarted,
      };
    } else {
      assessmentPayload = {
        enabled: true,
        windowMode: "relief",
        instructions: "",
        durationMinutes: jobDoc.assessmentDurationMinutes ?? null,
        passScore: (assessmentDoc as any)?.passScore ?? 50,
        negativeMarking: (assessmentDoc as any)?.negativeMarking ?? 0,
        domains: [],
        domain: (candidate as any).assessmentDomain || "",
        answerKeyPublished: (assessmentDoc as any)?.answerKeyPublished ?? false,
        resultPublished,
        stage: candidate.stage,
        startedAt: (candidate as any).assessmentStartedAt || null,
        slotStart: null,
        submittedAt: (candidate as any).assessmentSubmittedAt || null,
        score: resultPublished ? (candidate as any).assessmentScore ?? null : null,
        rawMarks: resultPublished ? (candidate as any).assessmentRawMarks ?? null : null,
        maxMarks: resultPublished ? (candidate as any).assessmentMaxMarks ?? null : null,
        status: "pending",
        rejectionNote: "",
        phase: "closed",
        lobbyOpensAt: null,
        startsAt: null,
        lastEntryAt: null,
        untilLobbyMs: 0,
        untilStartMs: 0,
        endsAt: null,
        slots: [],
        eligibleToStart: false,
        submittable: isStarted,
      };
    }
  }

  const defaultStageOrder = ["applied", "screening", "assessment", "technical-interview", "manager-round", "hr-round", "offer", "joined"];
  const companyStageOrder = Array.isArray((more as any)?.company?.stageOrder) && (more as any).company.stageOrder.length
    ? (more as any).company.stageOrder
    : [];

  return NextResponse.json({
    // Projected rather than serialized wholesale: the full document ships the
    // ATS score and the model's rejection reasoning, the internal rating, current
    // CTC and the internal notes array. See lib/candidate-visibility.ts.
    candidate: publicCandidateProjection(serializeDoc(more ?? candidate)),
    timeline: timeline
      .map((entry: any) =>
        sanitizeTimelineEntry(
          serializeDoc(entry) as { action: string; metadata?: Record<string, unknown> | null }
        )
      )
      .filter((entry: unknown) => entry !== null),
    interviews: interviews.map((i: any) => ({
      // Drops `feedback`, which holds the verdict, the four ratings and up to
      // 2000 characters of the interviewer's private notes.
      ...publicInterviewProjection(serializeDoc(i)),
      videoProvider: i.meetingType === "in-person" ? "flowzen" : normalizeVideoProvider(i.videoProvider) ?? "flowzen",
      videoProviderLabel: videoProviderLabel(i.videoProvider),
    })),
    offer: offer ? serializeDoc(offer) : null,
    assessment: assessmentPayload,
    stageOrder: companyStageOrder.length ? companyStageOrder : defaultStageOrder,
  });
}
