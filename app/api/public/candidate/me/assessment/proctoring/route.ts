import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { jsonError } from "@/lib/api";
import { findCandidateByToken } from "@/lib/candidate-portal";
import { getCandidateDeadlineMs } from "@/lib/assessment";
import {
  MAX_PROCTORING_LOG_ENTRIES,
  describeGrace,
  formatDb,
  grantGrace,
  resolveProctoringConfig,
  trimProctoringLog,
} from "@/lib/assessment-proctoring";
import { loadCandidateAssessment } from "@/lib/assessment-window";
import { isMockMode, mockPrefix, resolveMockSitting } from "@/lib/assessment-mock-attempt";

/**
 * Proctoring events from a sitting candidate.
 *
 * The client cannot be trusted, and none of this is a security boundary: a
 * motivated candidate can post whatever they like. What the server does
 * guarantee is that the numbers cannot be inflated by lying about elapsed time,
 * because every duration here is measured from a server-side timestamp rather
 * than taken from the request.
 *
 *   - `pause`  stamps `pausedAt` once, server side.
 *   - `resume` computes the gap from that stamp and adds the capped remainder to
 *             the grace total, which feeds the deadline.
 *   - `noise` / `face` / `screen-share` / `violation` only append a log line and
 *             bump a counter.
 *
 * An HR exemption short-circuits everything: an exempt candidate is never
 * proctored, and events from one are ignored rather than logged.
 *
 * ── Why this handler is shared rather than forked ───────────────────────────
 * This is the one endpoint where a second copy would be a liability: the grace
 * cap, the idempotent pause stamp and the submitted-write guard are what stop a
 * candidate buying themselves time, and two implementations of that would drift.
 * The only thing that actually differs between a real sitting and a mock is
 * *where* the state lives, so the mode is reduced to a field prefix plus the
 * attempt's timestamps, and every branch below runs identically for both.
 */

type Event = "pause" | "resume" | "noise" | "face" | "screen-share" | "violation" | "note";

const EVENTS: Event[] = ["pause", "resume", "noise", "face", "screen-share", "violation", "note"];

