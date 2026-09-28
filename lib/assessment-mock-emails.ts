import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { ATSAssessment } from "@/models/ATSAssessment";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { mockTestInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { resolveMockTestConfig, resolveMockWindow } from "@/lib/assessment-mock";
import { fmtJobDateTime as fmtDateTime, utcWallClockNow } from "@/lib/date-utils";

// The mock invitation runs on its own morning cron, well after HR saves the
// config, so a candidate is never notified about a window that is not set up
// yet. It re-runs safely: `mockTest.inviteSentAt` is the latch, so each
// candidate is emailed at most once per config no matter how often this fires.
const MOCK_ELIGIBLE_STAGES = ["screening", "assessment"];

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

  const nowMs = utcWallClockNow();
  const jobs = await ATSJob.find({ assessment: true, status: { $in: ["open", "draft"] } });

  let emailed = 0;
  let candidatesSkipped = 0;

  for (const job of jobs) {
    const assessment = await ATSAssessment.findOne({ job: job._id }).select("mockTest");
    if (!assessment) continue;

    const config = resolveMockTestConfig((assessment as any).mockTest);
    if (!config.enabled || !config.opensAt || !config.closesAt) continue;

    const window = resolveMockWindow(config, nowMs);
    // Nothing is worth emailing for outside the window: before it opens the
    // candidate cannot start, and after the last entry there is no point
    // inviting them to a sitting they can no longer finish.
    if (window.phase !== "open" && window.phase !== "scheduled") continue;

    const candidates = await ATSCandidate.find({
      job: job._id,
      stage: { $in: MOCK_ELIGIBLE_STAGES },
      "mockTest.inviteSentAt": null,
    });

    for (const candidate of candidates) {
      try {
        const token = await resolveCandidatePortalToken(String(candidate._id));
        if (!token) continue;
        const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalLink = buildPortalLink(origin, token);
        const companyDoc = await Company.findById(job.company).select("name icon");

        const windowLabel = `${fmtDateTime(config.opensAt.toISOString())}${config.closesAt ? ` – ${fmtDateTime(config.closesAt.toISOString())}` : ""}`;

        // A candidate who has already used every attempt gets no invitation.
        const used = ((candidate as any).mockTest?.attempts || []).filter((a: any) => a?.submittedAt).length;
        const attemptNote =
          used >= config.maxAttempts
            ? `You have used all ${config.maxAttempts} attempt${config.maxAttempts > 1 ? "s" : ""} for this mock test.`
            : undefined;

        const emailBody = mockTestInvitationEmail({
          candidateName: candidate.firstName,
          jobTitle: job.title,
          windowLabel,
          durationMinutes: config.durationMinutes,
          maxAttempts: config.maxAttempts,
          attemptNote,
          portalLink,
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
  }

  return { emailed, jobsChecked: jobs.length, candidatesSkipped };
}
