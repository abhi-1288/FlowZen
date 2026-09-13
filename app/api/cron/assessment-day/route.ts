import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ATSJob } from "@/models/ATSJob";
import { ATSCandidate } from "@/models/ATSCandidate";
import { resolveCandidatePortalToken, buildPortalLink } from "@/lib/candidate-portal";
import { assessmentInvitationEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const jobs = await ATSJob.find({
    assessment: true,
    assessmentDate: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ["open", "draft"] },
  });

  let emailed = 0;

  for (const job of jobs) {
    const candidates = await ATSCandidate.find({
      job: job._id,
      stage: "assessment",
      company: job.company,
    });

    for (const candidate of candidates) {
      if ((candidate as any).assessmentSubmittedAt || (candidate as any).assessmentStartedAt) continue;

      try {
        const token = await resolveCandidatePortalToken(String(candidate._id));
        if (!token) continue;
        const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalLink = buildPortalLink(origin, token);
        const dateStr = new Date(job.assessmentDate!).toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        });
        const emailBody = assessmentInvitationEmail({
          candidateName: candidate.firstName,
          jobTitle: job.title,
          dateStr,
          durationMinutes: (job as any).assessmentDurationMinutes,
          portalLink,
        });
        await sendMail({ to: candidate.email, subject: emailBody.subject, text: emailBody.text, html: emailBody.html });
        emailed++;
      } catch (err) {
        console.error(`Assessment email failed for ${candidate._id}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true, emailed, jobsChecked: jobs.length });
}