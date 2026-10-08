import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { ATSCandidate } from "@/models/ATSCandidate";
import { Company } from "@/models/Company";
import { buildPortalLink, resolveCandidatePortalToken } from "@/lib/candidate-portal";
import { assessmentInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { resolveAssessmentSlots } from "@/lib/assessment-timing";
import { startOfKolkataDayMs } from "@/lib/date-utils";

/**
 * Real-assessment reminders.
 *
 * The "assessment start" is the first configured time slot on the job's
 * assessment date (an "HH:mm" on that IST day — see lib/assessment-timing), not
 * the raw `assessmentDate` instant. Two latched passes run from one morning
 * cron:
 *   - "day-before" the morning before the start day (`assessmentInviteSentAt`);
 *   - "same-day" the morning of the start day (`assessmentSameDayReminderSentAt`).
 * Both latches are cleared when a candidate enters the assessment stage or the
 * schedule moves, so a new window re-arms them.
 *
 * Running on the daily cron (Vercel Hobby only allows once-a-day jobs) means
 * the same-day pass lands in the morning, and the day-before pass lands the
 * morning before — never an exact "N hours before" instant.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderKind = "day-before" | "same-day";

function latchField(kind: ReminderKind): "assessmentInviteSentAt" | "assessmentSameDayReminderSentAt" {
  return kind === "same-day" ? "assessmentSameDayReminderSentAt" : "assessmentInviteSentAt";
}

/**
 * Whether this pass should send, given the first slot's start and the last
 * entry instant. The day-before pass only fires when the start is on
 * tomorrow's IST day, so a same-day assessment is never labelled "tomorrow".
 */
function kindMatches(
  firstStartMs: number,
  lastEntryAt: number,
  nowMs: number,
  kind: ReminderKind
): boolean {
  if (kind === "same-day") {
    return nowMs < lastEntryAt && startOfKolkataDayMs(firstStartMs) === startOfKolkataDayMs(nowMs);
  }
  return (
    firstStartMs > nowMs &&
    startOfKolkataDayMs(firstStartMs) === startOfKolkataDayMs(nowMs + DAY_MS)
  );
}

/**
 * Sends the day-before and same-day reminders for every assessment whose start
 * falls on today or tomorrow (IST).
 */
export async function sendAssessmentReminderEmails(): Promise<{
  emailed: number;
  jobsChecked: number;
  candidatesSkipped: number;
}> {
  await connectDb();

  const nowMs = Date.now();
  // A whole IST day of slack either side, so a late or early daily run still
  // sees every job whose start is today or tomorrow.
  const from = new Date(startOfKolkataDayMs(nowMs) - DAY_MS);
  const to = new Date(startOfKolkataDayMs(nowMs) + 2 * DAY_MS);

  const jobs = await ATSJob.find({
    assessment: true,
    status: { $in: ["open", "draft"] },
    assessmentDate: { $gte: from, $lte: to },
  });

  let emailed = 0;
  let candidatesSkipped = 0;

  for (const job of jobs) {
    const assessment = await ATSAssessment.findOne({ job: job._id }).select("timeSlots windowMode");
    const slots = resolveAssessmentSlots(job.assessmentDate, (assessment?.timeSlots as any) || [], {
      mode: (assessment?.windowMode as any) === "uniform" ? "uniform" : "relief",
      durationMinutes: (job as any).assessmentDurationMinutes ?? null,
    });
    if (!slots.length) continue;

    const firstSlot = slots[0];
    const lastEntryAt = slots[slots.length - 1].endMs;

    for (const kind of ["day-before", "same-day"] as const) {
      if (!kindMatches(firstSlot.startMs, lastEntryAt, nowMs, kind)) continue;

      const latch = latchField(kind);
      const candidates = await ATSCandidate.find({
        job: job._id,
        stage: "assessment",
        company: job.company,
        [latch]: null,
      });

      for (const candidate of candidates) {
        if ((candidate as any).assessmentSubmittedAt || (candidate as any).assessmentStartedAt) continue;

        try {
          const token = await resolveCandidatePortalToken(String(candidate._id));
          if (!token) {
            candidatesSkipped++;
            continue;
          }
          const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const portalLink = buildPortalLink(origin, token);
          const companyDoc = await Company.findById(job.company).select("name icon");
          const dateStr = new Date(firstSlot.startMs).toLocaleDateString("en-US", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const timeStr = new Date(firstSlot.startMs).toLocaleTimeString("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
          });
          const emailBody = assessmentInvitationEmail({
            candidateName: candidate.firstName,
            jobTitle: job.title,
            dateStr: `${dateStr} at ${timeStr}`,
            durationMinutes: (job as any).assessmentDurationMinutes,
            portalLink,
            company: { name: (companyDoc as any)?.name, icon: (companyDoc as any)?.icon },
            reminder: kind,
          });
          await sendMail({ to: candidate.email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
          await ATSCandidate.findByIdAndUpdate(candidate._id, { [latch]: new Date() });
          emailed++;
        } catch (err) {
          console.error(`Assessment email failed for ${candidate._id}:`, err);
          candidatesSkipped++;
        }
      }
    }
  }

  return { emailed, jobsChecked: jobs.length, candidatesSkipped };
}