function cleanDetail(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return jsonError("Token is required.", 400);

  const body = await request.json().catch(() => ({}));
  const event = String(body?.event ?? "") as Event;
  if (!EVENTS.includes(event)) return jsonError("Unknown proctoring event.", 400);

  await connectDb();

  const candidate = await findCandidateByToken(token);
  if (!candidate) return jsonError("Invalid or expired link.", 401);

  const mock = isMockMode(searchParams);

  const job = await ATSJob.findById(candidate.job).select("assessment assessmentDurationMinutes");
  if (!job?.assessment) return jsonError("Assessment not available.", 400);

  // Everything the two modes differ by, resolved up front: which sub-document
  // holds the proctoring state, whether there is a sitting to proctor, how long
  // it runs for, and whether HR has waived it.
  //
  // Note that a mock reads the *assessment's* proctoring config, not its own.
  // The mock has no proctoring settings of its own precisely so that it cannot
  // drift from the real paper: if the exam is proctored, the practice paper is
  // proctored the same way.
  let prefix: string;
  let startedAt: Date | null = null;
  let durationMinutes: number | null;
  let exempt: boolean;
  let activeIndex = -1;
  let mockProctoring: Record<string, any> = {};
  let proctoringSource: unknown = null;

  if (mock) {
    const assessment = await ATSAssessment.findOne({ job: candidate.job, company: candidate.company }).lean();
    if (!assessment) return jsonError("Mock test not available.", 400);

    const sitting = resolveMockSitting(
      candidate,
      (assessment as any).mockTest,
      job.assessmentDurationMinutes ?? null
    );
    // Deliberately no stage check: a recruiter can move a candidate to the next
    // stage while they are still sitting a mock, and the paper must not vanish
    // underneath them because of it.
    if (sitting.activeIndex === null || !sitting.active) {
      return jsonError("The mock test has not started.", 400);
    }

    activeIndex = sitting.activeIndex;
    mockProctoring = (sitting.active.proctoring ?? {}) as Record<string, any>;
    prefix = `${mockPrefix(activeIndex)}.proctoring`;
    startedAt = new Date(sitting.active.startedAt);
    durationMinutes = sitting.window.durationMinutes;
    exempt = mockProctoring.exempt === true;
    proctoringSource = (assessment as any).proctoring;
  } else {
    // The same guard answers/route.ts uses: once the paper is submitted there is
    // nothing to proctor and no clock to extend.
    if (candidate.stage !== "assessment") return jsonError("You are not in the assessment stage.", 400);
    if ((candidate as any).assessmentSubmittedAt) return jsonError("Already submitted.", 400);
    if (!(candidate as any).assessmentStartedAt) {
      return jsonError("The assessment has not started.", 400);
    }

    prefix = "assessmentProctoring";
    startedAt = (candidate as any).assessmentStartedAt;
    durationMinutes = job.assessmentDurationMinutes ?? null;
    exempt = ((candidate as any).assessmentProctoring ?? {}).exempt === true;

    const assessment = await loadCandidateAssessment(candidate.job, candidate.company);
    proctoringSource = (assessment as any)?.proctoring;
  }

  const proctoring = resolveProctoringConfig(proctoringSource);

  const current = (mock ? mockProctoring : ((candidate as any).assessmentProctoring ?? {})) as Record<string, any>;
  if (exempt || !proctoring.enabled) {
    return NextResponse.json({ ignored: true, reason: "not-proctored" });
  }

  const now = new Date();
  const log = trimProctoringLog([
    ...((current.log as any[]) || []),
    { at: now, kind: event, detail: "" },
  ]);
  const entry = log[log.length - 1] as { at: Date; kind: string; detail: string };
  const update: Record<string, unknown> = { [`${prefix}.log`]: log };
  let deadline: number | null = null;

  switch (event) {
    case "pause": {
      // Idempotent: a second pause while already paused must not move the
      // stamp, or the time between the two would be silently discarded.
      if (!current.pausedAt) {
        update[`${prefix}.pausedAt`] = now;
        entry.detail = cleanDetail(body?.reason) || "left fullscreen or the window lost focus";
      } else {
        entry.detail = "interruption already open";
      }
      update[`${prefix}.violations`] = Math.max(0, Number(current.violations) || 0) + 1;
      break;
    }
    case "resume": {
      if (!current.pausedAt) {
        entry.detail = "resumed with no interruption open";
        break;
      }
      const blockedMs = now.getTime() - new Date(current.pausedAt).getTime();
      const { granted, total, capped } = grantGrace(Number(current.graceMs) || 0, blockedMs);
      update[`${prefix}.pausedAt`] = null;
      update[`${prefix}.graceMs`] = total;
      entry.detail = describeGrace(granted, capped);
      if (capped) {
        // Make the cap visible rather than letting the candidate believe the
        // timer gave them everything they were owed.
        log.push({ at: now, kind: "grace-capped", detail: "extra time capped; the clock stopped extending" });
        update[`${prefix}.log`] = trimProctoringLog(log);
      }
      break;
    }
    case "noise": {
      const db = Number(body?.db);
      const peak = Number.isFinite(db) ? db : null;
      update[`${prefix}.noiseWarnings`] = Math.max(0, Number(current.noiseWarnings) || 0) + 1;
      if (peak !== null) {
        update[`${prefix}.peakNoiseDb`] = Math.max(
          Number(current.peakNoiseDb) || -100,
          peak
        );
        entry.detail = `ambient noise ${formatDb(peak)} (limit ${formatDb(proctoring.noiseThresholdDb)})`;
      } else {
        entry.detail = `ambient noise above ${formatDb(proctoring.noiseThresholdDb)}`;
      }
      break;
    }
    case "face": {
      const count = Math.max(2, Math.round(Number(body?.count) || 0));
      update[`${prefix}.multiFaceEvents`] = Math.max(0, Number(current.multiFaceEvents) || 0) + 1;
      entry.detail = `${count} faces detected at once`;
      break;
    }
    case "screen-share": {
      update[`${prefix}.screenShareAttempts`] = Math.max(0, Number(current.screenShareAttempts) || 0) + 1;
      entry.detail = cleanDetail(body?.detail) || "screen sharing or casting was detected";
      break;
    }
    case "violation": {
      update[`${prefix}.violations`] = Math.max(0, Number(current.violations) || 0) + 1;
      entry.detail = cleanDetail(body?.detail) || "focus or fullscreen rule broken";
      break;
    }
    case "note": {
      entry.detail = cleanDetail(body?.detail) || "note";
      break;
    }
  }

  if (log.length > MAX_PROCTORING_LOG_ENTRIES + 2) {
    update[`${prefix}.log`] = trimProctoringLog(log);
  }

  // The same guard the answers endpoint uses: never write after submission even
  // if a request was already in flight.
  const written = await ATSCandidate.findOneAndUpdate(
    mock
      ? { _id: candidate._id, [`${mockPrefix(activeIndex)}.submittedAt`]: null }
      : { _id: candidate._id, assessmentSubmittedAt: null },
    { $set: update },
    { new: false }
  );
  if (!written) return jsonError("Already submitted.", 409);

  const after = ((mock
    ? ((written as any).mockTest?.attempts?.[activeIndex]?.proctoring ?? {})
    : (written as any).assessmentProctoring ?? {}) as Record<string, any>);

  if (mock) {
    const started = new Date(startedAt as Date).getTime();
    deadline =
      Number.isFinite(started) && Number(durationMinutes) > 0
        ? started + Math.round(Number(durationMinutes)) * 60_000 + Math.max(0, Number(after.graceMs) || 0)
        : null;
  } else {
    deadline = getCandidateDeadlineMs(
      { assessmentStartedAt: startedAt, assessmentProctoring: after },
      durationMinutes
    );
  }

  return NextResponse.json({
    ok: true,
    mode: mock ? "mock" : "assessment",
    graceMs: after.graceMs ?? 0,
    extensionMs: after.extensionMs ?? 0,
    violations: after.violations ?? 0,
    noiseWarnings: after.noiseWarnings ?? 0,
    graceCapped: Number(after.graceMs) > 0 && deadline != null,
    endsAt: deadline === null ? null : new Date(deadline).toISOString(),
  });
}
