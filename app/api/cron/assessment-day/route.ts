import { NextResponse } from "next/server";
import { sweepExpiredAssessments } from "@/lib/assessment-auto-submit";

/**
 * Assessment auto-submit backstop. The invitation/reminder emails are sent by
 * the combined morning job (`/api/cron/reminders`), not here.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Backstop for the background auto-submit. The hot path is the scoped
  // finalize on each portal load; this catches candidates who never come back
  // after their clock expires. Runs on the existing daily cadence so it works
  // on Vercel plans that only allow once-a-day crons.
  const sweep = await sweepExpiredAssessments();

  return NextResponse.json({ ok: true, autoSubmitted: sweep.finalized, autoSubmitSkipped: sweep.skipped });
}
