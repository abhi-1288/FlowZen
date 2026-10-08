import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAssessment } from "@/models/ATSAssessment";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { mockTestInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { resolveMockTestConfig, resolveMockWindow } from "@/lib/assessment-mock";
import { fmtJobDateTime as fmtDateTime } from "@/lib/date-utils";

/**
 * Stage list shared with the HR cohort counts and the portal's start gate.
 *
 * Like the real-assessment invite, the automatic mock email fires on the daily
 * morning cron and only while the window opens within the next 24 hours, so a
 * candidate is never notified about a window that is not set up yet. The run is
 * latched (`mockTest.inviteSentAt`), so each candidate is emailed at most once
 * per window no matter how often the cron fires — saving new start/end
 * date-times clears the latch (see the mock-test route).
 */
export const MOCK_ELIGIBLE_STAGES = ["screening", "assessment"];

// Mirrors the real-assessment invite (lib/assessment-day-emails): a once-a-day
// run cannot hit an exact instant, so mail goes out while the window opens today
// or within the next 24 hours. The one-hour grace in the past covers Vercel
// Hobby's scheduling precision (±59 min) so a late run still catches up.
const GRACE_MS = 60 * 60 * 1000;
const LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Which invite this run is.
 *   - `auto`   — the daily cron; only mails while the window opens within 24h.
 *   - `manual` — HR pressed "Send invite emails now"; sent immediately.
 */
type InviteKind = "manual" | "auto";

type InviteOutcome =
  | { status: "unavailable"; reason: "not-configured" | "window" }
  | {
      status: "done";
      emailed: number;
      candidatesSkipped: number;
      /** Candidates still waiting for an invitation when this run started. */
      eligible: number;
      invitedAt: Date | null;
    };

/**
 * Whether this run should send for a window, right now.
 *
 * The manual blast goes out whenever the window is scheduled or open. The
 * automatic run is stricter — it only mails while the window opens within the
 * next 24 hours — matching the assessment invite so HR is never surprised by an
 * early email.
 */
function matchesWindow(
  kind: InviteKind,
  window: { phase: string; opensAt: number | null; closesAt: number | null },
  nowMs: number
): boolean {
  if (window.phase !== "scheduled" && window.phase !== "open") return false;
  if (kind === "manual") return true;
  if (window.opensAt === null) return false;
  return window.opensAt >= nowMs - GRACE_MS && window.opensAt <= nowMs + LOOKAHEAD_MS;
}

/**
 * Send the mock-test email for one job.
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
  if (!matchesWindow(kind, window, nowMs)) return { status: "unavailable", reason: "window" };

  const candidates = await ATSCandidate.find({
    job: job._id,
    stage: { $in: MOCK_ELIGIBLE_STAGES },
    "mockTest.inviteSentAt": null,
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
      // A candidate who has already used every attempt cannot sit another, so an
      // automatic reminder would be noise. The manual invite keeps the old
      // behaviour of explaining the exhausted attempts instead of dropping them.
      const used = ((candidate as any).mockTest?.attempts || []).filter((a: any) => a?.submittedAt).length;
      if (kind === "auto" && used >= config.maxAttempts) {
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
      });
      await sendMail({ to: candidate.email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
      await ATSCandidate.findByIdAndUpdate(candidate._id, { "mockTest.inviteSentAt": new Date() });
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
 * Sends the "Practice Mock Test Available" email to every candidate who is
 * currently eligible for a mock sitting that opens within the next 24 hours.
 *
 * Eligibility deliberately includes `screening` and `assessment`, and does not
 * depend on the real assessment's state, so a candidate who has already sat the
 * real assessment is still offered the practice paper while the mock window is
 * open.
 */
export async function sendMockTestReminderEmails(): Promise<{
  emailed: number;
  jobsChecked: number;
  candidatesSkipped: number;
}> {
  await connectDb();

  const nowMs = Date.now();
  // No job-status filter: a closed posting still has candidates in screening
  // or assessment, and the mock window HR configured is what decides who gets
  // mailed — not whether the job is still taking applications.
  const jobs = await ATSJob.find({ assessment: true });

  let emailed = 0;
  let candidatesSkipped = 0;

  for (const job of jobs) {
    const outcome = await inviteCandidatesForJob(job, nowMs, "auto");
    if (outcome.status === "unavailable") continue;
    emailed += outcome.emailed;
    candidatesSkipped += outcome.candidatesSkipped;
  }

  return { emailed, jobsChecked: jobs.length, candidatesSkipped };
}

/** Immediate blast for HR's "Send invite emails now", scoped to one job. */
export async function sendMockTestInvitationsForJob(jobId: string): Promise<InviteOutcome> {
  await connectDb();

  const job = await ATSJob.findOne({ _id: jobId, assessment: true });
  if (!job) return { status: "unavailable", reason: "not-configured" };

  return inviteCandidatesForJob(job, Date.now(), "manual");
}
