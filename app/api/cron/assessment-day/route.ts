import { NextResponse } from "next/server";
import { sendAssessmentReminderEmails } from "@/lib/assessment-day-emails";
import { sweepExpiredAssessments } from "@/lib/assessment-auto-submit";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendAssessmentReminderEmails();

  // Backstop for the background auto-submit. The hot path is the scoped
  // finalize on each portal load; this catches candidates who never come back
  // after their clock expires. Runs on the existing daily cadence so it works
  // on Vercel plans that only allow once-a-day crons.
  const sweep = await sweepExpiredAssessments();

  return NextResponse.json({ ok: true, ...result, autoSubmitted: sweep.finalized, autoSubmitSkipped: sweep.skipped });
}
