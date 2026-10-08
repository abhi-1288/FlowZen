import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAssessment } from "@/models/ATSAssessment";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { mockTestInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { resolveMockTestConfig, resolveMockWindow } from "@/lib/assessment-mock";
import { fmtJobDateTime as fmtDateTime, startOfKolkataDayMs } from "@/lib/date-utils";

/**
 * Stage list shared with the HR cohort counts and the portal's start gate.
 *
 * The reminders run on their own morning cron, well after HR saves the config,
 * so a candidate is never notified about a window that is not set up yet. Each
 * pass is latched, so a candidate is emailed at most once per window no matter
 * how often the cron fires — and moving the window clears the latches (see the
 * mock-test route), which re-arms a fresh pair of reminders.
 */
export const MOCK_ELIGIBLE_STAGES = ["screening", "assessment"];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which invite this run is.
 *   - `manual`     — HR pressed "Send invite emails now"; sent immediately.
 *   - `day-before` — automatic morning run the day before the window opens.
 *   - `same-day`   — automatic morning run on the day the window opens.
 */
type InviteKind = "manual" | "day-before" | "same-day";

type InviteOutcome =
  | { status: "unavailable"; reason: "not-configured" | "window" }
  | {
      status: "done";
      emailed: number;
      candidatesSkipped: number;
      /** Candidates still waiting for this kind of email when the run started. */
      eligible: number;
      invitedAt: Date | null;
    };

/** The per-candidate latch a given kind writes once it has emailed them. */
function latchField(kind: InviteKind): "inviteSentAt" | "sameDayReminderSentAt" {
  return kind === "same-day" ? "sameDayReminderSentAt" : "inviteSentAt";
}

/** Reminder copy stored on the email template, or undefined for an invite. */
function reminderCopy(kind: InviteKind): "day-before" | "same-day" | undefined {
  return kind === "manual" ? undefined : kind;
}

/**
 * Whether this kind of run should send for a window, right now.
 *
 * The day-before pass fires only when the window opens on *tomorrow's* IST day,
 * so a same-day window is never labelled "tomorrow". The same-day pass fires
 * while the window has not yet closed, so a candidate who can still sit the
 * paper gets a morning nudge even if it opened earlier that day.
 */
function kindMatchesWindow(
  kind: InviteKind,
  window: { phase: string; opensAt: number | null; closesAt: number | null },
  nowMs: number
): boolean {
  if (kind === "manual") return window.phase === "open" || window.phase === "scheduled";
  if (window.opensAt === null || window.closesAt === null) return false;

  if (kind === "same-day") {
    return nowMs < window.closesAt && startOfKolkataDayMs(window.opensAt) === startOfKolkataDayMs(nowMs);
  }

  // day-before: opens on tomorrow's IST day, and has not opened yet.
  return window.opensAt > nowMs && startOfKolkataDayMs(window.opensAt) === startOfKolkataDayMs(nowMs + DAY_MS);
}

/**
 * Send one kind of mock-test email for one job.
 *
 * Returns `unavailable` rather than throwing when the job has nothing to send
 * for — the cron treats that as "nothing to do", and the on-demand endpoint
 * turns it into a message HR can read.
 */
async function inviteCandidatesForJob(job: any, nowMs: number, kind: InviteKind): Promise<InviteOutcome> {
  const assessment = await ATSAssessment.findOne({ job: job._id }).select("mockTest");
  if (!assessment) return { status: "unavailable", reason: "not-configured" };

  const config = resolveMockTestConfig((assessment as any).mockTest);
  if (!config.enabled || !config.opensAt || !config.closesAt)
    return { status: "unavailable", reason: "not-configured" };

  // The job's assessment duration is the fallback for a mock that left its own
  // time limit blank ("inherit the assessment's limit"). Skipping it would
  // resolve the window to "unusable" and silently send nobody, even though
  // every other call site honours the inherited duration.
  const window = resolveMockWindow(config, nowMs, job.assessmentDurationMinutes ?? null);
  if (!kindMatchesWindow(kind, window, nowMs)) return { status: "unavailable", reason: "window" };

  const latch = latchField(kind);
  const candidates = await ATSCandidate.find({
    job: job._id,
    stage: { $in: MOCK_ELIGIBLE_STAGES },
    [`mockTest.${latch}`]: null,
  });

  const eligible = candidates.length;
  if (eligible === 0) {
    return { status: "done", emailed: 0, candidatesSkipped: 0, eligible, invitedAt: config.lastInvitedAt };
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const companyDoc = await Company.findById(job.company).select("name icon");
  const startLabel = fmtDateTime(new Date(window.opensAt as number).toISOString());
  const endLabel = fmtDateTime(new Date(window.closesAt as number).toISOString());

  let emailed = 0;
  let candidatesSkipped = 0;

  for (const candidate of candidates) {
    try {
      // A candidate who has already used every attempt cannot sit another, so a
      // reminder would be noise. The manual invite keeps the old behaviour of
      // explaining the exhausted attempts instead of dropping them silently.
      const used = ((candidate as any).mockTest?.attempts || []).filter((a: any) => a?.submittedAt).length;
      if (kind !== "manual" && used >= config.maxAttempts) {
        candidatesSkipped++;
        continue;
      }

      const token = await resolveCandidatePortalToken(String(candidate._id));
      const portalLink = token ? buildPortalLink(origin, token) : undefined;
      if (!portalLink) {
        candidatesSkipped++;
        continue;
      }
      // The portal only opens the dedicated mock shell when both flags are
      // present, so the CTA has to carry them or it lands on the dashboard.
      const mockLink = `${portalLink}&test=true&mode=mock`;

      const attemptNote =
        used >= config.maxAttempts
          ? `You have used all ${config.maxAttempts} attempt${config.maxAttempts > 1 ? "s" : ""} for this mock test.`
          : undefined;

      const emailBody = mockTestInvitationEmail({
        candidateName: candidate.firstName,
        jobTitle: job.title,
        startLabel,
        endLabel,
        durationMinutes: window.durationMinutes,
        maxAttempts: config.maxAttempts,
        attemptNote,
        portalLink: mockLink,
        company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon },
        reminder: reminderCopy(kind),
      });
      await sendMail({ to: candidate.email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
      await ATSCandidate.findByIdAndUpdate(candidate._id, { [`mockTest.${latch}`]: new Date() });
      emailed++;
    } catch (err) {
      // One bad address must not stop the rest of the run; the latch stays
      // unset so the next run retries this candidate.
      console.error(`Mock test email failed for ${candidate._id}:`, err);
      candidatesSkipped++;
    }
  }

  // `lastInvitedAt` is what HR's modal reads back, so it only moves when the
  // run actually reached somebody.
  let invitedAt: Date | null = config.lastInvitedAt;
  if (emailed > 0) {
    invitedAt = new Date();
    await ATSAssessment.updateOne({ job: job._id }, { $set: { "mockTest.lastInvitedAt": invitedAt } });
  }

  return { status: "done", emailed, candidatesSkipped, eligible, invitedAt };
}

/**
 * The automatic morning run for every job: the day-before reminder and the
 * same-day reminder, each latched separately so a window can produce both.
 */
export async function sendMockTestReminderEmails(): Promise<{
  emailed: number;
  jobsChecked: number;
  candidatesSkipped: number;
}> {
  await connectDb();

  const nowMs = Date.now();
  const jobs = await ATSJob.find({ assessment: true, status: { $in: ["open", "draft"] } });

  let emailed = 0;
  let candidatesSkipped = 0;

  for (const job of jobs) {
    for (const kind of ["day-before", "same-day"] as const) {
      const outcome = await inviteCandidatesForJob(job, nowMs, kind);
      if (outcome.status === "unavailable") continue;
      emailed += outcome.emailed;
      candidatesSkipped += outcome.candidatesSkipped;
    }
  }

  return { emailed, jobsChecked: jobs.length, candidatesSkipped };
}

/** Immediate blast for HR's "Send invite emails now", scoped to one job. */
export async function sendMockTestInvitationsForJob(jobId: string): Promise<InviteOutcome> {
  await connectDb();

  const job = await ATSJob.findOne({ _id: jobId, assessment: true, status: { $in: ["open", "draft"] } });
  if (!job) return { status: "unavailable", reason: "not-configured" };

  return inviteCandidatesForJob(job, Date.now(), "manual");
}
