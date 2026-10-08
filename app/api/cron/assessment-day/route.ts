import { NextResponse } from "next/server";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";
import { sendMockTestReminderEmails } from "@/lib/assessment-mock-emails";
import { sweepExpiredAssessments } from "@/lib/assessment-auto-submit";

/**
 * Morning job for online assessments: the real-assessment invite and the mock
 * test invite both go out from here (each while its window opens within the
 * next 24 hours), followed by the assessment auto-submit backstop. Running them
 * together keeps the deployment on the same daily cron count for Vercel plans
 * that only allow once-a-day jobs.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assessment = await sendAssessmentReminderEmails();
  const mock = await sendMockTestReminderEmails();

  // Backstop for the background auto-submit. The hot path is the scoped
  // finalize on each portal load; this catches candidates who never come back
  // after their clock expires. Runs on the existing daily cadence so it works
  // on Vercel plans that only allow once-a-day crons.
  const sweep = await sweepExpiredAssessments();

  return NextResponse.json({
    ok: true,
    assessment,
    mock,
    autoSubmitted: sweep.finalized,
    autoSubmitSkipped: sweep.skipped,
  });
}
