import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { User } from "@/models/User";
import { requireRecruitmentHQ } from "@/lib/recruitment-hq";
import { sendMockTestInvitationsForJob } from "@/lib/assessment-mock-emails";

/**
 * On-demand invitation blast for one job's mock test.
 *
 * The daily cron (`/api/cron/mock-test-day`) does the same thing for every job;
 * this exists so HR does not have to wait for it, and gets a count back instead
 * of having to guess from the "not emailed yet" label.
 *
 * Same eligibility as the cron: candidates in `screening` or `assessment` who
 * have no `mockTest.inviteSentAt` latch yet.
 */

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  const hq = await requireRecruitmentHQ(user as any);
  if (!hq.ok) return hq.response;
  if (!user.company) return jsonError("No company found.", 400);

  const job = await ATSJob.findOne({ _id: id, company: user.company }).select("assessment status").lean();
  if (!job) return jsonError("Job not found.", 404);
  if (!job?.assessment) return jsonError("Online assessment is not enabled for this job.", 400);
  if (!["open", "draft"].includes(String((job as any).status))) {
    return jsonError("This job is not open, so mock test invitations cannot be sent.", 400);
  }

  const outcome = await sendMockTestInvitationsForJob(id);
  if (outcome.status === "unavailable") {
    return jsonError(
      outcome.reason === "window"
        ? "The mock test window has already closed, so nobody can be invited."
        : "Enable the mock test and set its start and end date-times first.",
      400
    );
  }

  return NextResponse.json({
    ok: true,
    emailed: outcome.emailed,
    candidatesSkipped: outcome.candidatesSkipped,
    eligible: outcome.eligible,
    invitedAt: outcome.invitedAt ? outcome.invitedAt.toISOString() : null,
  });
}
