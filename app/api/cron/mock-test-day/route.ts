import { NextResponse } from "next/server";
import { sendMockTestInvitationEmails } from "@/lib/assessment-mock-emails";
import { sweepExpiredMockAttempts } from "@/lib/assessment-auto-submit";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendMockTestInvitationEmails();

  // Backstop for the mock auto-submit, mirroring the real assessment: the hot
  // path is the scoped finalize on each portal load, and this catches
  // candidates who never come back after their mock clock expires.
  const sweep = await sweepExpiredMockAttempts();

  return NextResponse.json({
    ok: true,
    ...result,
    autoSubmitted: sweep.finalized,
    autoSubmitSkipped: sweep.skipped,
  });
}
