import { NextResponse } from "next/server";
import { sendEditApplicationInvites } from "@/lib/edit-application-emails";

/**
 * Manual trigger for the editing invites, so the send can be tested without
 * waiting for the cron.
 *
 * `?jobId=` narrows it to one job, which is what you want when re-inviting a
 * single job after fixing a bad deadline — without it the run sweeps every open
 * window, though the per-candidate marker keeps that to outstanding candidates
 * only.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  const result = await sendEditApplicationInvites(jobId ? { jobId } : undefined);
  return NextResponse.json({ ok: true, ...result });
}
