import { NextResponse } from "next/server";
import { sendMockTestReminderEmails } from "@/lib/assessment-mock-emails";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";

/**
 * Single morning pass for every candidate reminder:
 *   - mock-test day-before and same-day emails;
 *   - real-assessment day-before and same-day emails.
 *
 * Each pass is latched per candidate, so running this more than once a day (or
 * alongside the legacy sweep crons) never double-sends. Vercel Hobby only
 * allows once-a-day crons, hence one combined morning job rather than an
 * exact "N hours before" schedule.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mock = await sendMockTestReminderEmails();
  const assessment = await sendAssessmentReminderEmails();

  return NextResponse.json({
    ok: true,
    mock,
    assessment,
    emailed: mock.emailed + assessment.emailed,
  });
}
