import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { jsonError, requireUserId } from "@/lib/api";
import { ATSJob } from "@/models/ATSJob";
import { ATSAssessment } from "@/models/ATSAssessment";
import { User } from "@/models/User";
import { assessmentResultsUnlocked } from "@/lib/assessment";

const HR_ROLES = ["admin", "human-resource"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!userId) return jsonError("Unauthorized", 401);

  await connectDb();
  const user = await User.findById(userId);
  if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
  if (!user.company) return jsonError("No company found.", 400);

  const assessment = await ATSAssessment.findOne({ job: id, company: user.company })
    .select("answerKeyPublished answerKeyPublishedAt")
    .lean();

  return NextResponse.json({
    published: (assessment as any)?.answerKeyPublished ?? false,
    publishedAt: (assessment as any)?.answerKeyPublishedAt ?? null,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const publish = Boolean(body.published);

    await connectDb();
    const user = await User.findById(userId);
    if (!user || !HR_ROLES.includes(user.role)) return jsonError("Forbidden", 403);
    if (!user.company) return jsonError("No company found.", 400);

    const job = await ATSJob.findOne({ _id: id, company: user.company }).select("assessment assessmentDate");
    if (!job) return jsonError("Job not found.", 404);
    if (!job.assessment) return jsonError("Online assessment is not enabled for this job.", 400);

    // Only allow publishing after the assessment date has passed (results unlocked).
    if (publish && !assessmentResultsUnlocked({ assessment: job.assessment, assessmentDate: job.assessmentDate })) {
      return jsonError("Answer keys can only be published after the assessment date.", 400);
    }

    const set: Record<string, any> = { answerKeyPublished: publish };
    if (publish) {
      set.answerKeyPublishedAt = new Date();
    } else {
      set.answerKeyPublishedAt = null;
    }

    const assessment = await ATSAssessment.findOneAndUpdate(
      { job: id, company: user.company },
      { $set: set },
      { new: true }
    );
    if (!assessment) return jsonError("No assessment found for this job.", 404);

    return NextResponse.json({
      ok: true,
      published: publish,
      publishedAt: (assessment as any).answerKeyPublishedAt ?? null,
    });
  } catch (err: any) {
    console.error("[assessment answer-key POST]", err);
    return jsonError(err?.message || "Failed to update answer key status.", 500);
  }
}
