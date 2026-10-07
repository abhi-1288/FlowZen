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
 * The invitation runs on its own morning cron, well after HR saves the config,
 * so a candidate is never notified about a window that is not set up yet. It
 * re-runs safely: `mockTest.inviteSentAt` is the latch, so each candidate is
 * emailed at most once per window no matter how often this fires — saving new
 * start/end date-times clears the latch (see the mock-test route).
 */
export const MOCK_ELIGIBLE_STAGES = ["screening", "assessment"];

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
 * Invite every not-yet-invited candidate on one job to its mock test.
 *
 * Returns `unavailable` rather than throwing when the job has nothing to
 * invite for — the cron treats that as "nothing to do", and the on-demand
 * endpoint turns it into a message HR can read.
 */
async function inviteCandidatesForJob(job: any, nowMs: number): Promise<InviteOutcome> {
  const assessment = await ATSAssessment.findOne({ job: job._id }).select("mockTest");
  if (!assessment) return { status: "unavailable", reason: "not-configured" };

  const config = resolveMockTestConfig((assessment as any).mockTest);
  if (!config.enabled || !config.opensAt || !config.closesAt)
    return { status: "unavailable", reason: "not-configured" };

  // The job's assessment duration is the fallback for a mock that left its own
  // time limit blank ("inherit the assessment's limit"). Skipping it would
  // resolve the window to "unusable" and silently invite nobody, even though
  // every other call site honours the inherited duration.
  const window = resolveMockWindow(config, nowMs, job.assessmentDurationMinutes ?? null);
  // Nothing is worth emailing for outside the window: before it opens the
  // candidate cannot start, and after the last entry there is no point
  // inviting them to a sitting they can no longer finish.
  if (window.phase !== "open" && window.phase !== "scheduled")
    return { status: "unavailable", reason: "window" };

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
      const token = await resolveCandidatePortalToken(String(candidate._id));
      const portalLink = token ? buildPortalLink(origin, token) : undefined;
      if (!portalLink) {
        candidatesSkipped++;
        continue;
      }
      // The portal only opens the dedicated mock shell when both flags are
      // present, so the CTA has to carry them or it lands on the dashboard.
      const mockLink = `${portalLink}&test=true&mode=mock`;

      // A candidate who has already used every attempt gets no invitation.
      const used = ((candidate as any).mockTest?.attempts || []).filter((a: any) => a?.submittedAt).length;
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
    await ATSAssessment.updateOne(
      { job: job._id },
      { $set: { "mockTest.lastInvitedAt": invitedAt } }
    );
  }

  return { status: "done", emailed, candidatesSkipped, eligible, invitedAt };
}

/**
 * Sends the "Practice Mock Test Available" email to every candidate who is
 * currently eligible for a mock sitting.
 *
 * Eligibility deliberately includes `screening` and `assessment`, and does not
 * depend on the real assessment's state, so a candidate who has already sat the
 * real assessment is still offered the practice paper while the mock window is
 * open.
 */
export async function sendMockTestInvitationEmails(): Promise<{
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
    const outcome = await inviteCandidatesForJob(job, nowMs);
    if (outcome.status === "unavailable") continue;
    emailed += outcome.emailed;
    candidatesSkipped += outcome.candidatesSkipped;
  }

  return { emailed, jobsChecked: jobs.length, candidatesSkipped };
}

/** Same blast, scoped to one job, for HR's "Send invite emails now". */
export async function sendMockTestInvitationsForJob(jobId: string): Promise<InviteOutcome> {
  await connectDb();

  const job = await ATSJob.findOne({ _id: jobId, assessment: true, status: { $in: ["open", "draft"] } });
  if (!job) return { status: "unavailable", reason: "not-configured" };

  return inviteCandidatesForJob(job, Date.now());
}
