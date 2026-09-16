import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { assessmentInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";

// The cron fires every 15 minutes on Vercel (free tier /api/cron/assessment-day)
// and every 5 minutes in dev mode (/api/dev/assessment-day). Emails are sent when
// the assessment is between 45 and 60 minutes away so that every candidate is
// caught by at least one invocation no matter when the interval lands.
const WINDOW_START_MINUTES = 45;
const WINDOW_END_MINUTES = 60;

/**
 * Sends the "Online Assessment Available" email to candidates roughly one hour
 * before their scheduled assessment time.
 *
 * `assessmentDate` is stored as an absolute UTC timestamp, so no timezone
 * conversion is needed here — an assessment scheduled for 09:00 IST is stored as
 * 03:30 UTC, and the 45–60 minute window below automatically aligns to IST.
 */
export async function sendAssessmentReminderEmails(): Promise<{ emailed: number; jobsChecked: number }> {
  await connectDb();

  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_MINUTES * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (WINDOW_END_MINUTES + 1) * 60 * 1000);

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