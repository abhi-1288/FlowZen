import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { assessmentInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";

// The cron fires once per day on Vercel (free tier /api/cron/assessment-day)
// and on demand in dev mode (/api/dev/assessment-day). Emails are sent to every
// candidate whose assessment is today or within the next 24 hours, so each one is
// caught by at least one invocation. The one-hour grace period in the past covers
// Vercel Hobby's scheduling precision (±59 min) so late runs still catch up.
const GRACE_MS = 60 * 60 * 1000;
const LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Sends the "Online Assessment Available" email to candidates whose assessment
 * is today or within the next 24 hours.
 *
 * `assessmentDate` is stored as an absolute UTC timestamp, so no timezone
 * conversion is needed here — an assessment scheduled for 09:00 IST is stored as
 * 03:30 UTC, and the UTC window below automatically aligns to IST.
 */
export async function sendAssessmentReminderEmails(): Promise<{ emailed: number; jobsChecked: number }> {
  await connectDb();

  const now = new Date();
  const windowStart = new Date(now.getTime() - GRACE_MS);
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MS);

  const jobs = await ATSJob.find({
    assessment: true,
    assessmentDate: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ["open", "draft"] },
  });

  let emailed = 0;

  for (const job of jobs) {
    const candidates = await ATSCandidate.find({
      job: job._id,
      stage: "assessment",
      company: job.company,
      assessmentInviteSentAt: null,
    });

    for (const candidate of candidates) {
      if ((candidate as any).assessmentSubmittedAt || (candidate as any).assessmentStartedAt) continue;

      try {
        const token = await resolveCandidatePortalToken(String(candidate._id));
        if (!token) continue;
        const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalLink = buildPortalLink(origin, token);
        const companyDoc = await Company.findById(job.company).select("name icon");
        const dateStr = new Date(job.assessmentDate!).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const emailBody = assessmentInvitationEmail({
          candidateName: candidate.firstName,
          jobTitle: job.title,
          dateStr,
          durationMinutes: (job as any).assessmentDurationMinutes,
          portalLink,
          company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon },
        });
        await sendMail({ to: candidate.email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
        await ATSCandidate.findByIdAndUpdate(candidate._id, { assessmentInviteSentAt: new Date() });
        emailed++;
      } catch (err) {
        console.error(`Assessment email failed for ${candidate._id}:`, err);
      }
    }
  }

  return { emailed, jobsChecked: jobs.length };
}